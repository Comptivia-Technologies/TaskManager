using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Text.Json;
using System.Net.Http.Json;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskStageStartedEvent
/// Updates task with current stage information and triggers reassignment if team changes
/// </summary>
public class TaskStageStartedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly IRabbitMQPublisher _publisher;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TaskStageStartedEventHandler> _logger;

    public TaskStageStartedEventHandler(
        ITaskRepository repository,
        IRabbitMQPublisher publisher,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TaskStageStartedEventHandler> logger)
    {
        _repository = repository;
        _publisher = publisher;
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskStageStartedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskStageStartedEvent. TaskId: {TaskId}, StageId: {StageId}, StageName: {StageName}, StageType: {StageType}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.StageId, @event.StageName, @event.StageType, @event.TeamId, correlationId);

            // Idempotency check - use CorrelationId (unique per event) not TaskId (same for all stage events)
            var existingTask = await _repository.GetByEventIdAsync("TaskStageStartedEvent", correlationId);
            if (existingTask != null && existingTask.TaskStageStartedEventId == correlationId)
            {
                _logger.LogWarning(
                    "TaskStageStartedEvent already processed. TaskId: {TaskId}, StageId: {StageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.StageId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskStageStartedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // CRITICAL: Skip if this event is for a stage that's OLDER than current stage
            // This prevents old Stage 1 events from overwriting a newer Stage 2 status
            // But allow processing if event stage equals current stage (this is the legitimate start event)
            if (task.CurrentStageId.HasValue && @event.StageId < task.CurrentStageId.Value)
            {
                _logger.LogWarning(
                    "Skipping TaskStageStartedEvent - stage is older than current. TaskId: {TaskId}, CurrentStageId: {CurrentStageId}, EventStageId: {EventStageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, task.CurrentStageId.Value, @event.StageId, correlationId);
                return;
            }

            // Check if we need to trigger reassignment (team change)
            var needsReassignment = await CheckIfReassignmentNeededAsync(task, @event);

            // Update task with stage information
            task.CurrentStageId = @event.StageId;
            task.CurrentStageStartedAt = @event.StartedAt;
            task.StageTimeoutAt = @event.StageTimeoutAt;
            task.Status = DomainTaskStatus.InStage;
            task.TaskStageStartedEventId = correlationId; // Store CorrelationId for idempotency (unique per stage event)
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task updated with stage information. TaskId: {TaskId}, StageId: {StageId}, StageType: {StageType}, TimeoutAt: {TimeoutAt}",
                task.TaskId, task.CurrentStageId, @event.StageType, task.StageTimeoutAt);

            // Sync stage to WorkflowManagement.API so frontend can see it
            await SyncStageToWorkflowManagementAPIAsync(task, @event);

            // Publish reassignment event if team changed
            if (needsReassignment)
            {
                var reassignmentEvent = new TaskStageReassignmentNeededEvent
                {
                    TaskId = task.TaskId,
                    StageId = @event.StageId,
                    StageName = @event.StageName,
                    StageOrder = @event.StageOrder,
                    WorkflowId = @event.WorkflowId,
                    NewTeamId = @event.TeamId,
                    PreviousMemberId = task.MemberId,
                    PreviousTeamId = needsReassignment ? await GetMemberTeamIdAsync(task.MemberId) : null,
                    TaskPriority = task.Priority,
                    RequestedAt = DateTime.UtcNow,
                    CorrelationId = correlationId
                };

                await _publisher.PublishAsync(
                    reassignmentEvent,
                    RabbitMQConstants.WorkloadExchange,
                    RabbitMQConstants.TaskStageReassignmentNeeded,
                    correlationId);

                _logger.LogInformation(
                    "Task reassignment requested due to team change. TaskId: {TaskId}, NewTeamId: {NewTeamId}, PreviousMemberId: {PreviousMemberId}, CorrelationId: {CorrelationId}",
                    task.TaskId, @event.TeamId, task.MemberId, correlationId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskStageStartedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }

    /// <summary>
    /// Checks if task needs reassignment based on team change
    /// </summary>
    private async Task<bool> CheckIfReassignmentNeededAsync(Domain.Entities.Task task, TaskStageStartedEvent @event)
    {
        // If task has no member assigned, no need for reassignment (initial assignment will happen)
        if (!task.MemberId.HasValue)
        {
            _logger.LogInformation(
                "Task has no member assigned, skipping reassignment check. TaskId: {TaskId}",
                task.TaskId);
            return false;
        }

        // Get current member's team
        var currentMemberTeamId = await GetMemberTeamIdAsync(task.MemberId);
        
        if (!currentMemberTeamId.HasValue)
        {
            _logger.LogWarning(
                "Could not determine current member's team, triggering reassignment. TaskId: {TaskId}, MemberId: {MemberId}",
                task.TaskId, task.MemberId);
            return true;
        }

        // If new stage's team is different from current member's team, needs reassignment
        var needsReassignment = currentMemberTeamId.Value != @event.TeamId;
        
        if (needsReassignment)
        {
            _logger.LogInformation(
                "Team change detected, reassignment needed. TaskId: {TaskId}, CurrentMemberTeamId: {CurrentTeamId}, NewStageTeamId: {NewTeamId}",
                task.TaskId, currentMemberTeamId.Value, @event.TeamId);
        }
        else
        {
            _logger.LogInformation(
                "Same team, no reassignment needed. TaskId: {TaskId}, TeamId: {TeamId}",
                task.TaskId, @event.TeamId);
        }

        return needsReassignment;
    }

    /// <summary>
    /// Gets the team ID for a member from WorkflowManagement.API
    /// </summary>
    private async Task<int?> GetMemberTeamIdAsync(int? memberId)
    {
        if (!memberId.HasValue)
            return null;

        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
                ?? "http://localhost:5000/api";

            var response = await _httpClient.GetAsync($"{workflowManagementApiUrl}/members/{memberId.Value}");
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Failed to get member details. MemberId: {MemberId}, StatusCode: {StatusCode}",
                    memberId.Value, response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            var memberData = JsonSerializer.Deserialize<MemberInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            return memberData?.TeamId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting member team. MemberId: {MemberId}", memberId.Value);
            return null;
        }
    }

    private class MemberInfo
    {
        public int MemberId { get; set; }
        public int? TeamId { get; set; }
    }

    /// <summary>
    /// Syncs task stage to WorkflowManagement.API so frontend can display it
    /// Updates existing task with current stage
    /// </summary>
    private async System.Threading.Tasks.Task SyncStageToWorkflowManagementAPIAsync(Domain.Entities.Task task, TaskStageStartedEvent @event)
    {
        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
                ?? "http://localhost:5000/api";

            // Retry logic in case task hasn't been synced to WorkflowManagement.API yet (race condition)
            WorkflowTaskInfo? workflowTask = null;
            int maxRetries = 3;
            int retryDelayMs = 500;

            for (int retry = 0; retry < maxRetries; retry++)
            {
                // First, find the task in WorkflowManagement.API by name and workflowId
                var searchResponse = await _httpClient.GetAsync(
                    $"{workflowManagementApiUrl}/tasks/workflow/{@event.WorkflowId}");

                if (!searchResponse.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Failed to get tasks from WorkflowManagement.API. WorkflowId: {WorkflowId}, StatusCode: {StatusCode}, Retry: {Retry}",
                        @event.WorkflowId, searchResponse.StatusCode, retry);
                    
                    if (retry < maxRetries - 1)
                    {
                        await System.Threading.Tasks.Task.Delay(retryDelayMs);
                        continue;
                    }
                    return;
                }

                var tasksJson = await searchResponse.Content.ReadAsStringAsync();
                var tasks = JsonSerializer.Deserialize<List<WorkflowTaskInfo>>(tasksJson, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                // Find the task by name (since TaskId in WorkflowManagement.API is different)
                workflowTask = tasks?.FirstOrDefault(t => 
                    t.TaskName == task.TaskName || 
                    (t.Description != null && t.Description.Contains(task.TaskId.ToString())));

                if (workflowTask != null)
                {
                    break; // Found the task
                }

                if (retry < maxRetries - 1)
                {
                    _logger.LogInformation(
                        "Task not found in WorkflowManagement.API yet, retrying... TaskId: {TaskId}, Retry: {Retry}",
                        task.TaskId, retry);
                    await System.Threading.Tasks.Task.Delay(retryDelayMs);
                }
            }

            if (workflowTask == null)
            {
                _logger.LogWarning(
                    "Could not find task in WorkflowManagement.API to update stage after retries. TaskId: {TaskId}, TaskName: {TaskName}",
                    task.TaskId, task.TaskName);
                return;
            }

            // Update the task with the stage
            var updatePayload = new
            {
                taskName = workflowTask.TaskName,
                description = workflowTask.Description,
                status = workflowTask.Status,
                priority = workflowTask.Priority,
                dueDate = workflowTask.DueDate,
                workflowId = workflowTask.WorkflowId,
                stageId = @event.StageId,
                assignedToMemberId = workflowTask.AssignedToMemberId
            };

            var updateResponse = await _httpClient.PutAsJsonAsync(
                $"{workflowManagementApiUrl}/tasks/{workflowTask.TaskId}",
                updatePayload);

            if (updateResponse.IsSuccessStatusCode)
            {
                _logger.LogInformation(
                    "Task stage synced to WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, StageId: {StageId}",
                    task.TaskId, workflowTask.TaskId, @event.StageId);
            }
            else
            {
                var errorContent = await updateResponse.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to update task stage in WorkflowManagement.API. TaskId: {TaskId}, Status: {Status}, Error: {Error}",
                    task.TaskId, updateResponse.StatusCode, errorContent);
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't break the flow
            _logger.LogError(ex,
                "Error syncing task stage to WorkflowManagement.API. TaskId: {TaskId}",
                task.TaskId);
        }
    }

    private class WorkflowTaskInfo
    {
        public int TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public int WorkflowId { get; set; }
        public int? StageId { get; set; }
        public int? AssignedToMemberId { get; set; }
    }
}
