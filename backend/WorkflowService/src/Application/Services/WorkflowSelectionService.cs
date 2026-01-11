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
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<WorkflowSelectionService> _logger;

    public WorkflowSelectionService(
        IWorkflowRepository repository,
        IRabbitMQPublisher publisher,
        ILogger<WorkflowSelectionService> logger)
    {
        _repository = repository;
        _publisher = publisher;
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
            // Simple strategy: Select first workflow (can be enhanced with priority matching, etc.)
            var selectedWorkflow = SelectBestWorkflow(workflowsList, taskCreatedEvent);
            
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
                SelectionReason = $"Selected based on task type: {taskCreatedEvent.TaskType}",
                SelectedAt = DateTime.UtcNow,
                TaskCreatedEventId = taskCreatedEvent.TaskId // For idempotency
            };

            await _repository.CreateAsync(selection);

            // Publish WorkflowSelectedEvent
            var workflowSelectedEvent = new WorkflowSelectedEvent
            {
                SelectionId = selection.SelectionId, // Include SelectionId for idempotency
                TaskId = taskCreatedEvent.TaskId,
                WorkflowId = selectedWorkflow.WorkflowId,
                WorkflowName = selectedWorkflow.WorkflowName,
                TaskPriority = taskCreatedEvent.Priority,
                TaskType = taskCreatedEvent.TaskType,
                TeamId = selectedWorkflow.TeamId,
                SelectedAt = DateTime.UtcNow,
                CorrelationId = taskCreatedEvent.CorrelationId
            };

            await _publisher.PublishAsync(
                workflowSelectedEvent,
                RabbitMQConstants.WorkflowExchange,
                RabbitMQConstants.WorkflowSelected,
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
    /// Matches workflows by task type (e.g., "ERP" task → "ERP Workflow")
    /// </summary>
    private Application.Interfaces.Workflow? SelectBestWorkflow(IEnumerable<Application.Interfaces.Workflow> workflows, TaskCreatedEvent taskEvent)
    {
        // Strategy 1: Match by workflow name containing task type
        // Example: TaskType="ERP" → Match "ERP Workflow" or "ERP Development Workflow"
        var nameMatch = workflows.FirstOrDefault(w => 
            w.WorkflowName.Contains(taskEvent.TaskType, StringComparison.OrdinalIgnoreCase));
        if (nameMatch != null)
        {
            _logger.LogInformation(
                "Matched workflow by name. TaskType: {TaskType}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                taskEvent.TaskType, nameMatch.WorkflowName, nameMatch.WorkflowId);
            return nameMatch;
        }

        // Strategy 2: Match by workflow description containing task type
        var descriptionMatch = workflows.FirstOrDefault(w => 
            !string.IsNullOrEmpty(w.Description) && 
            w.Description.Contains(taskEvent.TaskType, StringComparison.OrdinalIgnoreCase));
        if (descriptionMatch != null)
        {
            _logger.LogInformation(
                "Matched workflow by description. TaskType: {TaskType}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                taskEvent.TaskType, descriptionMatch.WorkflowName, descriptionMatch.WorkflowId);
            return descriptionMatch;
        }

        // Strategy 3: Fallback to first available workflow
        var fallback = workflows.FirstOrDefault();
        if (fallback != null)
        {
            _logger.LogWarning(
                "No specific workflow match found, using fallback. TaskType: {TaskType}, WorkflowName: {WorkflowName}, WorkflowId: {WorkflowId}",
                taskEvent.TaskType, fallback.WorkflowName, fallback.WorkflowId);
        }
        return fallback;
    }
}

