using System.Net.Http;
using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Domain.Enums;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Json;
using DomainTask = TaskService.Domain.Entities.Task;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.Services;

/// <summary>
/// Task service implementation
/// </summary>
public class TaskService : ITaskService
{
    private readonly ITaskRepository _repository;
    private readonly ITaskStageHistoryRepository _historyRepository;
    private readonly ITaskStageDataRepository _stageDataRepository;
    private readonly ITaskStageNominationRepository _nominationRepository;
    private readonly IEventBus _eventBus;
    private readonly ILogger<TaskService> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public TaskService(
        ITaskRepository repository,
        ITaskStageHistoryRepository historyRepository,
        ITaskStageDataRepository stageDataRepository,
        ITaskStageNominationRepository nominationRepository,
        IEventBus eventBus,
        ILogger<TaskService> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        IHttpContextAccessor httpContextAccessor)
    {
        _repository = repository;
        _historyRepository = historyRepository;
        _stageDataRepository = stageDataRepository;
        _nominationRepository = nominationRepository;
        _eventBus = eventBus;
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
        _httpContextAccessor = httpContextAccessor;
    }

    public async System.Threading.Tasks.Task<TaskReadDto> CreateTaskAsync(TaskCreateDto createDto)
    {
        var orgIdHeader = _httpContextAccessor.HttpContext?.Request.Headers["X-Organization-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(orgIdHeader) || !Guid.TryParse(orgIdHeader, out var organizationId))
            throw new UnauthorizedAccessException("Organization context required (X-Organization-Id header).");

        var task = new DomainTask
        {
            TaskId = Guid.NewGuid(),
            OrganizationId = organizationId,
            TaskName = createDto.TaskName,
            Description = createDto.Description,
            Priority = createDto.Priority,
            TaskType = createDto.TaskType,
            Status = DomainTaskStatus.Created,
            CreatedByMemberId = createDto.CreatedByMemberId,
            DataJson = createDto.TaskData != null && createDto.TaskData.Count > 0
                ? System.Text.Json.JsonSerializer.Serialize(createDto.TaskData)
                : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var createdTask = await _repository.CreateAsync(task);

        // Publish TaskCreatedEvent
        var correlationId = Guid.NewGuid();
        var taskCreatedEvent = new TaskCreatedEvent
        {
            TaskId = createdTask.TaskId,
            OrganizationId = organizationId,
            TaskName = createdTask.TaskName,
            Description = createdTask.Description,
            Priority = createdTask.Priority,
            TaskType = createdTask.TaskType,
            TaskData = createDto.TaskData,
            // A manually raised enquiry goes to whoever raised it, not a workload pick.
            PreferredMemberId = createDto.CreatedByMemberId,
            PriorityAssigned = false,
            CreatedAt = createdTask.CreatedAt,
            CorrelationId = correlationId
        };

        await _eventBus.PublishAsync(
            taskCreatedEvent,
            EventBusConstants.TaskSource,
            EventBusConstants.TaskCreated,
            correlationId);

        _logger.LogInformation(
            "Task created and TaskCreatedEvent published. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
            createdTask.TaskId, correlationId);

        return MapToDto(createdTask);
    }

    public async System.Threading.Tasks.Task<TaskReadDto?> GetTaskByIdAsync(Guid taskId)
    {
        var task = await _repository.GetByIdAsync(taskId);
        return task == null ? null : MapToDto(task);
    }

    public async System.Threading.Tasks.Task UpdateTaskStatusAsync(Guid taskId, DomainTaskStatus newStatus)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        var oldStatus = task.Status;
        task.Status = newStatus;
        task.UpdatedAt = DateTime.UtcNow;

        await _repository.UpdateAsync(task);

        // Sync status update to WorkflowManagement.API so WorkloadService can see it
        await SyncTaskStatusToWorkflowManagementAPIAsync(task, newStatus);

        // Publish TaskStatusUpdatedEvent
        var correlationId = Guid.NewGuid();
        var statusUpdatedEvent = new TaskStatusUpdatedEvent
        {
            TaskId = taskId,
            PreviousStatus = oldStatus.ToString(),
            NewStatus = newStatus.ToString(),
            UpdatedAt = DateTime.UtcNow,
            CorrelationId = correlationId
        };

        await _eventBus.PublishAsync(
            statusUpdatedEvent,
            EventBusConstants.TaskSource,
            EventBusConstants.TaskStatusUpdated,
            correlationId);

        _logger.LogInformation(
            "Task status updated. TaskId: {TaskId}, {OldStatus} → {NewStatus}, CorrelationId: {CorrelationId}",
            taskId, oldStatus, newStatus, correlationId);
    }

    /// <summary>
    /// Syncs task status to WorkflowManagement.API so WorkloadService can see the update
    /// Since TaskService uses Guid TaskId and WorkflowManagement.API uses Guid TaskId,
    /// we find the task by matching TaskName and update it.
    /// </summary>
    private async System.Threading.Tasks.Task SyncTaskStatusToWorkflowManagementAPIAsync(DomainTask task, DomainTaskStatus newStatus)
    {
        try
        {
            // Only sync if task has both WorkflowId and MemberId (fully assigned)
            if (!task.WorkflowId.HasValue || !task.MemberId.HasValue)
            {
                _logger.LogWarning(
                    "Task not fully assigned, skipping status sync. TaskId: {TaskId}, WorkflowId: {WorkflowId}, MemberId: {MemberId}",
                    task.TaskId, task.WorkflowId, task.MemberId);
                return;
            }

            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            // Map status to WorkflowManagement.API format (string)
            // WorkloadService expects "In Progress" (with space), not "InProgress"
            var statusString = newStatus.ToString();
            if (statusString == "InProgress")
            {
                statusString = "In Progress";
            }
            // Removed: Map Assigned to Pending - WorkloadService handles both statuses

            // Get all tasks for this workflow (send org for WorkflowManagement.API)
            var tasksResponse = await GetWithOrgHeaderAsync(
                $"{workflowManagementApiUrl}/tasks/workflow/{task.WorkflowId.Value}",
                task.OrganizationId);

            if (tasksResponse.IsSuccessStatusCode)
            {
                var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
                
                // Parse JSON to find task by name
                // WorkflowManagement.API returns PascalCase properties
                using var jsonDoc = System.Text.Json.JsonDocument.Parse(tasksJson);
                var tasksArray = jsonDoc.RootElement.EnumerateArray();
                
                Guid? matchingTaskId = null;
                foreach (var taskElement in tasksArray)
                {
                    // Try both camelCase and PascalCase property names
                    var taskNameProp = taskElement.TryGetProperty("taskName", out var camelCaseName) ? camelCaseName :
                                      taskElement.TryGetProperty("TaskName", out var pascalCaseName) ? pascalCaseName : default;
                    
                    if (taskNameProp.ValueKind != System.Text.Json.JsonValueKind.Undefined &&
                        taskNameProp.GetString() == task.TaskName)
                    {
                        var taskIdProp = taskElement.TryGetProperty("taskId", out var camelCaseId) ? camelCaseId :
                                        taskElement.TryGetProperty("TaskId", out var pascalCaseId) ? pascalCaseId : default;
                        
                        if (taskIdProp.ValueKind != System.Text.Json.JsonValueKind.Undefined)
                        {
                            matchingTaskId = taskIdProp.GetGuid();
                            break;
                        }
                    }
                }

                if (matchingTaskId.HasValue)
                {
                    // Get existing task to preserve CompletedByMemberIds and EscalatedByMemberIds
                    var existingTaskResponse = await GetWithOrgHeaderAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        task.OrganizationId);
                    
                    string? existingCompletedByMemberIds = null;
                    string? existingEscalatedByMemberIds = null;
                    if (existingTaskResponse.IsSuccessStatusCode)
                    {
                        var existingTaskJson = await existingTaskResponse.Content.ReadAsStringAsync();
                        var existingTask = System.Text.Json.JsonSerializer.Deserialize<WorkflowTaskInfo>(existingTaskJson, new System.Text.Json.JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true
                        });
                        existingCompletedByMemberIds = existingTask?.CompletedByMemberIds;
                        existingEscalatedByMemberIds = existingTask?.EscalatedByMemberIds;
                    }

                    // Ensure DueDate is UTC (PostgreSQL requires UTC for timestamp with time zone)
                    DateTime? dueDateUtc = null;
                    if (task.SLADeadline.HasValue)
                    {
                        dueDateUtc = task.SLADeadline.Value.Kind == DateTimeKind.Unspecified
                            ? DateTime.SpecifyKind(task.SLADeadline.Value, DateTimeKind.Utc)
                            : task.SLADeadline.Value.ToUniversalTime();
                    }

                    // Update the task status via WorkflowManagement.API
                    // Note: WorkflowId removed - AutoMapper will preserve it from existing task
                    var updateDto = new
                    {
                        TaskName = task.TaskName,
                        Description = task.Description,
                        Status = statusString,
                        Priority = task.Priority,
                        DueDate = dueDateUtc,
                        StageId = task.CurrentStageId, // Preserve current stage instead of null
                        AssignedToMemberId = task.MemberId.Value,
                        CompletedByMemberIds = existingCompletedByMemberIds,  // Preserve existing value
                        EscalatedByMemberIds = existingEscalatedByMemberIds,  // Preserve existing value
                        IsOverdue = task.IsOverdue
                    };

                    var updateResponse = await PutWithOrgHeaderAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        updateDto,
                        task.OrganizationId);

                    if (updateResponse.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "Task status synced to WorkflowManagement.API. TaskId: {TaskId}, WorkflowManagementTaskId: {WorkflowTaskId}, Status: {Status}",
                            task.TaskId, matchingTaskId.Value, statusString);
                    }
                    else
                    {
                        var errorContent = await updateResponse.Content.ReadAsStringAsync();
                        _logger.LogWarning(
                            "Failed to update task status in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, Status: {Status}, Error: {Error}",
                            task.TaskId, matchingTaskId.Value, statusString, errorContent);
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Task not found in WorkflowManagement.API for status sync. TaskId: {TaskId}, TaskName: {TaskName}, WorkflowId: {WorkflowId}",
                        task.TaskId, task.TaskName, task.WorkflowId);
                }
            }
            else
            {
                _logger.LogWarning(
                    "Could not fetch tasks from WorkflowManagement.API for status sync. TaskId: {TaskId}, Status: {Status}, StatusCode: {StatusCode}",
                    task.TaskId, statusString, tasksResponse.StatusCode);
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't break the flow
            _logger.LogError(ex,
                "Error syncing task status to WorkflowManagement.API. TaskId: {TaskId}",
                task.TaskId);
        }
    }

    public async System.Threading.Tasks.Task SyncTaskStatusToWorkflowManagementAsync(Guid taskId)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
        {
            _logger.LogWarning("SyncTaskStatusToWorkflowManagementAsync: task not found. TaskId: {TaskId}", taskId);
            return;
        }

        await SyncTaskStatusToWorkflowManagementAPIAsync(task, task.Status);
    }

    public async System.Threading.Tasks.Task SyncAllOverdueTasksAsync()
    {
        // Get all tasks that are already marked as overdue (IsOverdue = true, Status = Overdue)
        var overdueTasks = await _repository.GetAlreadyOverdueTasksAsync();
        var overdueTasksList = overdueTasks.ToList();
        
        _logger.LogInformation(
            "Found {Count} overdue tasks in TaskService database. Syncing to WorkflowManagement.API",
            overdueTasksList.Count);
        
        int syncedCount = 0;
        int failedCount = 0;
        int skippedCount = 0;
        int notFoundCount = 0; // Count tasks not found in TaskService DB
        
        foreach (var task in overdueTasksList)
        {
            try
            {
                // Verify task still exists in TaskService database
                var existingTask = await _repository.GetByIdAsync(task.TaskId);
                if (existingTask == null)
                {
                    _logger.LogWarning(
                        "Task not found in TaskService database. Skipping sync. TaskId: {TaskId}",
                        task.TaskId);
                    notFoundCount++;
                    continue;
                }
                
                // Only sync if task has both WorkflowId and MemberId (fully assigned)
                if (!existingTask.WorkflowId.HasValue || !existingTask.MemberId.HasValue)
                {
                    _logger.LogDebug(
                        "Skipping overdue task sync - not fully assigned. TaskId: {TaskId}, WorkflowId: {WorkflowId}, MemberId: {MemberId}",
                        existingTask.TaskId, existingTask.WorkflowId, existingTask.MemberId);
                    skippedCount++;
                    continue;
                }
                
                // Only sync if task is still overdue in TaskService DB
                if (!existingTask.IsOverdue || existingTask.Status != DomainTaskStatus.Overdue)
                {
                    _logger.LogDebug(
                        "Skipping task sync - no longer overdue in TaskService DB. TaskId: {TaskId}, IsOverdue: {IsOverdue}, Status: {Status}",
                        existingTask.TaskId, existingTask.IsOverdue, existingTask.Status);
                    skippedCount++;
                    continue;
                }
                
                // Sync each overdue task (only tasks that exist in TaskService DB)
                await SyncTaskStatusToWorkflowManagementAPIAsync(existingTask, DomainTaskStatus.Overdue);
                syncedCount++;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to sync overdue task. TaskId: {TaskId}, TaskName: {TaskName}",
                    task.TaskId, task.TaskName);
                failedCount++;
            }
        }
        
        _logger.LogInformation(
            "Overdue tasks sync completed. Synced: {SyncedCount}, Failed: {FailedCount}, Skipped: {SkippedCount}, Not Found in TaskService DB: {NotFoundCount}",
            syncedCount, failedCount, skippedCount, notFoundCount);
    }

    public async System.Threading.Tasks.Task<bool> DeleteTaskAsync(Guid taskId)
    {
        // Get task from TaskService database
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
        {
            _logger.LogWarning("Task not found in TaskService database. TaskId: {TaskId}", taskId);
            return false;
        }

        // Sync deletion to WorkflowManagement.API first (before deleting from TaskService)
        await SyncTaskDeletionToWorkflowManagementAPIAsync(task);

        // Delete from TaskService database
        var deleted = await _repository.DeleteAsync(taskId);
        
        if (deleted)
        {
            _logger.LogInformation(
                "Task deleted from TaskService database. TaskId: {TaskId}, TaskName: {TaskName}",
                taskId, task.TaskName);
        }

        return deleted;
    }

    /// <summary>
    /// Syncs task deletion to WorkflowManagement.API
    /// Since TaskService uses Guid TaskId and WorkflowManagement.API uses Guid TaskId,
    /// we find the task by matching TaskName and delete it.
    /// </summary>
    private async System.Threading.Tasks.Task SyncTaskDeletionToWorkflowManagementAPIAsync(DomainTask task)
    {
        try
        {
            // Only sync if task has WorkflowId (needed to find tasks in WorkflowManagement.API)
            if (!task.WorkflowId.HasValue)
            {
                _logger.LogWarning(
                    "Task has no WorkflowId, skipping deletion sync. TaskId: {TaskId}, TaskName: {TaskName}",
                    task.TaskId, task.TaskName);
                return;
            }

            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            // Get all tasks for this workflow (send org for WorkflowManagement.API)
            var tasksResponse = await GetWithOrgHeaderAsync(
                $"{workflowManagementApiUrl}/tasks/workflow/{task.WorkflowId.Value}",
                task.OrganizationId);

            if (tasksResponse.IsSuccessStatusCode)
            {
                var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
                
                // Parse JSON to find task by name
                using var jsonDoc = System.Text.Json.JsonDocument.Parse(tasksJson);
                var tasksArray = jsonDoc.RootElement.EnumerateArray();
                
                Guid? matchingTaskId = null;
                foreach (var taskElement in tasksArray)
                {
                    // Try both camelCase and PascalCase property names
                    var taskNameProp = taskElement.TryGetProperty("taskName", out var camelCaseName) ? camelCaseName :
                                      taskElement.TryGetProperty("TaskName", out var pascalCaseName) ? pascalCaseName : default;
                    
                    if (taskNameProp.ValueKind != System.Text.Json.JsonValueKind.Undefined &&
                        taskNameProp.GetString() == task.TaskName)
                    {
                        var taskIdProp = taskElement.TryGetProperty("taskId", out var camelCaseId) ? camelCaseId :
                                        taskElement.TryGetProperty("TaskId", out var pascalCaseId) ? pascalCaseId : default;
                        
                        if (taskIdProp.ValueKind != System.Text.Json.JsonValueKind.Undefined)
                        {
                            matchingTaskId = taskIdProp.GetGuid();
                            break;
                        }
                    }
                }

                if (matchingTaskId.HasValue)
                {
                    // Delete the task via WorkflowManagement.API
                    var deleteResponse = await DeleteWithOrgHeaderAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        task.OrganizationId);

                    if (deleteResponse.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "Task deleted from WorkflowManagement.API. TaskId: {TaskId}, WorkflowManagementTaskId: {WorkflowTaskId}, TaskName: {TaskName}",
                            task.TaskId, matchingTaskId.Value, task.TaskName);
                    }
                    else
                    {
                        var errorContent = await deleteResponse.Content.ReadAsStringAsync();
                        _logger.LogWarning(
                            "Failed to delete task from WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, TaskName: {TaskName}, Error: {Error}",
                            task.TaskId, matchingTaskId.Value, task.TaskName, errorContent);
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Task not found in WorkflowManagement.API for deletion sync. TaskId: {TaskId}, TaskName: {TaskName}, WorkflowId: {WorkflowId}",
                        task.TaskId, task.TaskName, task.WorkflowId);
                }
            }
            else
            {
                _logger.LogWarning(
                    "Could not fetch tasks from WorkflowManagement.API for deletion sync. TaskId: {TaskId}, TaskName: {TaskName}, StatusCode: {StatusCode}",
                    task.TaskId, task.TaskName, tasksResponse.StatusCode);
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't prevent deletion from TaskService
            _logger.LogError(ex,
                "Error syncing task deletion to WorkflowManagement.API. TaskId: {TaskId}, TaskName: {TaskName}",
                task.TaskId, task.TaskName);
        }
    }

    public async System.Threading.Tasks.Task CleanupOrphanedTasksAsync()
    {
        try
        {
            // Get all task names from TaskService database
            var taskServiceTaskNames = await _repository.GetAllTaskNamesAsync();
            var taskServiceTaskNamesSet = new HashSet<string>(taskServiceTaskNames, StringComparer.OrdinalIgnoreCase);
            
            var orgIds = await _repository.GetDistinctOrganizationIdsAsync();
            var orgIdsList = orgIds.ToList();
            
            _logger.LogInformation(
                "Found {Count} tasks in TaskService database, {OrgCount} organizations. Checking for orphaned tasks in WorkflowManagement.API",
                taskServiceTaskNamesSet.Count, orgIdsList.Count);

            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            int deletedCount = 0;
            int failedCount = 0;
            int skippedCount = 0;

            foreach (var orgId in orgIdsList)
            {
                var tasksResponse = await GetWithOrgHeaderAsync($"{workflowManagementApiUrl}/tasks", orgId);
                if (!tasksResponse.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Could not fetch tasks from WorkflowManagement.API for cleanup. OrgId: {OrgId}, StatusCode: {StatusCode}",
                        orgId, tasksResponse.StatusCode);
                    continue;
                }

                var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
                using var jsonDoc = System.Text.Json.JsonDocument.Parse(tasksJson);
                var tasksArray = jsonDoc.RootElement.EnumerateArray();

                foreach (var taskElement in tasksArray)
                {
                    try
                    {
                        var taskNameProp = taskElement.TryGetProperty("taskName", out var camelCaseName) ? camelCaseName :
                                          taskElement.TryGetProperty("TaskName", out var pascalCaseName) ? pascalCaseName : default;
                        
                        var taskIdProp = taskElement.TryGetProperty("taskId", out var camelCaseId) ? camelCaseId :
                                        taskElement.TryGetProperty("TaskId", out var pascalCaseId) ? pascalCaseId : default;

                        if (taskNameProp.ValueKind == System.Text.Json.JsonValueKind.Undefined ||
                            taskIdProp.ValueKind == System.Text.Json.JsonValueKind.Undefined)
                        {
                            skippedCount++;
                            continue;
                        }

                        var taskName = taskNameProp.GetString();
                        var workflowTaskId = taskIdProp.GetGuid();

                        if (taskName != null && taskServiceTaskNamesSet.Contains(taskName))
                            continue;

                        _logger.LogInformation(
                            "Found orphaned task in WorkflowManagement.API. TaskName: {TaskName}, WorkflowTaskId: {WorkflowTaskId}. Deleting...",
                            taskName, workflowTaskId);

                        var deleteResponse = await DeleteWithOrgHeaderAsync(
                            $"{workflowManagementApiUrl}/tasks/{workflowTaskId}",
                            orgId);

                        if (deleteResponse.IsSuccessStatusCode)
                        {
                            deletedCount++;
                            _logger.LogInformation(
                                "Deleted orphaned task from WorkflowManagement.API. TaskName: {TaskName}, WorkflowTaskId: {WorkflowTaskId}",
                                taskName, workflowTaskId);
                        }
                        else
                        {
                            failedCount++;
                            var errorContent = await deleteResponse.Content.ReadAsStringAsync();
                            _logger.LogWarning(
                                "Failed to delete orphaned task from WorkflowManagement.API. TaskName: {TaskName}, WorkflowTaskId: {WorkflowTaskId}, Error: {Error}",
                                taskName, workflowTaskId, errorContent);
                        }
                    }
                    catch (Exception ex)
                    {
                        failedCount++;
                        _logger.LogError(ex, "Error processing task during cleanup");
                    }
                }
            }

            _logger.LogInformation(
                "Cleanup completed. Deleted: {DeletedCount}, Failed: {FailedCount}, Skipped: {SkippedCount}",
                deletedCount, failedCount, skippedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during orphaned tasks cleanup");
            throw;
        }
    }

    /// <summary>
    /// Syncs all tasks from WorkflowManagement.API to TaskService
    /// Useful for initial sync or fixing orphaned tasks
    /// </summary>
    public async System.Threading.Tasks.Task SyncAllTasksFromWorkflowManagementAsync()
    {
        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

            // Get all tasks from WorkflowManagement.API
            var tasksResponse = await _httpClient.GetAsync($"{workflowManagementApiUrl}/tasks");
            
            if (!tasksResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Could not fetch tasks from WorkflowManagement.API for sync. StatusCode: {StatusCode}",
                    tasksResponse.StatusCode);
                return;
            }

            var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
            using var jsonDoc = System.Text.Json.JsonDocument.Parse(tasksJson);
            var tasksArray = jsonDoc.RootElement.EnumerateArray();

            int syncedCount = 0;
            int failedCount = 0;
            int skippedCount = 0;

            foreach (var taskElement in tasksArray)
            {
                try
                {
                    var taskId = GetGuidPropertyFromJson(taskElement, "taskId", "TaskId");
                    var taskName = GetStringPropertyFromJson(taskElement, "taskName", "TaskName");
                    var description = GetStringPropertyFromJson(taskElement, "description", "Description");
                    var status = GetStringPropertyFromJson(taskElement, "status", "Status") ?? "Created";
                    var priority = GetStringPropertyFromJson(taskElement, "priority", "Priority") ?? "Medium";
                    var workflowId = GetGuidPropertyFromJson(taskElement, "workflowId", "WorkflowId");
                    var stageId = GetGuidPropertyFromJson(taskElement, "stageId", "StageId");
                    var assignedToMemberId = GetGuidPropertyFromJson(taskElement, "assignedToMemberId", "AssignedToMemberId");
                    var dueDateStr = GetStringPropertyFromJson(taskElement, "dueDate", "DueDate");
                    var isOverdue = GetBoolPropertyFromJson(taskElement, "isOverdue", "IsOverdue") ?? false;

                    DateTime? dueDate = null;
                    if (dueDateStr != null && DateTime.TryParse(dueDateStr, out var parsedDate))
                    {
                        dueDate = parsedDate.ToUniversalTime();
                    }

                    if (!taskId.HasValue || string.IsNullOrEmpty(taskName) || !workflowId.HasValue)
                    {
                        _logger.LogWarning("Skipping task sync - missing required fields. TaskId: {TaskId}, TaskName: {TaskName}, WorkflowId: {WorkflowId}",
                            taskId, taskName, workflowId);
                        skippedCount++;
                        continue;
                    }

                    await SyncTaskFromWorkflowManagementAsync(
                        taskId.Value,
                        taskName,
                        description,
                        status,
                        priority,
                        workflowId.Value,
                        stageId,
                        assignedToMemberId,
                        dueDate,
                        isOverdue);

                    syncedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to sync task from WorkflowManagement.API");
                    failedCount++;
                }
            }

            _logger.LogInformation(
                "Task sync from WorkflowManagement.API completed. Synced: {SyncedCount}, Failed: {FailedCount}, Skipped: {SkippedCount}",
                syncedCount, failedCount, skippedCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing all tasks from WorkflowManagement.API");
            throw;
        }
    }

    /// <summary>
    /// Syncs task from WorkflowManagement.API to TaskService database
    /// Creates task in TaskService if it doesn't exist, updates if it exists
    /// </summary>
    private async System.Threading.Tasks.Task SyncTaskFromWorkflowManagementAsync(
        Guid taskId,
        string taskName,
        string? description,
        string status,
        string priority,
        Guid workflowId,
        Guid? stageId,
        Guid? assignedToMemberId,
        DateTime? dueDate,
        bool isOverdue)
    {
        try
        {
            // Check if task already exists in TaskService
            var existingTask = await _repository.GetByIdAsync(taskId);
            
            // Map status string to enum
            DomainTaskStatus taskStatus;
            if (Enum.TryParse<DomainTaskStatus>(status, ignoreCase: true, out var parsedStatus))
            {
                taskStatus = parsedStatus;
            }
            else if (status == "In Progress")
            {
                taskStatus = DomainTaskStatus.InProgress;
            }
            else
            {
                taskStatus = DomainTaskStatus.Created; // Default
            }

            if (existingTask == null)
            {
                // Create new task in TaskService
                var newTask = new DomainTask
                {
                    TaskId = taskId,
                    TaskName = taskName,
                    Description = description,
                    Priority = priority,
                    TaskType = "Manual", // Indicates it was created manually
                    Status = taskStatus,
                    WorkflowId = workflowId,
                    CurrentStageId = stageId,
                    MemberId = assignedToMemberId,
                    SLADeadline = dueDate,
                    IsOverdue = isOverdue,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                await _repository.CreateAsync(newTask);
                _logger.LogInformation(
                    "Task synced from WorkflowManagement.API to TaskService. TaskId: {TaskId}, TaskName: {TaskName}",
                    taskId, taskName);
            }
            else
            {
                // Update existing task
                existingTask.TaskName = taskName;
                existingTask.Description = description;
                existingTask.Priority = priority;
                existingTask.Status = taskStatus;
                existingTask.WorkflowId = workflowId;
                existingTask.CurrentStageId = stageId;
                existingTask.MemberId = assignedToMemberId;
                existingTask.SLADeadline = dueDate;
                existingTask.IsOverdue = isOverdue;
                existingTask.UpdatedAt = DateTime.UtcNow;

                await _repository.UpdateAsync(existingTask);
                _logger.LogInformation(
                    "Task updated in TaskService from WorkflowManagement.API. TaskId: {TaskId}, TaskName: {TaskName}",
                    taskId, taskName);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error syncing task from WorkflowManagement.API to TaskService. TaskId: {TaskId}",
                taskId);
            throw;
        }
    }

    // Helper methods for JSON parsing
    private Guid? GetGuidPropertyFromJson(System.Text.Json.JsonElement element, string camelCase, string pascalCase)
    {
        if (element.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            if (Guid.TryParse(camelProp.GetString(), out var guid))
                return guid;
        }
        if (element.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind == System.Text.Json.JsonValueKind.String)
        {
            if (Guid.TryParse(pascalProp.GetString(), out var guid))
                return guid;
        }
        return null;
    }

    private string? GetStringPropertyFromJson(System.Text.Json.JsonElement element, string camelCase, string pascalCase)
    {
        if (element.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind == System.Text.Json.JsonValueKind.String)
            return camelProp.GetString();
        if (element.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind == System.Text.Json.JsonValueKind.String)
            return pascalProp.GetString();
        return null;
    }

    private bool? GetBoolPropertyFromJson(System.Text.Json.JsonElement element, string camelCase, string pascalCase)
    {
        if (element.TryGetProperty(camelCase, out var camelProp))
        {
            if (camelProp.ValueKind == System.Text.Json.JsonValueKind.True || camelProp.ValueKind == System.Text.Json.JsonValueKind.False)
                return camelProp.GetBoolean();
        }
        if (element.TryGetProperty(pascalCase, out var pascalProp))
        {
            if (pascalProp.ValueKind == System.Text.Json.JsonValueKind.True || pascalProp.ValueKind == System.Text.Json.JsonValueKind.False)
                return pascalProp.GetBoolean();
        }
        return null;
    }

    /// <summary>
    /// Complete the current stage and move to the next stage
    /// Publishes TaskStageCompletedEvent which triggers stage orchestration
    /// </summary>
    public System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId)
        => CompleteCurrentStageAsync(taskId, null, null);

    public System.Threading.Tasks.Task CompleteCurrentStageAsync(Guid taskId, Dictionary<string, object>? stageData)
        => CompleteCurrentStageAsync(taskId, stageData, null, null);

    public System.Threading.Tasks.Task CompleteCurrentStageAsync(
        Guid taskId,
        Dictionary<string, object>? stageData,
        Guid? nextStageMemberId)
        => CompleteCurrentStageAsync(taskId, stageData, nextStageMemberId, null);

    public async System.Threading.Tasks.Task CompleteCurrentStageAsync(
        Guid taskId,
        Dictionary<string, object>? stageData,
        Guid? nextStageMemberId,
        Dictionary<string, Guid>? stageNominations)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        if (task.Status == DomainTaskStatus.Completed)
            throw new InvalidOperationException($"Task {taskId} is already completed");

        if (!task.CurrentStageId.HasValue)
            throw new InvalidOperationException($"Task {taskId} is not currently in any stage");

        if (!task.WorkflowId.HasValue)
            throw new InvalidOperationException($"Task {taskId} does not have a workflow assigned");

        // Get stages from WorkflowManagement.API to find stage details
        var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
            ?? "http://localhost:5000/api";

        var stagesResponse = await GetWithOrgHeaderAsync(
            $"{workflowManagementApiUrl}/stages/workflow/{task.WorkflowId.Value}",
            task.OrganizationId);

        if (!stagesResponse.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Failed to get stages for workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}, StatusCode: {StatusCode}",
                taskId, task.WorkflowId.Value, stagesResponse.StatusCode);
            throw new InvalidOperationException($"Failed to get workflow stages");
        }

        var stagesJson = await stagesResponse.Content.ReadAsStringAsync();
        var stages = System.Text.Json.JsonSerializer.Deserialize<List<StageInfo>>(stagesJson, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (stages == null || !stages.Any())
        {
            throw new InvalidOperationException($"No stages found for workflow {task.WorkflowId.Value}");
        }

        // Find current stage and next stage
        var orderedStages = stages.OrderBy(s => s.StageOrder).ToList();
        var currentStage = orderedStages.FirstOrDefault(s => s.StageId == task.CurrentStageId.Value);
        
        if (currentStage == null)
        {
            throw new InvalidOperationException($"Current stage {task.CurrentStageId.Value} not found in workflow");
        }

        var nextStage = orderedStages.FirstOrDefault(s => s.StageOrder > currentStage.StageOrder);

        // Checked before anything is published. Advancing into a team with no members
        // leaves the task stranded on the next stage with no assignee, because the
        // downstream reassignment throws and the message is eventually dropped.
        if (nextStage != null)
        {
            var nextStageMembers = await GetTeamMembersAsync(nextStage.TeamId, task.OrganizationId);

            if (nextStageMembers.Count == 0)
                throw new InvalidOperationException(
                    $"The team for '{nextStage.StageName}' has no members, so this cannot be moved on yet. Add a member to that team first.");

            if (nextStageMemberId.HasValue &&
                !nextStageMembers.Any(m => m.MemberId == nextStageMemberId.Value))
            {
                throw new InvalidOperationException(
                    $"The chosen member is not on the team for '{nextStage.StageName}'.");
            }
        }
        else if (nextStageMemberId.HasValue)
        {
            throw new InvalidOperationException("This is the final stage, so there is nobody to assign it to.");
        }

        // Appointments for stages further ahead. Validated against the target stage's
        // team now, so a bad choice is refused while the person is still looking at it
        // rather than surfacing several stages later.
        if (stageNominations != null && stageNominations.Count > 0)
        {
            foreach (var (stageIdText, memberId) in stageNominations)
            {
                if (!Guid.TryParse(stageIdText, out var nominatedStageId))
                    throw new InvalidOperationException($"'{stageIdText}' is not a valid stage.");

                var targetStage = orderedStages.FirstOrDefault(s => s.StageId == nominatedStageId)
                    ?? throw new InvalidOperationException("A nominated stage does not belong to this workflow.");

                var targetMembers = await GetTeamMembersAsync(targetStage.TeamId, task.OrganizationId);
                if (!targetMembers.Any(m => m.MemberId == memberId))
                    throw new InvalidOperationException(
                        $"The person chosen for '{targetStage.StageName}' is not on that stage's team.");

                await _nominationRepository.AddAsync(new TaskStageNomination
                {
                    OrganizationId = task.OrganizationId,
                    TaskId = taskId,
                    StageId = nominatedStageId,
                    MemberId = memberId,
                    NominatedByMemberId = task.MemberId,
                    NominatedAt = DateTime.UtcNow
                });
            }
        }

        // Written before the event is published so the submission is durable even if
        // the transition is still in flight, and so the shared event contract stays
        // free of form data that only this service cares about.
        if (stageData != null && stageData.Count > 0)
        {
            await _stageDataRepository.AppendAsync(new TaskStageData
            {
                OrganizationId = task.OrganizationId,
                TaskId = taskId,
                StageId = currentStage.StageId,
                DataJson = System.Text.Json.JsonSerializer.Serialize(stageData),
                SubmittedByMemberId = task.MemberId,
                SubmittedAt = DateTime.UtcNow
            });
        }

        // Publish TaskStageCompletedEvent
        var correlationId = Guid.NewGuid();
        var stageCompletedEvent = new TaskStageCompletedEvent
        {
            TaskId = taskId,
            StageId = currentStage.StageId,
            StageName = currentStage.StageName,
            StageOrder = currentStage.StageOrder,
            WorkflowId = task.WorkflowId.Value,
            NextStageId = nextStage?.StageId,
            NextStageName = nextStage?.StageName,
            NextStageMemberId = nextStageMemberId,
            CompletedAt = DateTime.UtcNow,
            CorrelationId = correlationId
        };

        await _eventBus.PublishAsync(
            stageCompletedEvent,
            EventBusConstants.WorkflowSource,
            EventBusConstants.TaskStageCompleted,
            correlationId);

        _logger.LogInformation(
            "Stage completed for task. TaskId: {TaskId}, StageId: {StageId}, StageName: {StageName}, NextStageId: {NextStageId}, CorrelationId: {CorrelationId}",
            taskId, currentStage.StageId, currentStage.StageName, nextStage?.StageId, correlationId);
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskStageDataReadDto>> GetStageDataAsync(Guid taskId)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        var rows = await _stageDataRepository.GetLatestPerStageAsync(taskId);
        return rows.Select(row => new TaskStageDataReadDto
        {
            StageId = row.StageId,
            DataJson = row.DataJson,
            SubmittedByMemberId = row.SubmittedByMemberId,
            SubmittedAt = row.SubmittedAt
        }).ToList();
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskStageHistoryReadDto>> GetStageHistoryAsync(Guid taskId)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        var history = await _historyRepository.GetByTaskIdAsync(taskId);
        return history.Select(h => new TaskStageHistoryReadDto
        {
            HistoryId = h.HistoryId,
            Sequence = h.Sequence,
            Action = h.Action,
            StageId = h.StageId,
            StageName = h.StageName,
            StageOrder = h.StageOrder,
            MemberId = h.MemberId,
            MemberName = h.MemberName,
            FromStageId = h.FromStageId,
            FromStageName = h.FromStageName,
            ToStageId = h.ToStageId,
            ToStageName = h.ToStageName,
            Reason = h.Reason,
            OccurredAt = h.OccurredAt
        }).ToList();
    }

    /// <summary>
    /// Sends the task back to an earlier stage and to the member who last held that stage.
    /// </summary>
    public async System.Threading.Tasks.Task ReturnToStageAsync(Guid taskId, Guid targetStageId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new InvalidOperationException("A reason is required to return a task to a previous stage");

        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        if (task.Status == DomainTaskStatus.Completed)
            throw new InvalidOperationException($"Task {taskId} is already completed");

        if (!task.CurrentStageId.HasValue)
            throw new InvalidOperationException($"Task {taskId} is not currently in any stage");

        if (!task.WorkflowId.HasValue)
            throw new InvalidOperationException($"Task {taskId} does not have a workflow assigned");

        if (!task.MemberId.HasValue)
            throw new InvalidOperationException($"Task {taskId} has no assignee");

        var orderedStages = await GetOrderedStagesAsync(task);
        var currentStage = orderedStages.FirstOrDefault(s => s.StageId == task.CurrentStageId.Value);
        if (currentStage == null)
            throw new InvalidOperationException($"Current stage {task.CurrentStageId.Value} not found in workflow");

        var targetStage = orderedStages.FirstOrDefault(s => s.StageId == targetStageId);
        if (targetStage == null)
            throw new InvalidOperationException("Target stage is not part of this workflow");

        if (targetStage.StageOrder >= currentStage.StageOrder)
            throw new InvalidOperationException("A task can only be returned to an earlier stage");

        var previousAssignee = await _historyRepository.GetLastAssignmentAsync(taskId, targetStage.StageId);
        if (previousAssignee == null)
            throw new InvalidOperationException($"Stage {targetStage.StageName} has no previous assignee");

        var returner = await _historyRepository.GetLastAssignmentAsync(taskId, currentStage.StageId);
        var returnerName = returner != null && returner.MemberId == task.MemberId.Value
            ? returner.MemberName
            : task.MemberId.Value.ToString();

        var correlationId = Guid.NewGuid();
        var returnedEvent = new TaskStageReturnedEvent
        {
            TaskId = taskId,
            WorkflowId = task.WorkflowId.Value,
            FromStageId = currentStage.StageId,
            FromStageName = currentStage.StageName,
            FromStageOrder = currentStage.StageOrder,
            ToStageId = targetStage.StageId,
            ToStageName = targetStage.StageName,
            ToStageOrder = targetStage.StageOrder,
            ReturnedByMemberId = task.MemberId.Value,
            ReturnedByMemberName = returnerName,
            ToMemberId = previousAssignee.MemberId,
            ToMemberName = previousAssignee.MemberName,
            Reason = reason.Trim(),
            ReturnedAt = DateTime.UtcNow,
            CorrelationId = correlationId
        };

        await _eventBus.PublishAsync(
            returnedEvent,
            EventBusConstants.TaskSource,
            EventBusConstants.TaskStageReturned,
            correlationId);

        _logger.LogInformation(
            "Stage return requested. TaskId: {TaskId}, FromStageId: {FromStageId}, ToStageId: {ToStageId}, ToMemberId: {ToMemberId}, CorrelationId: {CorrelationId}",
            taskId, currentStage.StageId, targetStage.StageId, previousAssignee.MemberId, correlationId);
    }

    /// <summary>
    /// Escalates a task to the next stage without marking it as completed by the current member
    /// Used when a member cannot handle the task and needs to pass it to the next stage
    /// Unlike CompleteStageAsync, this does NOT increment the member's completion count
    /// </summary>
    public async System.Threading.Tasks.Task EscalateStageAsync(Guid taskId, string escalationReason)
    {
        var task = await _repository.GetByIdAsync(taskId);
        if (task == null)
        {
            throw new KeyNotFoundException($"Task {taskId} not found");
        }

        if (!task.CurrentStageId.HasValue)
        {
            throw new InvalidOperationException("Task is not in any stage");
        }

        if (!task.WorkflowId.HasValue)
        {
            throw new InvalidOperationException("Task has no workflow assigned");
        }

        // Get workflow stages from WorkflowManagement.API
        var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
            ?? throw new InvalidOperationException("WorkflowManagementApi:BaseUrl configuration is required");

        var stagesResponse = await GetWithOrgHeaderAsync(
            $"{workflowManagementApiUrl}/stages/workflow/{task.WorkflowId.Value}",
            task.OrganizationId);

        if (!stagesResponse.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Failed to get stages for workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}, StatusCode: {StatusCode}",
                taskId, task.WorkflowId.Value, stagesResponse.StatusCode);
            throw new InvalidOperationException($"Failed to get workflow stages");
        }

        var stagesJson = await stagesResponse.Content.ReadAsStringAsync();
        var stages = System.Text.Json.JsonSerializer.Deserialize<List<StageInfo>>(stagesJson, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (stages == null || !stages.Any())
        {
            throw new InvalidOperationException($"No stages found for workflow {task.WorkflowId.Value}");
        }

        // Find current stage and next stage
        var orderedStages = stages.OrderBy(s => s.StageOrder).ToList();
        var currentStage = orderedStages.FirstOrDefault(s => s.StageId == task.CurrentStageId.Value);
        
        if (currentStage == null)
        {
            throw new InvalidOperationException($"Current stage {task.CurrentStageId.Value} not found in workflow");
        }

        var nextStage = orderedStages.FirstOrDefault(s => s.StageOrder > currentStage.StageOrder);

        // Publish TaskStageEscalatedEvent (does NOT update CompletedByMemberIds)
        var correlationId = Guid.NewGuid();
        var stageEscalatedEvent = new TaskStageEscalatedEvent
        {
            TaskId = taskId,
            CurrentStageId = currentStage.StageId,
            CurrentStageName = currentStage.StageName,
            WorkflowId = task.WorkflowId.Value,
            NextStageId = nextStage?.StageId,
            NextStageName = nextStage?.StageName,
            EscalationReason = escalationReason,
            EscalatedAt = DateTime.UtcNow,
            CorrelationId = correlationId
        };

        await _eventBus.PublishAsync(
            stageEscalatedEvent,
            EventBusConstants.WorkflowSource,
            EventBusConstants.TaskStageEscalated,
            correlationId);

        _logger.LogInformation(
            "Stage escalated for task. TaskId: {TaskId}, StageId: {StageId}, StageName: {StageName}, NextStageId: {NextStageId}, Reason: {Reason}, CorrelationId: {CorrelationId}",
            taskId, currentStage.StageId, currentStage.StageName, nextStage?.StageId, escalationReason, correlationId);
    }

    private async System.Threading.Tasks.Task<List<StageInfo>> GetOrderedStagesAsync(DomainTask task)
    {
        if (!task.WorkflowId.HasValue)
            throw new InvalidOperationException($"Task {task.TaskId} does not have a workflow assigned");

        var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"]
            ?? "http://localhost:5000/api";

        var stagesResponse = await GetWithOrgHeaderAsync(
            $"{workflowManagementApiUrl}/stages/workflow/{task.WorkflowId.Value}",
            task.OrganizationId);

        if (!stagesResponse.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Failed to get stages for workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}, StatusCode: {StatusCode}",
                task.TaskId, task.WorkflowId.Value, stagesResponse.StatusCode);
            throw new InvalidOperationException("Failed to get workflow stages");
        }

        var stagesJson = await stagesResponse.Content.ReadAsStringAsync();
        var stages = System.Text.Json.JsonSerializer.Deserialize<List<StageInfo>>(stagesJson, new System.Text.Json.JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        if (stages == null || !stages.Any())
            throw new InvalidOperationException($"No stages found for workflow {task.WorkflowId.Value}");

        return stages.OrderBy(s => s.StageOrder).ToList();
    }

    private async System.Threading.Tasks.Task<HttpResponseMessage> GetWithOrgHeaderAsync(string url, Guid organizationId)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        return await _httpClient.SendAsync(request);
    }

    private async System.Threading.Tasks.Task<HttpResponseMessage> PutWithOrgHeaderAsync(string url, object content, Guid organizationId)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        request.Content = JsonContent.Create(content);
        return await _httpClient.SendAsync(request);
    }

    private async System.Threading.Tasks.Task<HttpResponseMessage> DeleteWithOrgHeaderAsync(string url, Guid organizationId)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.TryAddWithoutValidation("X-Organization-Id", organizationId.ToString());
        return await _httpClient.SendAsync(request);
    }

    /// <summary>
    /// Internal class for deserializing stage info from WorkflowManagement.API
    /// </summary>
    private async System.Threading.Tasks.Task<List<TeamMemberInfo>> GetTeamMembersAsync(Guid teamId, Guid organizationId)
    {
        var baseUrl = _configuration["WorkflowManagementApi:BaseUrl"] ?? "http://localhost:5000/api";
        var response = await GetWithOrgHeaderAsync($"{baseUrl}/teams/{teamId}/members", organizationId);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError(
                "Failed to read members for team {TeamId}. StatusCode: {StatusCode}",
                teamId, response.StatusCode);
            throw new InvalidOperationException("Could not check who is on the next stage's team. Try again.");
        }

        var json = await response.Content.ReadAsStringAsync();
        return System.Text.Json.JsonSerializer.Deserialize<List<TeamMemberInfo>>(json,
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new List<TeamMemberInfo>();
    }

    private class TeamMemberInfo
    {
        public Guid MemberId { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
    }

    private class StageInfo
    {
        public Guid StageId { get; set; }
        public string StageName { get; set; } = string.Empty;
        public int StageOrder { get; set; }
        public Guid WorkflowId { get; set; }
        public Guid TeamId { get; set; }
    }

    private class WorkflowTaskInfo
    {
        public Guid TaskId { get; set; }
        public string? CompletedByMemberIds { get; set; }
        public string? EscalatedByMemberIds { get; set; }
    }

    private TaskReadDto MapToDto(DomainTask task)
    {
        return new TaskReadDto
        {
            TaskId = task.TaskId,
            TaskName = task.TaskName,
            Description = task.Description,
            Priority = task.Priority,
            TaskType = task.TaskType,
            Status = task.Status,
            DataJson = task.DataJson,
            CreatedByMemberId = task.CreatedByMemberId,
            ReturnedAt = task.ReturnedAt,
            ReturnReason = task.ReturnReason,
            WorkflowId = task.WorkflowId,
            MemberId = task.MemberId,
            CurrentStageId = task.CurrentStageId,
            SLADeadline = task.SLADeadline,
            IsOverdue = task.IsOverdue,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };
    }
}

