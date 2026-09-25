using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
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
    private readonly ITaskStageHistoryRepository _historyRepository;
    private readonly ITaskStageNominationRepository _nominationRepository;
    private readonly IEventBus _eventBus;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TaskStageStartedEventHandler> _logger;

    public TaskStageStartedEventHandler(
        ITaskRepository repository,
        ITaskStageHistoryRepository historyRepository,
        ITaskStageNominationRepository nominationRepository,
        IEventBus eventBus,
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TaskStageStartedEventHandler> logger)
    {
        _repository = repository;
        _historyRepository = historyRepository;
        _nominationRepository = nominationRepository;
        _eventBus = eventBus;
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

            // CRITICAL: Only skip if this is the EXACT same stage (duplicate event)
            // Allow if different stage (next stage from escalation/completion) or if CurrentStageId is null
            // The idempotency check above already prevents duplicate processing of same event
            if (task.CurrentStageId.HasValue && @event.StageId == task.CurrentStageId.Value)
            {
                // Same stage - this is likely a duplicate event, but idempotency check should have caught it
                // If we get here, it's safe to skip since we're already in this stage
                _logger.LogInformation(
                    "TaskStageStartedEvent for current stage (already in this stage). TaskId: {TaskId}, StageId: {StageId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.StageId, correlationId);
                return;
            }

            // An explicit choice wins: either a human named the assignee when completing
            // the previous stage, or the task was sent back to its earlier holder.
            var preferredMemberId = @event.PreferredMemberId;
            if (!preferredMemberId.HasValue)
            {
                // Then an appointment made earlier in the workflow — the team lead
                // naming the engineer for this stage.
                var nomination = await _nominationRepository.GetForStageAsync(@event.TaskId, @event.StageId);
                preferredMemberId = nomination?.MemberId;
            }
            if (!preferredMemberId.HasValue)
            {
                // Otherwise, a stage the task has visited before returns to whoever held it.
                var lastAssignment = await _historyRepository.GetLastAssignmentAsync(@event.TaskId, @event.StageId);
                preferredMemberId = lastAssignment?.MemberId;
            }
            if (!preferredMemberId.HasValue)
            {
                // Finally, a team that has already worked on this enquiry keeps it with
                // the same person. Procurement hands the BOQ back to the engineer who
                // listed the items, and both approvals hand the quotation back to the
                // administrator who raised it, with nobody having to choose.
                preferredMemberId = await FindTeamContinuityMemberAsync(@event, task.OrganizationId);
            }

            var teamChanged = await CheckIfReassignmentNeededAsync(task, @event);
            var restorePreviousMember = preferredMemberId.HasValue && task.MemberId != preferredMemberId;
            // A team change must always reassign. Gating it on there being no preferred
            // member left tasks sitting on a new stage still held by someone from the
            // previous team, because a preferred member is synthesized above whenever
            // the stage has been visited before.
            var needsReassignment = restorePreviousMember || teamChanged;
            var preferredForReassignment = restorePreviousMember ? preferredMemberId : null;

            // Update task with stage information
            task.CurrentStageId = @event.StageId;
            task.CurrentStageStartedAt = @event.StartedAt;
            task.StageTimeoutAt = @event.StageTimeoutAt;
            // Don't change status to InStage - keep it as Assigned until member manually changes to InProgress
            // task.Status = DomainTaskStatus.InStage;  // Removed - status stays as Assigned
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
                    PreviousTeamId = needsReassignment ? await GetMemberTeamIdAsync(task.MemberId, task.OrganizationId) : null,
                    TaskPriority = task.Priority,
                    PreferredMemberId = preferredForReassignment,
                    RequestedAt = DateTime.UtcNow,
                    CorrelationId = correlationId
                };

                await _eventBus.PublishAsync(
                    reassignmentEvent,
                    EventBusConstants.WorkloadSource,
                    EventBusConstants.TaskStageReassignmentNeeded,
                    correlationId);

                _logger.LogInformation(
                    "Task reassignment requested due to team change. TaskId: {TaskId}, NewTeamId: {NewTeamId}, PreviousMemberId: {PreviousMemberId}, CorrelationId: {CorrelationId}",
                    task.TaskId, @event.TeamId, task.MemberId, correlationId);
            }
            else if (task.MemberId.HasValue)
            {
                var memberName = await GetMemberNameAsync(task.MemberId.Value, task.OrganizationId);
                await _historyRepository.AppendAsync(new TaskStageHistory
                {
                    OrganizationId = task.OrganizationId,
                    TaskId = task.TaskId,
                    Action = TaskStageHistory.Assigned,
                    StageId = @event.StageId,
                    StageName = @event.StageName,
                    StageOrder = @event.StageOrder,
                    MemberId = task.MemberId.Value,
                    MemberName = memberName,
                    ToStageId = @event.StageId,
                    ToStageName = @event.StageName,
                    OccurredAt = @event.StartedAt,
                    CorrelationId = correlationId
                });
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
    /// The person from this stage's team who most recently held any stage of this
    /// task. Null when the team is arriving for the first time, which leaves the
    /// choice to the nomination or the workload engine.
    /// </summary>
    private async Task<Guid?> FindTeamContinuityMemberAsync(TaskStageStartedEvent @event, Guid organizationId)
    {
        try
        {
            var assignments = await _historyRepository.GetAssignmentsAsync(@event.TaskId);
            if (assignments.Count == 0)
                return null;

            var teamMemberIds = await GetTeamMemberIdsAsync(@event.TeamId, organizationId);
            if (teamMemberIds.Count == 0)
                return null;

            // Assignments come back newest first, so this is the team's latest holder.
            var previousHolder = assignments.FirstOrDefault(a => teamMemberIds.Contains(a.MemberId));
            if (previousHolder == null)
                return null;

            _logger.LogInformation(
                "Stage returns to the team's previous holder. TaskId: {TaskId}, StageName: {StageName}, MemberId: {MemberId}",
                @event.TaskId, @event.StageName, previousHolder.MemberId);

            return previousHolder.MemberId;
        }
        catch (Exception ex)
        {
            // Continuity is a convenience; losing it must not stall the stage.
            _logger.LogWarning(ex,
                "Could not determine the team's previous holder, falling back to workload. TaskId: {TaskId}, StageId: {StageId}",
                @event.TaskId, @event.StageId);
            return null;
        }
    }

    private async Task<HashSet<Guid>> GetTeamMemberIdsAsync(Guid teamId, Guid organizationId)
    {
        var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
            ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

        var response = await GetWithOrgHeaderAsync($"{workflowManagementApiUrl}/teams/{teamId}/members", organizationId);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Failed to read members for team {TeamId}. StatusCode: {StatusCode}",
                teamId, response.StatusCode);
            return new HashSet<Guid>();
        }

        var json = await response.Content.ReadAsStringAsync();
        var members = JsonSerializer.Deserialize<List<MemberInfo>>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        return members?.Select(m => m.MemberId).ToHashSet() ?? new HashSet<Guid>();
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
        var currentMemberTeamId = await GetMemberTeamIdAsync(task.MemberId, task.OrganizationId);
        
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
    private async Task<Guid?> GetMemberTeamIdAsync(Guid? memberId, Guid organizationId)
    {
        if (!memberId.HasValue)
            return null;

        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            var response = await GetWithOrgHeaderAsync($"{workflowManagementApiUrl}/members/{memberId.Value}", organizationId);
            
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

    private async Task<string> GetMemberNameAsync(Guid memberId, Guid organizationId)
    {
        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            var response = await GetWithOrgHeaderAsync($"{workflowManagementApiUrl}/members/{memberId}", organizationId);
            if (!response.IsSuccessStatusCode)
                return memberId.ToString();

            var json = await response.Content.ReadAsStringAsync();
            var memberData = JsonSerializer.Deserialize<MemberInfo>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            var name = $"{memberData?.FirstName} {memberData?.LastName}".Trim();
            return string.IsNullOrEmpty(name) ? memberId.ToString() : name;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not resolve member name. MemberId: {MemberId}", memberId);
            return memberId.ToString();
        }
    }

    private class MemberInfo
    {
        public Guid MemberId { get; set; }
        public Guid? TeamId { get; set; }
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
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
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            // The copy may not exist yet when a stage starts very soon after creation,
            // so this still retries — but it looks the task up by its id rather than
            // scanning every task in the workflow and matching on name.
            WorkflowTaskInfo? workflowTask = null;
            const int maxRetries = 3;
            const int retryDelayMs = 500;

            for (var retry = 0; retry < maxRetries; retry++)
            {
                workflowTask = await FindWorkflowTaskAsync(
                    workflowManagementApiUrl, task.TaskId, task.OrganizationId);

                if (workflowTask != null)
                    break;

                if (retry < maxRetries - 1)
                {
                    _logger.LogInformation(
                        "Task not in WorkflowManagement.API yet, retrying. TaskId: {TaskId}, Retry: {Retry}",
                        task.TaskId, retry);
                    await System.Threading.Tasks.Task.Delay(retryDelayMs);
                }
            }

            if (workflowTask == null)
            {
                _logger.LogWarning(
                    "Could not find task {TaskId} in WorkflowManagement.API to update its stage.",
                    task.TaskId);
                return;
            }

            // Update the task with the stage
            // Use task.SLADeadline instead of workflowTask.DueDate to ensure dueDate is preserved
            // This matches the pattern used in TaskAssignedEventHandler
            DateTime? dueDateUtc = null;
            if (task.SLADeadline.HasValue)
            {
                dueDateUtc = task.SLADeadline.Value.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(task.SLADeadline.Value, DateTimeKind.Utc)
                    : task.SLADeadline.Value.ToUniversalTime();
            }
            else if (workflowTask.DueDate.HasValue)
            {
                // Fallback to existing DueDate if SLADeadline not set yet (edge case)
                dueDateUtc = workflowTask.DueDate.Value.Kind == DateTimeKind.Unspecified
                    ? DateTime.SpecifyKind(workflowTask.DueDate.Value, DateTimeKind.Utc)
                    : workflowTask.DueDate.Value.ToUniversalTime();
            }

            // Note: workflowId is removed - AutoMapper will preserve it from existing task
            var updatePayload = new
            {
                taskName = workflowTask.TaskName,
                description = workflowTask.Description,
                status = workflowTask.Status,
                priority = workflowTask.Priority,
                dueDate = dueDateUtc,
                stageId = @event.StageId,
                assignedToMemberId = workflowTask.AssignedToMemberId,
                completedByMemberIds = workflowTask.CompletedByMemberIds,  // Preserve existing value
                escalatedByMemberIds = workflowTask.EscalatedByMemberIds,  // Preserve existing value
                isOverdue = task.IsOverdue
            };

            var updateResponse = await PutWithOrgHeaderAsync(
                $"{workflowManagementApiUrl}/tasks/{workflowTask.TaskId}",
                updatePayload,
                task.OrganizationId);

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

    /// <summary>
    /// The WorkflowManagement copy of this task, or null if it is not there yet.
    /// Looked up by id: both sides use the same TaskId.
    /// </summary>
    private async Task<WorkflowTaskInfo?> FindWorkflowTaskAsync(
        string workflowManagementApiUrl, Guid taskId, Guid organizationId)
    {
        var response = await GetWithOrgHeaderAsync($"{workflowManagementApiUrl}/tasks/{taskId}", organizationId);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return null;

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "Could not read task {TaskId} from WorkflowManagement.API. StatusCode: {StatusCode}",
                taskId, response.StatusCode);
            return null;
        }

        var json = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<WorkflowTaskInfo>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    private async System.Threading.Tasks.Task<System.Net.Http.HttpResponseMessage> GetWithOrgHeaderAsync(string url, Guid organizationId)
    {
        var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        return await _httpClient.SendAsync(request);
    }

    private async System.Threading.Tasks.Task<System.Net.Http.HttpResponseMessage> PutWithOrgHeaderAsync(string url, object content, Guid organizationId)
    {
        var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Put, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        request.Content = System.Net.Http.Json.JsonContent.Create(content);
        return await _httpClient.SendAsync(request);
    }

    private class WorkflowTaskInfo
    {
        public Guid TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public DateTime? DueDate { get; set; }
        public Guid WorkflowId { get; set; }
        public Guid? StageId { get; set; }
        public Guid? AssignedToMemberId { get; set; }
        public string? CompletedByMemberIds { get; set; }
        public string? EscalatedByMemberIds { get; set; }
    }
}
