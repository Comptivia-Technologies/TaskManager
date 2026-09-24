using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using WorkflowService.Application.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace WorkflowService.Application.Services;

/// <summary>
/// Service for orchestrating stage transitions in workflows
/// Supports both Process (completion-based) and Escalation (timeout-based) workflows
/// </summary>
public class StageOrchestrationService : IStageOrchestrationService
{
    private readonly IWorkflowRepository _workflowRepository;
    private readonly IEventBus _eventBus;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<StageOrchestrationService> _logger;

    public StageOrchestrationService(
        IWorkflowRepository workflowRepository,
        IEventBus eventBus,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<StageOrchestrationService> logger)
    {
        _workflowRepository = workflowRepository;
        _eventBus = eventBus;
        _httpClient = httpClient;
        _configuration = configuration;
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

            // Get workflow stages ordered by StageOrder FIRST (before checking flag)
            // This allows us to detect if stages were added after initial assignment
            var stages = await _workflowRepository.GetStagesByWorkflowIdAsync(workflowSelection.WorkflowId);
            var stagesList = stages.OrderBy(s => s.StageOrder).ToList();

            // Check if stage orchestration has already started for this task
            // BUT: If stages exist now, allow retry (stages may have been added after initial assignment)
            if (workflowSelection.StageOrchestrationStarted)
            {
                if (!stagesList.Any())
                {
                    // No stages exist - skip (prevents infinite retries)
                    _logger.LogInformation(
                        "Stage orchestration already started for task, skipping (no stages exist). TaskId: {TaskId}, StartedAt: {StartedAt}, CorrelationId: {CorrelationId}",
                        taskAssignedEvent.TaskId, workflowSelection.StageOrchestrationStartedAt, taskAssignedEvent.CorrelationId);
                    return;
                }
                
                // Stages exist now - check if task is already in a stage
                // Only reset if CurrentStageId is NULL (task never entered any stage)
                var taskServiceApiUrl = _configuration["TaskServiceApi:BaseUrl"] 
                    ?? "http://task-service.workflow-automation/api";
                
                try
                {
                    var taskResponse = await _httpClient.GetAsync($"{taskServiceApiUrl}/task-service/{taskAssignedEvent.TaskId}");
                    if (taskResponse.IsSuccessStatusCode)
                    {
                        var taskJson = await taskResponse.Content.ReadAsStringAsync();
                        using var taskDoc = JsonDocument.Parse(taskJson);
                        var currentStageId = taskDoc.RootElement.TryGetProperty("currentStageId", out var stageIdProp) 
                            ? (stageIdProp.ValueKind == JsonValueKind.Null ? (Guid?)null : stageIdProp.GetGuid()) 
                            : (Guid?)null;
                        
                        if (currentStageId.HasValue)
                        {
                            // Task is already in a stage - don't reset flag (reassignment scenario)
                            _logger.LogInformation(
                                "Stage orchestration already started and task is in stage. Skipping. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, CorrelationId: {CorrelationId}",
                                taskAssignedEvent.TaskId, currentStageId.Value, taskAssignedEvent.CorrelationId);
                            return;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, 
                        "Failed to check task CurrentStageId from TaskService. TaskId: {TaskId}, CorrelationId: {CorrelationId}. Proceeding with reset.",
                        taskAssignedEvent.TaskId, taskAssignedEvent.CorrelationId);
                }
                
                // Stages exist but CurrentStageId is NULL - reset flag and proceed
                _logger.LogInformation(
                    "Stage orchestration was marked as started but stages now exist and task is not in any stage. Resetting flag and starting stage orchestration. TaskId: {TaskId}, WorkflowId: {WorkflowId}, StagesCount: {StagesCount}, CorrelationId: {CorrelationId}",
                    taskAssignedEvent.TaskId, workflowSelection.WorkflowId, stagesList.Count, taskAssignedEvent.CorrelationId);
                
                workflowSelection.StageOrchestrationStarted = false;
                workflowSelection.StageOrchestrationStartedAt = null;
                await _workflowRepository.UpdateAsync(workflowSelection);
            }

            if (!stagesList.Any())
            {
                _logger.LogWarning(
                    "No stages found for workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}. " +
                    "Stage orchestration cannot start. Please add stages to the workflow.",
                    taskAssignedEvent.TaskId, workflowSelection.WorkflowId, taskAssignedEvent.CorrelationId);
                
                // Mark orchestration as started to prevent infinite retries
                // Even though no stage was started, we mark it to avoid retrying when task is reassigned
                workflowSelection.StageOrchestrationStarted = true;
                workflowSelection.StageOrchestrationStartedAt = DateTime.UtcNow;
                await _workflowRepository.UpdateAsync(workflowSelection);
                
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

            await _eventBus.PublishAsync(
                stageStartedEvent,
                EventBusConstants.WorkflowSource,
                EventBusConstants.TaskStageStarted,
                taskAssignedEvent.CorrelationId);

            // Schedule escalation event if this is an escalation stage
            if (firstStage.StageType == "Escalation" && stageTimeoutAt.HasValue)
            {
                var escalationEvent = new TaskStageEscalationTriggeredEvent
                {
                    TaskId = taskAssignedEvent.TaskId,
                    CurrentStageId = firstStage.StageId,
                    CurrentStageName = firstStage.StageName,
                    WorkflowId = workflowSelection.WorkflowId,
                    NextStageId = null, // Will be determined when event fires
                    NextStageName = null,
                    EscalatedAt = stageTimeoutAt.Value,
                    CorrelationId = taskAssignedEvent.CorrelationId
                };

                await _eventBus.ScheduleAsync(
                    escalationEvent,
                    EventBusConstants.WorkflowSource,
                    EventBusConstants.TaskStageEscalationTriggered,
                    escalationEvent.CorrelationId,
                    stageTimeoutAt.Value);

                _logger.LogInformation(
                    "Scheduled escalation event for stage. TaskId: {TaskId}, StageId: {StageId}, TimeoutAt: {TimeoutAt}, CorrelationId: {CorrelationId}",
                    taskAssignedEvent.TaskId, firstStage.StageId, stageTimeoutAt.Value, taskAssignedEvent.CorrelationId);
            }

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
                    // Carries a deliberate human choice of assignee, if one was made
                    // when the previous stage was completed.
                    PreferredMemberId = stageCompletedEvent.NextStageMemberId,
                    CorrelationId = stageCompletedEvent.CorrelationId
                };

                await _eventBus.PublishAsync(
                    stageStartedEvent,
                    EventBusConstants.WorkflowSource,
                    EventBusConstants.TaskStageStarted,
                    stageCompletedEvent.CorrelationId);

                // Schedule escalation event if this is an escalation stage
                if (nextStage.StageType == "Escalation" && stageTimeoutAt.HasValue)
                {
                    var escalationEvent = new TaskStageEscalationTriggeredEvent
                    {
                        TaskId = stageCompletedEvent.TaskId,
                        CurrentStageId = nextStage.StageId,
                        CurrentStageName = nextStage.StageName,
                        WorkflowId = stageCompletedEvent.WorkflowId,
                        NextStageId = null, // Will be determined when event fires
                        NextStageName = null,
                        EscalatedAt = stageTimeoutAt.Value,
                        CorrelationId = stageCompletedEvent.CorrelationId
                    };

                    await _eventBus.ScheduleAsync(
                        escalationEvent,
                        EventBusConstants.WorkflowSource,
                        EventBusConstants.TaskStageEscalationTriggered,
                        escalationEvent.CorrelationId,
                        stageTimeoutAt.Value);

                    _logger.LogInformation(
                        "Scheduled escalation event for stage. TaskId: {TaskId}, StageId: {StageId}, TimeoutAt: {TimeoutAt}, CorrelationId: {CorrelationId}",
                        stageCompletedEvent.TaskId, nextStage.StageId, stageTimeoutAt.Value, stageCompletedEvent.CorrelationId);
                }

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

                await _eventBus.PublishAsync(
                    taskCompletedEvent,
                    EventBusConstants.WorkflowSource,
                    EventBusConstants.TaskCompleted,
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

                await _eventBus.PublishAsync(
                    stageStartedEvent,
                    EventBusConstants.WorkflowSource,
                    EventBusConstants.TaskStageStarted,
                    escalationEvent.CorrelationId);

                // Schedule escalation event if this is an escalation stage
                if (nextStage.StageType == "Escalation" && stageTimeoutAt.HasValue)
                {
                    var nextEscalationEvent = new TaskStageEscalationTriggeredEvent
                    {
                        TaskId = escalationEvent.TaskId,
                        CurrentStageId = nextStage.StageId,
                        CurrentStageName = nextStage.StageName,
                        WorkflowId = escalationEvent.WorkflowId,
                        NextStageId = null, // Will be determined when event fires
                        NextStageName = null,
                        EscalatedAt = stageTimeoutAt.Value,
                        CorrelationId = escalationEvent.CorrelationId
                    };

                    await _eventBus.ScheduleAsync(
                        nextEscalationEvent,
                        EventBusConstants.WorkflowSource,
                        EventBusConstants.TaskStageEscalationTriggered,
                        nextEscalationEvent.CorrelationId,
                        stageTimeoutAt.Value);

                    _logger.LogInformation(
                        "Scheduled escalation event for stage. TaskId: {TaskId}, StageId: {StageId}, TimeoutAt: {TimeoutAt}, CorrelationId: {CorrelationId}",
                        escalationEvent.TaskId, nextStage.StageId, stageTimeoutAt.Value, escalationEvent.CorrelationId);
                }

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

                await _eventBus.PublishAsync(
                    taskCompletedEvent,
                    EventBusConstants.WorkflowSource,
                    EventBusConstants.TaskCompleted,
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

    /// <summary>
    /// Starts the target stage of a return and asks assignment to restore the previous member.
    /// </summary>
    public async Task HandleStageReturnedAsync(TaskStageReturnedEvent stageReturnedEvent)
    {
        try
        {
            var stages = await _workflowRepository.GetStagesByWorkflowIdAsync(stageReturnedEvent.WorkflowId);
            var targetStage = stages.FirstOrDefault(s => s.StageId == stageReturnedEvent.ToStageId);
            if (targetStage == null)
            {
                _logger.LogWarning(
                    "Return target stage not found. TaskId: {TaskId}, ToStageId: {ToStageId}, CorrelationId: {CorrelationId}",
                    stageReturnedEvent.TaskId, stageReturnedEvent.ToStageId, stageReturnedEvent.CorrelationId);
                return;
            }

            DateTime? stageTimeoutAt = null;
            if (targetStage.StageType == "Escalation" && targetStage.TimeoutMinutes.HasValue)
            {
                stageTimeoutAt = DateTime.UtcNow.AddMinutes(targetStage.TimeoutMinutes.Value);
            }

            var stageStartedEvent = new TaskStageStartedEvent
            {
                TaskId = stageReturnedEvent.TaskId,
                StageId = targetStage.StageId,
                StageName = targetStage.StageName,
                StageOrder = targetStage.StageOrder,
                StageType = targetStage.StageType,
                WorkflowId = stageReturnedEvent.WorkflowId,
                TeamId = targetStage.TeamId,
                StartedAt = DateTime.UtcNow,
                StageTimeoutAt = stageTimeoutAt,
                PreferredMemberId = stageReturnedEvent.ToMemberId,
                CorrelationId = stageReturnedEvent.CorrelationId
            };

            await _eventBus.PublishAsync(
                stageStartedEvent,
                EventBusConstants.WorkflowSource,
                EventBusConstants.TaskStageStarted,
                stageReturnedEvent.CorrelationId);

            _logger.LogInformation(
                "Task returned to previous stage. TaskId: {TaskId}, ToStageId: {ToStageId}, ToMemberId: {ToMemberId}, CorrelationId: {CorrelationId}",
                stageReturnedEvent.TaskId, targetStage.StageId, stageReturnedEvent.ToMemberId, stageReturnedEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling stage return. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                stageReturnedEvent.TaskId, stageReturnedEvent.CorrelationId);
            throw;
        }
    }
}

