using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using WorkflowService.Application.Interfaces;
using WorkflowService.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.Services;

/// <summary>
/// Service for selecting the best workflow for a task
/// </summary>
public class WorkflowSelectionService : IWorkflowSelectionService
{
    private readonly IWorkflowRepository _repository;
    private readonly IEventBus _eventBus;
    private readonly ILogger<WorkflowSelectionService> _logger;

    public WorkflowSelectionService(
        IWorkflowRepository repository,
        IEventBus eventBus,
        ILogger<WorkflowSelectionService> logger)
    {
        _repository = repository;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task SelectWorkflowForTaskAsync(TaskCreatedEvent taskCreatedEvent)
    {
        try
        {
            // Idempotency check
            var existingSelection = await _repository.GetByTaskIdAsync(taskCreatedEvent.TaskId);
            if (existingSelection != null)
            {
                _logger.LogWarning(
                    "Workflow already selected for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    taskCreatedEvent.TaskId, taskCreatedEvent.CorrelationId);
                return;
            }

            // Get all available workflows
            var workflows = await _repository.GetAllWorkflowsAsync();
            var workflowsList = workflows.ToList();

            if (!workflowsList.Any())
            {
                _logger.LogWarning(
                    "No workflows available for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    taskCreatedEvent.TaskId, taskCreatedEvent.CorrelationId);
                return;
            }

            // Select workflow based on business logic
            var (selectedWorkflow, selectionReason) = SelectBestWorkflow(workflowsList, taskCreatedEvent);
            
            if (selectedWorkflow == null)
            {
                _logger.LogWarning(
                    "No workflow could be selected for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    taskCreatedEvent.TaskId, taskCreatedEvent.CorrelationId);
                return;
            }

            // Persist selection
            var selection = new WorkflowSelection
            {
                TaskId = taskCreatedEvent.TaskId,
                WorkflowId = selectedWorkflow.WorkflowId,
                WorkflowName = selectedWorkflow.WorkflowName,
                SelectionReason = selectionReason, // Use actual reason from selection logic
                SelectedAt = DateTime.UtcNow,
                TaskCreatedEventId = taskCreatedEvent.TaskId // For idempotency
            };

            await _repository.CreateAsync(selection);

            // Publish WorkflowSelectedEvent (includes task data for priority rule evaluation)
            var workflowSelectedEvent = new WorkflowSelectedEvent
            {
                SelectionId = selection.SelectionId, // Include SelectionId for idempotency
                TaskId = taskCreatedEvent.TaskId,
                WorkflowId = selectedWorkflow.WorkflowId,
                WorkflowName = selectedWorkflow.WorkflowName,
                TaskPriority = taskCreatedEvent.Priority,  // Will be empty, priority engine will assign
                TaskType = taskCreatedEvent.TaskType,
                TaskName = taskCreatedEvent.TaskName,
                Description = taskCreatedEvent.Description,
                TaskData = taskCreatedEvent.TaskData,  // Include task data for priority rule evaluation
                TeamId = selectedWorkflow.TeamId,
                SelectedAt = DateTime.UtcNow,
                CorrelationId = taskCreatedEvent.CorrelationId
            };

            await _eventBus.PublishAsync(
                workflowSelectedEvent,
                EventBusConstants.WorkflowSource,
                EventBusConstants.WorkflowSelected,
                taskCreatedEvent.CorrelationId);

            _logger.LogInformation(
                "Workflow selected for task. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                taskCreatedEvent.TaskId, selectedWorkflow.WorkflowId, taskCreatedEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error selecting workflow for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                taskCreatedEvent.TaskId, taskCreatedEvent.CorrelationId);
            throw;
        }
    }

    /// <summary>
    /// Selects the best workflow based on task parameters
    /// Priority: Keyword analysis → TaskType → Fallback
    /// </summary>
    private (Application.Interfaces.Workflow? Workflow, string Reason) SelectBestWorkflow(
        IEnumerable<Application.Interfaces.Workflow> workflows, 
        TaskCreatedEvent taskEvent)
    {
        var workflowsList = workflows.ToList();
        
        // Strategy 1: Keyword-based matching from TaskName and Description
        var keywordMatch = MatchByKeywords(workflowsList, taskEvent);
        if (keywordMatch.Workflow != null)
        {
            return keywordMatch;
        }
        
        // Strategy 2: Match by TaskType (if provided)
        if (!string.IsNullOrWhiteSpace(taskEvent.TaskType))
        {
            // Match by workflow name containing task type
            var nameMatch = workflowsList.FirstOrDefault(w => 
                w.WorkflowName.Contains(taskEvent.TaskType, StringComparison.OrdinalIgnoreCase));
            if (nameMatch != null)
            {
                var reason = $"Matched by TaskType: '{nameMatch.WorkflowName}' contains task type '{taskEvent.TaskType}'";
                _logger.LogInformation(
                    "Matched workflow by TaskType. TaskType: {TaskType}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                    taskEvent.TaskType, nameMatch.WorkflowName, nameMatch.WorkflowId);
                return (nameMatch, reason);
            }

            // Match by workflow description containing task type
            var descriptionMatch = workflowsList.FirstOrDefault(w => 
                !string.IsNullOrEmpty(w.Description) && 
                w.Description.Contains(taskEvent.TaskType, StringComparison.OrdinalIgnoreCase));
            if (descriptionMatch != null)
            {
                var reason = $"Matched by TaskType in description: description contains '{taskEvent.TaskType}'";
                _logger.LogInformation(
                    "Matched workflow by TaskType in description. TaskType: {TaskType}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                    taskEvent.TaskType, descriptionMatch.WorkflowName, descriptionMatch.WorkflowId);
                return (descriptionMatch, reason);
            }
        }
        
        // Strategy 3: Fallback to first available workflow
        var fallback = workflowsList.FirstOrDefault();
        if (fallback != null)
        {
            var reason = $"Fallback: No keyword or TaskType match found. Selected first available workflow '{fallback.WorkflowName}'";
            _logger.LogWarning(
                "No specific workflow match found, using fallback. TaskName: {TaskName}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                taskEvent.TaskName, fallback.WorkflowName, fallback.WorkflowId);
            return (fallback, reason);
        }
        
        return (null, "No workflows available");
    }

    /// <summary>
    /// Matches workflow by extracting keywords from TaskName and Description
    /// </summary>
    private (Application.Interfaces.Workflow? Workflow, string Reason) MatchByKeywords(
        IEnumerable<Application.Interfaces.Workflow> workflows,
        TaskCreatedEvent taskEvent)
    {
        // Combine TaskName and Description for analysis
        var searchText = $"{taskEvent.TaskName} {taskEvent.Description ?? ""}".Trim();
        
        if (string.IsNullOrWhiteSpace(searchText))
        {
            return (null, "No text available for keyword matching");
        }
        
        // Extract keywords (remove common words, get meaningful terms)
        var keywords = ExtractKeywords(searchText);
        
        if (!keywords.Any())
        {
            return (null, "No meaningful keywords extracted");
        }
        
        _logger.LogInformation(
            "Extracted keywords from task. TaskId: {TaskId}, Keywords: {Keywords}",
            taskEvent.TaskId, string.Join(", ", keywords));
        
        // Score each workflow based on keyword matches
        var scoredWorkflows = workflows.Select(w => new
        {
            Workflow = w,
            Score = CalculateKeywordScore(w, keywords, searchText)
        })
        .Where(x => x.Score > 0)
        .OrderByDescending(x => x.Score)
        .ToList();
        
        if (scoredWorkflows.Any())
        {
            var bestMatch = scoredWorkflows.First();
            var matchedKeywords = GetMatchedKeywords(bestMatch.Workflow, keywords, searchText);
            var reason = $"Matched by keywords: '{string.Join(", ", matchedKeywords)}' found in workflow '{bestMatch.Workflow.WorkflowName}' (score: {bestMatch.Score})";
            
            _logger.LogInformation(
                "Matched workflow by keywords. TaskId: {TaskId}, WorkflowName: {WorkflowName}, Score: {Score}, Keywords: {Keywords}",
                taskEvent.TaskId, bestMatch.Workflow.WorkflowName, bestMatch.Score, string.Join(", ", matchedKeywords));
            
            return (bestMatch.Workflow, reason);
        }
        
        return (null, "No keyword matches found");
    }

    /// <summary>
    /// Extracts meaningful keywords from text
    /// </summary>
    private List<string> ExtractKeywords(string text)
    {
        // Common stop words to ignore
        var stopWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
            "be", "have", "has", "had", "do", "does", "did", "will", "would",
            "should", "could", "may", "might", "must", "can", "this", "that",
            "these", "those", "i", "you", "he", "she", "it", "we", "they", "fix",
            "update", "create", "add", "remove", "delete", "change", "modify", "task"
        };
        
        // Normalize text: replace hyphens/underscores with spaces for better splitting
        var normalizedText = text.Replace("-", " ").Replace("_", " ");
        
        // Split by whitespace and punctuation, convert to lowercase
        var words = System.Text.RegularExpressions.Regex
            .Split(normalizedText.ToLowerInvariant(), @"[\s\p{P}]+")
            .Where(w => w.Length > 2 && !stopWords.Contains(w))
            .Distinct()
            .ToList();
        
        return words;
    }

    /// <summary>
    /// Calculates a score for workflow based on keyword matches
    /// </summary>
    private int CalculateKeywordScore(Application.Interfaces.Workflow workflow, List<string> keywords, string searchText)
    {
        int score = 0;
        // Normalize workflow name and description to lowercase for consistent case-insensitive matching
        var workflowName = (workflow.WorkflowName ?? "").Trim().ToLowerInvariant();
        var workflowDescription = (workflow.Description ?? "").Trim().ToLowerInvariant();
        var workflowText = $"{workflowName} {workflowDescription}";
        
        foreach (var keyword in keywords)
        {
            // Keywords are already lowercase from extraction, but ensure it
            var keywordLower = keyword.ToLowerInvariant();
            
            // Exact match in workflow name (higher weight)
            if (workflowName.Contains(keywordLower))
            {
                score += 10;
            }
            
            // Match in workflow description (medium weight) - can add even if name matched
            if (!string.IsNullOrWhiteSpace(workflowDescription) && 
                workflowDescription.Contains(keywordLower))
            {
                score += 5;
            }
        }
        
        return score;
    }

    /// <summary>
    /// Gets the list of keywords that matched for a workflow
    /// </summary>
    private List<string> GetMatchedKeywords(Application.Interfaces.Workflow workflow, List<string> keywords, string searchText)
    {
        var matched = new List<string>();
        // Normalize to lowercase for consistent case-insensitive matching
        var workflowName = (workflow.WorkflowName ?? "").Trim().ToLowerInvariant();
        var workflowDescription = (workflow.Description ?? "").Trim().ToLowerInvariant();
        var workflowText = $"{workflowName} {workflowDescription}";
        
        foreach (var keyword in keywords)
        {
            var keywordLower = keyword.ToLowerInvariant();
            if (workflowText.Contains(keywordLower))
            {
                matched.Add(keyword);
            }
        }
        
        return matched;
    }
}

