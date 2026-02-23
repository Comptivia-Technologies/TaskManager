using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Enums;
using TaskService.Domain.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Json;
using DomainTask = TaskService.Domain.Entities.Task;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskAssignedEvent
/// Updates task with member assignment and syncs to WorkflowManagement.API
/// </summary>
public class TaskAssignedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskAssignedEventHandler> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public TaskAssignedEventHandler(
        ITaskRepository repository,
        ILogger<TaskAssignedEventHandler> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _repository = repository;
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskAssignedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received TaskAssignedEvent. TaskId: {TaskId}, AssignmentId: {AssignmentId}, MemberId: {MemberId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.AssignmentId, @event.MemberId, correlationId);

            // Idempotency check - skip only if same AssignmentId AND same MemberId
            // This allows reassignments (same AssignmentId, different MemberId) to be processed
            var existingTask = await _repository.GetByEventIdAsync("TaskAssignedEvent", @event.AssignmentId);
            if (existingTask != null && existingTask.TaskAssignedEventId == @event.AssignmentId)
            {
                // Check if member is actually different - if so, it's a reassignment and should be processed
                if (existingTask.MemberId == @event.MemberId)
                {
                    _logger.LogWarning(
                        "TaskAssignedEvent already processed (same member). TaskId: {TaskId}, AssignmentId: {AssignmentId}, MemberId: {MemberId}, CorrelationId: {CorrelationId}",
                        @event.TaskId, @event.AssignmentId, @event.MemberId, correlationId);
                    return;
                }
                else
                {
                    _logger.LogInformation(
                        "TaskAssignedEvent is a reassignment (different member). Processing. TaskId: {TaskId}, AssignmentId: {AssignmentId}, OldMemberId: {OldMemberId}, NewMemberId: {NewMemberId}, CorrelationId: {CorrelationId}",
                        @event.TaskId, @event.AssignmentId, existingTask.MemberId, @event.MemberId, correlationId);
                }
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskAssignedEvent. TaskId: {TaskId}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}. Will retry later.",
                    @event.TaskId, @event.AssignmentId, correlationId);
                // Don't throw - task might be created later, EventBus will retry
                return;
            }

            _logger.LogInformation(
                "Task found for assignment. TaskId: {TaskId}, Current Priority: {Priority}, WorkflowId: {WorkflowId}",
                task.TaskId, task.Priority, task.WorkflowId);

            // Update task with member assignment
            task.MemberId = @event.MemberId;
            task.Status = DomainTaskStatus.Assigned;
            task.TaskAssignedEventId = @event.AssignmentId; // Store AssignmentId for idempotency
            // Preserve other event IDs (don't overwrite)
            // WorkflowSelectedEventId and SLAConfiguredEventId should already be set
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);
            
            _logger.LogInformation(
                "Task updated with member assignment. TaskId: {TaskId}, Priority: {Priority}, MemberId: {MemberId}",
                task.TaskId, task.Priority, task.MemberId);

            _logger.LogInformation(
                "Task assigned to member. TaskId: {TaskId}, MemberId: {MemberId}, MemberName: {MemberName}, WorkloadScore: {WorkloadScore}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}. Task updated in database.",
                @event.TaskId, @event.MemberId, @event.MemberName, @event.WorkloadScore, @event.AssignmentId, correlationId);

            // Refresh task from database to get latest priority (in case PriorityAssignedEvent updated it)
            // This ensures we sync the most up-to-date priority to WorkflowManagement.API
            task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning("Task not found after update. TaskId: {TaskId}", @event.TaskId);
                return;
            }

            _logger.LogInformation(
                "Refreshed task before sync. TaskId: {TaskId}, Priority: {Priority}, WorkflowId: {WorkflowId}",
                task.TaskId, task.Priority, task.WorkflowId);

            // Sync task to WorkflowManagement.API so frontend can see it
            await SyncTaskToWorkflowManagementAPIAsync(task);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskAssignedEvent. TaskId: {TaskId}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.AssignmentId, correlationId);
            throw;
        }
    }

    /// <summary>
    /// Syncs task to WorkflowManagement.API so frontend can display it
    /// Creates new task if not exists, updates if already exists (for reassignments)
    /// </summary>
    private async System.Threading.Tasks.Task SyncTaskToWorkflowManagementAPIAsync(DomainTask task)
    {
        try
        {
            // Only sync if task has both WorkflowId and MemberId (fully assigned)
            if (!task.WorkflowId.HasValue || !task.MemberId.HasValue)
            {
                _logger.LogWarning(
                    "Task not fully assigned, skipping sync. TaskId: {TaskId}, WorkflowId: {WorkflowId}, MemberId: {MemberId}",
                    task.TaskId, task.WorkflowId, task.MemberId);
                return;
            }

            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            // Map task to WorkflowManagement.API format
            var statusString = task.Status.ToString();
            if (statusString == "InProgress")
            {
                statusString = "In Progress";
            }
            // Removed: Map Assigned to Pending - WorkloadService handles both statuses

            // First, check if task already exists in WorkflowManagement.API
            var searchResponse = await GetWithOrgHeaderAsync(
                $"{workflowManagementApiUrl}/tasks/workflow/{task.WorkflowId.Value}",
                task.OrganizationId);

            WorkflowTaskInfo? existingWorkflowTask = null;
            if (searchResponse.IsSuccessStatusCode)
            {
                var tasksJson = await searchResponse.Content.ReadAsStringAsync();
                var tasks = System.Text.Json.JsonSerializer.Deserialize<List<WorkflowTaskInfo>>(tasksJson, new System.Text.Json.JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                // Find existing task by name (or description containing TaskId)
                existingWorkflowTask = tasks?.FirstOrDefault(t => 
                    t.TaskName == task.TaskName || 
                    (t.Description != null && t.Description.Contains(task.TaskId.ToString())));

                if (existingWorkflowTask != null)
                {
                    _logger.LogInformation(
                        "Found existing task in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, CurrentAssignedMemberId: {CurrentMemberId}",
                        task.TaskId, existingWorkflowTask.TaskId, existingWorkflowTask.AssignedToMemberId);
                }
            }

            if (existingWorkflowTask != null)
            {
                // UPDATE existing task
                // Build CompletedByMemberIds - append previous member if this is a reassignment
                // BUT only if the reassignment is due to stage completion, NOT escalation
                var completedByMemberIds = existingWorkflowTask.CompletedByMemberIds ?? "";
                var escalatedByMemberIds = existingWorkflowTask.EscalatedByMemberIds ?? "";
                
                if (existingWorkflowTask.AssignedToMemberId.HasValue && 
                    existingWorkflowTask.AssignedToMemberId.Value != task.MemberId.Value)
                {
                    // Check if this reassignment is due to escalation (should NOT credit previous member for completion)
                    // If task has escalation event IDs set, it means the last stage transition was via escalation
                    bool isEscalationReassignment = task.TaskStageEscalatedEventId.HasValue || 
                                                    task.TaskStageEscalationTriggeredEventId.HasValue;
                    
                    if (!isEscalationReassignment)
                    {
                        // This is a reassignment due to stage completion - credit the previous member
                        var previousMemberId = existingWorkflowTask.AssignedToMemberId.Value.ToString();
                        if (string.IsNullOrEmpty(completedByMemberIds))
                        {
                            completedByMemberIds = previousMemberId;
                        }
                        else if (!completedByMemberIds.Split(',').Contains(previousMemberId))
                        {
                            completedByMemberIds += "," + previousMemberId;
                        }
                        
                        _logger.LogInformation(
                            "Stage reassignment: crediting previous member for stage completion. TaskId: {TaskId}, PreviousMemberId: {PreviousMemberId}, NewMemberId: {NewMemberId}, CompletedByMemberIds: {CompletedByMemberIds}",
                            task.TaskId, previousMemberId, task.MemberId.Value, completedByMemberIds);
                    }
                    else
                    {
                        // This is a reassignment due to escalation - credit the previous member for escalation
                        var previousMemberId = existingWorkflowTask.AssignedToMemberId.Value.ToString();
                        if (string.IsNullOrEmpty(escalatedByMemberIds))
                        {
                            escalatedByMemberIds = previousMemberId;
                        }
                        else if (!escalatedByMemberIds.Split(',').Contains(previousMemberId))
                        {
                            escalatedByMemberIds += "," + previousMemberId;
                        }
                        
                        _logger.LogInformation(
                            "Stage reassignment due to escalation: crediting previous member for escalation. TaskId: {TaskId}, PreviousMemberId: {PreviousMemberId}, NewMemberId: {NewMemberId}, EscalatedByMemberIds: {EscalatedByMemberIds}",
                            task.TaskId, previousMemberId, task.MemberId.Value, escalatedByMemberIds);
                    }
                }

                // Ensure DueDate is UTC (PostgreSQL requires UTC for timestamp with time zone)
                DateTime? dueDateUtc = null;
                if (task.SLADeadline.HasValue)
                {
                    dueDateUtc = task.SLADeadline.Value.Kind == DateTimeKind.Unspecified
                        ? DateTime.SpecifyKind(task.SLADeadline.Value, DateTimeKind.Utc)
                        : task.SLADeadline.Value.ToUniversalTime();
                }

                var taskUpdateDto = new
                {
                    TaskName = task.TaskName,
                    Description = task.Description,
                    Status = statusString,
                    Priority = task.Priority,
                    DueDate = dueDateUtc,
                    // WorkflowId removed - AutoMapper will preserve it from existing task
                    StageId = task.CurrentStageId,
                    AssignedToMemberId = task.MemberId.Value,
                    CompletedByMemberIds = string.IsNullOrEmpty(completedByMemberIds) ? null : completedByMemberIds,
                    EscalatedByMemberIds = string.IsNullOrEmpty(escalatedByMemberIds) ? null : escalatedByMemberIds,
                    IsOverdue = task.IsOverdue
                };

                _logger.LogInformation(
                    "Updating existing task in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, NewMemberId: {MemberId}",
                    task.TaskId, existingWorkflowTask.TaskId, task.MemberId.Value);

                var updateResponse = await PutWithOrgHeaderAsync(
                    $"{workflowManagementApiUrl}/tasks/{existingWorkflowTask.TaskId}",
                    taskUpdateDto,
                    task.OrganizationId);

                if (updateResponse.IsSuccessStatusCode)
                {
                    var responseContent = await updateResponse.Content.ReadAsStringAsync();
                    _logger.LogInformation(
                        "Task updated in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, Response: {Response}",
                        task.TaskId, existingWorkflowTask.TaskId, responseContent);
                }
                else
                {
                    var errorContent = await updateResponse.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "Failed to update task in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, Status: {Status}, Error: {Error}",
                        task.TaskId, existingWorkflowTask.TaskId, updateResponse.StatusCode, errorContent);
                }
            }
            else
            {
                // Ensure DueDate is UTC (PostgreSQL requires UTC for timestamp with time zone)
                DateTime? dueDateUtc = null;
                if (task.SLADeadline.HasValue)
                {
                    dueDateUtc = task.SLADeadline.Value.Kind == DateTimeKind.Unspecified
                        ? DateTime.SpecifyKind(task.SLADeadline.Value, DateTimeKind.Utc)
                        : task.SLADeadline.Value.ToUniversalTime();
                }

                // CREATE new task
                var taskCreateDto = new
                {
                    TaskId = task.TaskId,  // Preserve TaskId for sync
                    TaskName = task.TaskName,
                    Description = task.Description,
                    Status = statusString,
                    Priority = task.Priority,
                    DueDate = dueDateUtc,
                    WorkflowId = task.WorkflowId.Value,
                    StageId = task.CurrentStageId,
                    AssignedToMemberId = task.MemberId.Value
                };
                
                _logger.LogInformation(
                    "Creating new task in WorkflowManagement.API. TaskId: {TaskId}, Priority: {Priority}",
                    task.TaskId, task.Priority);

                var response = await PostWithOrgHeaderAsync(
                    $"{workflowManagementApiUrl}/tasks",
                    taskCreateDto,
                    task.OrganizationId);

                if (response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation(
                        "Task created in WorkflowManagement.API. TaskId: {TaskId}, Response: {Response}",
                        task.TaskId, responseContent);
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning(
                        "Failed to create task in WorkflowManagement.API. TaskId: {TaskId}, Status: {Status}, Error: {Error}",
                        task.TaskId, response.StatusCode, errorContent);
                }
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't break the flow
            _logger.LogError(ex,
                "Error syncing task to WorkflowManagement.API. TaskId: {TaskId}",
                task.TaskId);
        }
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

    private async System.Threading.Tasks.Task<System.Net.Http.HttpResponseMessage> PostWithOrgHeaderAsync(string url, object content, Guid organizationId)
    {
        var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        request.Content = System.Net.Http.Json.JsonContent.Create(content);
        return await _httpClient.SendAsync(request);
    }

    private class WorkflowTaskInfo
    {
        public Guid TaskId { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public Guid? AssignedToMemberId { get; set; }
        public string? CompletedByMemberIds { get; set; }
        public string? EscalatedByMemberIds { get; set; }
    }
}

