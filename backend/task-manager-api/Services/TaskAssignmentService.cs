using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TaskManager.API.DTOs;
using TaskManager.API.External;

namespace TaskManager.API.Services;

/// <summary>
/// Rule-based workflow selection and SLA assignment service.
/// </summary>
public class TaskAssignmentService : ITaskAssignmentService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TaskAssignmentService> _logger;

    public TaskAssignmentService(IHttpClientFactory httpClientFactory, ILogger<TaskAssignmentService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<(ExternalWorkflowReadDto workflow, ExternalSlaConfigurationReadDto? slaConfig, string slaPriorityKey)> AssignWorkflowAndSlaAsync(
        TaskManagerTaskCreateDto taskDto,
        CancellationToken cancellationToken = default)
    {
        var workflowsClient = _httpClientFactory.CreateClient("WorkflowsApi");
        var slaClient = _httpClientFactory.CreateClient("SlaApi");

        // 1. Fetch all workflows
        var workflowsResponse = await workflowsClient.GetAsync("workflows", cancellationToken);
        workflowsResponse.EnsureSuccessStatusCode();

        var workflows = await workflowsResponse.Content.ReadFromJsonAsync<List<ExternalWorkflowReadDto>>(cancellationToken: cancellationToken)
                        ?? new List<ExternalWorkflowReadDto>();

        if (!workflows.Any())
        {
            throw new InvalidOperationException("No workflows are available for task assignment.");
        }

        // 2. Evaluate workflows using simple, extensible rule-based scoring
        var bestWorkflow = SelectBestWorkflow(taskDto, workflows);

        // 3. Fetch SLA configuration for selected workflow (if available)
        ExternalSlaConfigurationReadDto? slaConfig = null;
        try
        {
            var slaResponse = await slaClient.GetAsync($"sla-configurations/workflow/{bestWorkflow.WorkflowId}", cancellationToken);
            if (slaResponse.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogWarning("No SLA configuration found for workflow {WorkflowId}", bestWorkflow.WorkflowId);
            }
            else
            {
                slaResponse.EnsureSuccessStatusCode();
                slaConfig = await slaResponse.Content.ReadFromJsonAsync<ExternalSlaConfigurationReadDto>(cancellationToken: cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching SLA configuration for workflow {WorkflowId}", bestWorkflow.WorkflowId);
        }

        // 4. Determine SLA priority key (defaults to task priority or Medium)
        var requestedPriorityKey = NormalizePriority(taskDto.Priority);
        string chosenPriorityKey = requestedPriorityKey;

        if (slaConfig != null)
        {
            // If the requested priority does not exist in SLA, fall back in a sensible order
            if (!slaConfig.PriorityLevels.ContainsKey(chosenPriorityKey))
            {
                var fallbackOrder = new[] { "Critical", "High", "Medium", "Low" };
                chosenPriorityKey = fallbackOrder.FirstOrDefault(p => slaConfig.PriorityLevels.ContainsKey(p)) ?? chosenPriorityKey;
            }
        }

        return (bestWorkflow, slaConfig, chosenPriorityKey);
    }

    private static ExternalWorkflowReadDto SelectBestWorkflow(TaskManagerTaskCreateDto taskDto, List<ExternalWorkflowReadDto> workflows)
    {
        ExternalWorkflowReadDto? best = null;
        var bestScore = int.MinValue;

        foreach (var workflow in workflows)
        {
            var score = 0;

            // Rule 1: Team match (strong signal)
            if (taskDto.TeamId.HasValue && workflow.TeamId.HasValue && taskDto.TeamId.Value == workflow.TeamId.Value)
            {
                score += 50;
            }

            // Rule 2: Priority keyword in workflow name or description
            var priorityKey = NormalizePriority(taskDto.Priority);
            if (!string.IsNullOrWhiteSpace(workflow.WorkflowName) &&
                workflow.WorkflowName.Contains(priorityKey, StringComparison.OrdinalIgnoreCase))
            {
                score += 20;
            }
            if (!string.IsNullOrWhiteSpace(workflow.Description) &&
                workflow.Description.Contains(priorityKey, StringComparison.OrdinalIgnoreCase))
            {
                score += 10;
            }

            // Rule 3: Basic tie-breaker on workflow id (stable ordering)
            score += workflow.WorkflowId;

            if (score > bestScore)
            {
                bestScore = score;
                best = workflow;
            }
        }

        if (best == null)
        {
            // Safety fallback: return the first workflow
            best = workflows.OrderBy(w => w.WorkflowId).First();
        }

        return best;
    }

    private static string NormalizePriority(string? priority)
    {
        if (string.IsNullOrWhiteSpace(priority))
        {
            return "Medium";
        }

        var normalized = priority.Trim().ToLowerInvariant();
        return normalized switch
        {
            "critical" => "Critical",
            "high" => "High",
            "low" => "Low",
            _ => "Medium"
        };
    }
}


