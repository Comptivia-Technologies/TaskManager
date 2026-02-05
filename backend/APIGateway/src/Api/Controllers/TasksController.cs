using Microsoft.AspNetCore.Mvc;
using APIGateway.Application.DTOs;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using System.Text.Json;

namespace APIGateway.Api.Controllers;

/// <summary>
/// API Gateway - Entry point for task creation
/// Orchestrates the flow by publishing events (no business logic)
/// </summary>
[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private readonly IEventBus _eventBus;
    private readonly ILogger<TasksController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public TasksController(
        IEventBus eventBus,
        ILogger<TasksController> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _eventBus = eventBus;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    /// <summary>
    /// Create a new task - Entry point for orchestration flow
    /// Returns full task details (status, assignee, workflow name, etc.) after processing completes
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateTask([FromBody] CreateTaskRequestDto request)
    {
        try
        {
            var correlationId = Guid.NewGuid();
            var taskId = Guid.NewGuid();

            var taskCreatedEvent = new TaskCreatedEvent
            {
                TaskId = taskId,
                TaskName = request.TaskName,
                Description = request.Description,
                Priority = string.Empty,
                TaskType = request.TaskType,
                TaskData = request.TaskData,
                PriorityAssigned = false,
                CreatedAt = DateTime.UtcNow,
                CorrelationId = correlationId
            };

            await _eventBus.PublishAsync(
                taskCreatedEvent,
                EventBusConstants.TaskSource,
                EventBusConstants.TaskCreated,
                correlationId);

            _logger.LogInformation(
                "Task creation initiated via API Gateway. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                taskId, correlationId);

            // Wait for task processing and get details using the GET endpoint logic
            var taskDetails = await WaitForTaskAndGetDetailsAsync(taskId, maxRetries: 15, retryDelayMs: 500);

            if (taskDetails != null)
            {
                return Ok(taskDetails);
            }

            // Fallback: return basic info if processing takes too long
            return Accepted(new
            {
                taskId = taskId,
                correlationId = correlationId,
                message = "Task creation initiated. Processing asynchronously. Use GET /api/tasks/{taskId} to retrieve full details."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating task creation via API Gateway");
            return StatusCode(500, new { error = "An error occurred while initiating task creation" });
        }
    }

    /// <summary>
    /// Get task details by ID (Guid)
    /// Returns full task details including workflow name, assignee name, etc.
    /// </summary>
    [HttpGet("{taskId:guid}")]
    public async Task<ActionResult> GetTaskById(Guid taskId)
    {
        try
        {
            var taskDetails = await GetTaskDetailsAsync(taskId);
            
            if (taskDetails == null)
            {
                return NotFound(new { error = $"Task with ID {taskId} not found" });
            }

            return Ok(taskDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting task details. TaskId: {TaskId}", taskId);
            return StatusCode(500, new { error = "An error occurred while retrieving the task" });
        }
    }

    /// <summary>
    /// Waits for task to be processed and then gets full details
    /// </summary>
    private async Task<object?> WaitForTaskAndGetDetailsAsync(Guid taskId, int maxRetries, int retryDelayMs)
    {
        for (int retry = 0; retry < maxRetries; retry++)
        {
            var taskDetails = await GetTaskDetailsAsync(taskId);
            
            if (taskDetails != null)
            {
                // Check if workflow is selected (task is processed)
                var taskDetailsJson = System.Text.Json.JsonSerializer.Serialize(taskDetails);
                using var doc = JsonDocument.Parse(taskDetailsJson);
                var root = doc.RootElement;
                var workflowId = GetIntProperty(root, "workflowId", "WorkflowId");
                
                // If workflow is selected, return details immediately
                if (workflowId.HasValue)
                {
                    _logger.LogInformation("Task processed successfully. TaskId: {TaskId}, WorkflowId: {WorkflowId}", 
                        taskId, workflowId.Value);
                    return taskDetails;
                }
                
                // If task exists but workflow not selected yet, wait more
                if (retry < maxRetries - 1)
                {
                    _logger.LogDebug("Task found but workflow not selected yet. TaskId: {TaskId}, Retry: {Retry}/{MaxRetries}", 
                        taskId, retry + 1, maxRetries);
                    await Task.Delay(retryDelayMs);
                    continue;
                }
                
                // After all retries, return what we have
                _logger.LogInformation("Returning task details (workflow may not be selected yet). TaskId: {TaskId}", taskId);
                return taskDetails;
            }
            
            // Task not found yet, wait and retry
            if (retry < maxRetries - 1)
            {
                _logger.LogDebug("Task not found yet. TaskId: {TaskId}, Retry: {Retry}/{MaxRetries}", 
                    taskId, retry + 1, maxRetries);
                await Task.Delay(retryDelayMs);
            }
        }

        _logger.LogWarning("Task not found after {MaxRetries} retries. TaskId: {TaskId}", maxRetries, taskId);
        return null;
    }

    /// <summary>
    /// Gets full task details by querying TaskService and enriching with data from WorkflowManagement.API
    /// </summary>
    private async Task<object?> GetTaskDetailsAsync(Guid taskId)
    {
        var taskServiceApiUrl = _configuration["TaskServiceApi:BaseUrl"] 
            ?? throw new InvalidOperationException("TaskServiceApi:BaseUrl configuration is required");
        var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
            ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");
        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(30);

        try
        {
            // Step 1: Query TaskService
            var taskServiceResponse = await httpClient.GetAsync($"{taskServiceApiUrl}/task-service/{taskId}");
            if (taskServiceResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }

            if (!taskServiceResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning("TaskService returned error. Status: {Status}, TaskId: {TaskId}", 
                    taskServiceResponse.StatusCode, taskId);
                return null;
            }

            var taskServiceJson = await taskServiceResponse.Content.ReadAsStringAsync();
            using var taskServiceDoc = JsonDocument.Parse(taskServiceJson);
            var taskServiceRoot = taskServiceDoc.RootElement;

            var priority = GetStringProperty(taskServiceRoot, "priority", "Priority") ?? "Medium";
            var workflowId = GetIntProperty(taskServiceRoot, "workflowId", "WorkflowId");
            var status = GetStatusProperty(taskServiceRoot) ?? "Created";
            var memberId = GetIntProperty(taskServiceRoot, "memberId", "MemberId");
            var taskName = GetStringProperty(taskServiceRoot, "taskName", "TaskName") ?? "";
            var description = GetStringProperty(taskServiceRoot, "description", "Description");
            var createdAt = GetStringProperty(taskServiceRoot, "createdAt", "CreatedAt");

            // Step 2: Get workflow name
            string? workflowName = null;
            if (workflowId.HasValue)
            {
                try
                {
                    var workflowResponse = await httpClient.GetAsync($"{workflowManagementApiUrl}/workflows/{workflowId.Value}");
                    if (workflowResponse.IsSuccessStatusCode)
                    {
                        var workflowJson = await workflowResponse.Content.ReadAsStringAsync();
                        using var workflowDoc = JsonDocument.Parse(workflowJson);
                        var workflowRoot = workflowDoc.RootElement;
                        workflowName = GetStringProperty(workflowRoot, "workflowName", "WorkflowName");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get workflow name. WorkflowId: {WorkflowId}", workflowId.Value);
                }
            }

            // Step 3: Get assignee name
            string? assigneeName = null;
            if (memberId.HasValue)
            {
                try
                {
                    var memberResponse = await httpClient.GetAsync($"{workflowManagementApiUrl}/members/{memberId.Value}");
                    if (memberResponse.IsSuccessStatusCode)
                    {
                        var memberJson = await memberResponse.Content.ReadAsStringAsync();
                        using var memberDoc = JsonDocument.Parse(memberJson);
                        var memberRoot = memberDoc.RootElement;
                        var firstName = GetStringProperty(memberRoot, "firstName", "FirstName") ?? "";
                        var lastName = GetStringProperty(memberRoot, "lastName", "LastName") ?? "";
                        assigneeName = $"{firstName} {lastName}".Trim();
                        if (string.IsNullOrEmpty(assigneeName))
                            assigneeName = null;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get member name. MemberId: {MemberId}", memberId.Value);
                }
            }

            // Step 4: Get stage name
            string? stageName = null;
            if (workflowId.HasValue)
            {
                try
                {
                    var tasksResponse = await httpClient.GetAsync($"{workflowManagementApiUrl}/tasks/workflow/{workflowId.Value}");
                    if (tasksResponse.IsSuccessStatusCode)
                    {
                        var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
                        using var tasksDoc = JsonDocument.Parse(tasksJson);
                        var tasksArray = tasksDoc.RootElement.EnumerateArray();
                        
                        foreach (var taskElement in tasksArray)
                        {
                            var taskNameFromApi = GetStringProperty(taskElement, "taskName", "TaskName");
                            if (taskNameFromApi?.Equals(taskName, StringComparison.OrdinalIgnoreCase) == true)
                            {
                                stageName = GetStringProperty(taskElement, "stageName", "StageName");
                                break;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get stage name. WorkflowId: {WorkflowId}", workflowId);
                }
            }

            return new
            {
                taskId = taskId,
                taskName = taskName,
                description = description,
                status = status,
                priority = priority,
                workflowId = workflowId,
                workflowName = workflowName,
                stageName = stageName,
                assignedToMemberId = memberId,
                assignedToMemberName = assigneeName,
                createdAt = createdAt
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting task details. TaskId: {TaskId}", taskId);
            return null;
        }
    }

    private string? GetStringProperty(JsonElement element, string camelCase, string pascalCase)
    {
        if (element.TryGetProperty(camelCase, out var camelProp))
        {
            if (camelProp.ValueKind == JsonValueKind.String)
                return camelProp.GetString();
            if (camelProp.ValueKind == JsonValueKind.Number)
                return camelProp.GetInt32().ToString();
        }
        if (element.TryGetProperty(pascalCase, out var pascalProp))
        {
            if (pascalProp.ValueKind == JsonValueKind.String)
                return pascalProp.GetString();
            if (pascalProp.ValueKind == JsonValueKind.Number)
                return pascalProp.GetInt32().ToString();
        }
        return null;
    }

    private string? GetStatusProperty(JsonElement element)
    {
        // Status is an enum, so it might be a number or string
        if (element.TryGetProperty("status", out var camelProp))
        {
            if (camelProp.ValueKind == JsonValueKind.String)
                return camelProp.GetString();
            if (camelProp.ValueKind == JsonValueKind.Number)
            {
                // Convert enum number to string
                var statusValue = camelProp.GetInt32();
                return statusValue switch
                {
                    0 => "Created",
                    1 => "WorkflowSelected",
                    2 => "SLAConfigured",
                    3 => "Assigned",
                    4 => "InProgress",
                    5 => "Completed",
                    6 => "Overdue",
                    7 => "Cancelled",
                    _ => statusValue.ToString()
                };
            }
        }
        if (element.TryGetProperty("Status", out var pascalProp))
        {
            if (pascalProp.ValueKind == JsonValueKind.String)
                return pascalProp.GetString();
            if (pascalProp.ValueKind == JsonValueKind.Number)
            {
                var statusValue = pascalProp.GetInt32();
                return statusValue switch
                {
                    0 => "Created",
                    1 => "WorkflowSelected",
                    2 => "SLAConfigured",
                    3 => "Assigned",
                    4 => "InProgress",
                    5 => "Completed",
                    6 => "Overdue",
                    7 => "Cancelled",
                    _ => statusValue.ToString()
                };
            }
        }
        return null;
    }

    private int? GetIntProperty(JsonElement element, string camelCase, string pascalCase)
    {
        if (element.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind == JsonValueKind.Number)
            return camelProp.GetInt32();
        if (element.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind == JsonValueKind.Number)
            return pascalProp.GetInt32();
        return null;
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", service = "API Gateway" });
    }
}

