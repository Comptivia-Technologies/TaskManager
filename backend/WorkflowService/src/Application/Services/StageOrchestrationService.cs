using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace WorkflowService.Application.Services;

/// <summary>
/// Service for orchestrating stage transitions in workflows
/// Supports both Process (completion-based) and Escalation (timeout-based) workflows
/// </summary>
public class StageOrchestrationService : IStageOrchestrationService
{
    private readonly IWorkflowRepository _workflowRepository;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<StageOrchestrationService> _logger;

    public StageOrchestrationService(
        IWorkflowRepository workflowRepository,
        IRabbitMQPublisher publisher,
        ILogger<StageOrchestrationService> logger)
    {
        _workflowRepository = workflowRepository;
        _publisher = publisher;
        _logger = logger;
    }

    /// <summary>
    /// Starts a task in the first stage of its workflow
    /// Called when a task is assigned to a member
    /// Only executes for initial assignment, skips reassignments
    /// </summary>
    public async Task StartTaskInFirstStageAsync(TaskAssignedEvent taskAssignedEvent)
    {
        try
        {
            // Get workflow selection to find WorkflowId
            var workflowSelection = await _workflowRepository.GetByTaskIdAsync(taskAssignedEvent.TaskId);
            if (workflowSelection == null)
            {
                _logger.LogWarning(
                    "Workflow selection not found for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    taskAssignedEvent.TaskId, taskAssignedEvent.CorrelationId);
                return;
            }

            // Check if stage orchestration has already started for this task
            // This prevents restarting from Stage 1 when a task is reassigned
            if (workflowSelection.StageOrchestrationStarted)
            {
                _logger.LogInformation(
                    "Stage orchestration already started for task, skipping. TaskId: {TaskId}, StartedAt: {StartedAt}, CorrelationId: {CorrelationId}",
                    taskAssignedEvent.TaskId, workflowSelection.StageOrchestrationStartedAt, taskAssignedEvent.CorrelationId);
                return;
            }

            // Get workflow stages ordered by StageOrder
            var stages = await _workflowRepository.GetStagesByWorkflowIdAsync(workflowSelection.WorkflowId);
            var stagesList = stages.OrderBy(s => s.StageOrder).ToList();

            if (!stagesList.Any())
            {
                _logger.LogWarning(
                    "No stages found for workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                    taskAssignedEvent.TaskId, workflowSelection.WorkflowId, taskAssignedEvent.CorrelationId);
                return;
            }

            var firstStage = stagesList.First();

            // Calculate timeout if this is an escalation stage
            DateTime? stageTimeoutAt = null;
            if (firstStage.StageType == "Escalation" && firstStage.TimeoutMinutes.HasValue)
            {
                stageTimeoutAt = DateTime.UtcNow.AddMinutes(firstStage.TimeoutMinutes.Value);
            }

            // Publish TaskStageStartedEvent
            var stageStartedEvent = new TaskStageStartedEvent
            {
                TaskId = taskAssignedEvent.TaskId,
                StageId = firstStage.StageId,
                StageName = firstStage.StageName,
                StageOrder = firstStage.StageOrder,
                StageType = firstStage.StageType,
                WorkflowId = workflowSelection.WorkflowId,
                TeamId = firstStage.TeamId,
                StartedAt = DateTime.UtcNow,
                StageTimeoutAt = stageTimeoutAt,
                CorrelationId = taskAssignedEvent.CorrelationId
            };

            await _publisher.PublishAsync(
                stageStartedEvent,
                RabbitMQConstants.WorkflowExchange,
                RabbitMQConstants.TaskStageStarted,
                taskAssignedEvent.CorrelationId);

            // Mark stage orchestration as started to prevent restarting on reassignment
            workflowSelection.StageOrchestrationStarted = true;
            workflowSelection.StageOrchestrationStartedAt = DateTime.UtcNow;
            await _workflowRepository.UpdateAsync(workflowSelection);

            _logger.LogInformation(
                "Task started in first stage. TaskId: {TaskId}, StageId: {StageId}, StageName: {StageName}, StageType: {StageType}, CorrelationId: {CorrelationId}",
                taskAssignedEvent.TaskId, firstStage.StageId, firstStage.StageName, firstStage.StageType, taskAssignedEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error starting task in first stage. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                taskAssignedEvent.TaskId, taskAssignedEvent.CorrelationId);
            throw;
        }
    }

    /// <summary>
    /// Handles stage completion and transitions to next stage
    /// For Process workflows: transitions on completion
    /// </summary>
    public async Task HandleStageCompletionAsync(TaskStageCompletedEvent stageCompletedEvent)
    {
        try
        {
            // Get all stages for the workflow
            var stages = await _workflowRepository.GetStagesByWorkflowIdAsync(stageCompletedEvent.WorkflowId);
            var stagesList = stages.OrderBy(s => s.StageOrder).ToList();
            
            // Find current stage and next stage
            var currentStage = stagesList.FirstOrDefault(s => s.StageId == stageCompletedEvent.StageId);
            if (currentStage == null)
            {
                _logger.LogWarning(
                    "Current stage not found. TaskId: {TaskId}, StageId: {StageId}, CorrelationId: {CorrelationId}",
                    stageCompletedEvent.TaskId, stageCompletedEvent.StageId, stageCompletedEvent.CorrelationId);
                return;
            }
            
            // Find next stage by StageOrder
            var nextStage = stagesList.FirstOrDefault(s => s.StageOrder > currentStage.StageOrder);
            
            // If there's a next stage, start it
            if (nextStage != null)
            {

                // Calculate timeout if this is an escalation stage
                DateTime? stageTimeoutAt = null;
                if (nextStage.StageType == "Escalation" && nextStage.TimeoutMinutes.HasValue)
                {
                    stageTimeoutAt = DateTime.UtcNow.AddMinutes(nextStage.TimeoutMinutes.Value);
                }

                // Publish TaskStageStartedEvent for next stage
                var stageStartedEvent = new TaskStageStartedEvent
                {
                    TaskId = stageCompletedEvent.TaskId,
                    StageId = nextStage.StageId,
                    StageName = nextStage.StageName,
                    StageOrder = nextStage.StageOrder,
                    StageType = nextStage.StageType,
                    WorkflowId = stageCompletedEvent.WorkflowId,
                    TeamId = nextStage.TeamId,
                    StartedAt = DateTime.UtcNow,
                    StageTimeoutAt = stageTimeoutAt,
                    CorrelationId = stageCompletedEvent.CorrelationId
                };

                await _publisher.PublishAsync(
                    stageStartedEvent,
                    RabbitMQConstants.WorkflowExchange,
                    RabbitMQConstants.TaskStageStarted,
                    stageCompletedEvent.CorrelationId);

                _logger.LogInformation(
                    "Task transitioned to next stage. TaskId: {TaskId}, FromStageId: {FromStageId}, ToStageId: {ToStageId}, CorrelationId: {CorrelationId}",
                    stageCompletedEvent.TaskId, stageCompletedEvent.StageId, nextStage.StageId, stageCompletedEvent.CorrelationId);
            }
            else
            {
                // This is the last stage - task is complete
                var workflow = await _workflowRepository.GetWorkflowByIdAsync(stageCompletedEvent.WorkflowId);
                if (workflow == null)
                {
                    _logger.LogWarning(
                        "Workflow not found for task completion. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                        stageCompletedEvent.TaskId, stageCompletedEvent.WorkflowId, stageCompletedEvent.CorrelationId);
                    return;
                }

                // Publish TaskCompletedEvent
                var taskCompletedEvent = new TaskCompletedEvent
                {
                    TaskId = stageCompletedEvent.TaskId,
                    WorkflowId = stageCompletedEvent.WorkflowId,
                    WorkflowName = workflow.WorkflowName,
                    FinalStageId = stageCompletedEvent.StageId,
                    FinalStageName = stageCompletedEvent.StageName,
                    CompletedAt = DateTime.UtcNow,
                    TotalDuration = TimeSpan.Zero, // Could calculate from task creation time
                    CorrelationId = stageCompletedEvent.CorrelationId
                };

                await _publisher.PublishAsync(
                    taskCompletedEvent,
                    RabbitMQConstants.WorkflowExchange,
                    RabbitMQConstants.TaskCompleted,
                    stageCompletedEvent.CorrelationId);

                _logger.LogInformation(
                    "Task completed all stages. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                    stageCompletedEvent.TaskId, stageCompletedEvent.WorkflowId, stageCompletedEvent.CorrelationId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling stage completion. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                stageCompletedEvent.TaskId, stageCompletedEvent.CorrelationId);
            throw;
        }
    }

    /// <summary>
    /// Handles escalation timeout and transitions to next stage
    /// For Escalation workflows: transitions on timeout
    /// </summary>
    public async Task HandleEscalationTimeoutAsync(TaskStageEscalationTriggeredEvent escalationEvent)
    {
        try
        {
            // Get all stages for the workflow
            var stages = await _workflowRepository.GetStagesByWorkflowIdAsync(escalationEvent.WorkflowId);
            var stagesList = stages.OrderBy(s => s.StageOrder).ToList();
            
            // Find current stage and next stage
            var currentStage = stagesList.FirstOrDefault(s => s.StageId == escalationEvent.CurrentStageId);
            if (currentStage == null)
            {
                _logger.LogWarning(
                    "Current stage not found for escalation. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, CorrelationId: {CorrelationId}",
                    escalationEvent.TaskId, escalationEvent.CurrentStageId, escalationEvent.CorrelationId);
                return;
            }
            
            // Find next stage by StageOrder
            var nextStage = stagesList.FirstOrDefault(s => s.StageOrder > currentStage.StageOrder);
            
            // If there's a next stage, start it
            if (nextStage != null)
            {

                // Calculate timeout if this is an escalation stage
                DateTime? stageTimeoutAt = null;
                if (nextStage.StageType == "Escalation" && nextStage.TimeoutMinutes.HasValue)
                {
                    stageTimeoutAt = DateTime.UtcNow.AddMinutes(nextStage.TimeoutMinutes.Value);
                }

                // Publish TaskStageStartedEvent for next stage
                var stageStartedEvent = new TaskStageStartedEvent
                {
                    TaskId = escalationEvent.TaskId,
                    StageId = nextStage.StageId,
                    StageName = nextStage.StageName,
                    StageOrder = nextStage.StageOrder,
                    StageType = nextStage.StageType,
                    WorkflowId = escalationEvent.WorkflowId,
                    TeamId = nextStage.TeamId,
                    StartedAt = DateTime.UtcNow,
                    StageTimeoutAt = stageTimeoutAt,
                    CorrelationId = escalationEvent.CorrelationId
                };

                await _publisher.PublishAsync(
                    stageStartedEvent,
                    RabbitMQConstants.WorkflowExchange,
                    RabbitMQConstants.TaskStageStarted,
                    escalationEvent.CorrelationId);

                _logger.LogInformation(
                    "Task escalated to next stage. TaskId: {TaskId}, FromStageId: {FromStageId}, ToStageId: {ToStageId}, CorrelationId: {CorrelationId}",
                    escalationEvent.TaskId, escalationEvent.CurrentStageId, nextStage.StageId, escalationEvent.CorrelationId);
            }
            else
            {
                // This is the last stage - task is complete (or needs manual intervention)
                var workflow = await _workflowRepository.GetWorkflowByIdAsync(escalationEvent.WorkflowId);
                if (workflow == null)
                {
                    _logger.LogWarning(
                        "Workflow not found for escalated task. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                        escalationEvent.TaskId, escalationEvent.WorkflowId, escalationEvent.CorrelationId);
                    return;
                }

                // Publish TaskCompletedEvent (or could be a different event for max escalation reached)
                var taskCompletedEvent = new TaskCompletedEvent
                {
                    TaskId = escalationEvent.TaskId,
                    WorkflowId = escalationEvent.WorkflowId,
                    WorkflowName = workflow.WorkflowName,
                    FinalStageId = escalationEvent.CurrentStageId,
                    FinalStageName = escalationEvent.CurrentStageName,
                    CompletedAt = DateTime.UtcNow,
                    TotalDuration = TimeSpan.Zero,
                    CorrelationId = escalationEvent.CorrelationId
                };

                await _publisher.PublishAsync(
                    taskCompletedEvent,
                    RabbitMQConstants.WorkflowExchange,
                    RabbitMQConstants.TaskCompleted,
                    escalationEvent.CorrelationId);

                _logger.LogInformation(
                    "Task completed after final escalation. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                    escalationEvent.TaskId, escalationEvent.WorkflowId, escalationEvent.CorrelationId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling escalation timeout. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                escalationEvent.TaskId, escalationEvent.CorrelationId);
            throw;
        }
    }
}

