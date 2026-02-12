using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Configuration;
using System.Net.Http.Json;
using DomainTask = TaskService.Domain.Entities.Task;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for TaskOverdueEvent
/// Marks task as overdue and syncs to WorkflowManagement.API
/// </summary>
public class TaskOverdueEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<TaskOverdueEventHandler> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public TaskOverdueEventHandler(
        ITaskRepository repository,
        ILogger<TaskOverdueEventHandler> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _repository = repository;
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async System.Threading.Tasks.Task HandleAsync(TaskOverdueEvent @event, Guid correlationId)
    {
        try
        {
            // Idempotency check
            var existingTask = await _repository.GetByEventIdAsync("TaskOverdueEvent", @event.TaskId);
            if (existingTask != null && existingTask.TaskOverdueEventId == @event.TaskId)
            {
                _logger.LogWarning(
                    "TaskOverdueEvent already processed. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskOverdueEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            // Don't mark completed or cancelled tasks as overdue
            if (task.Status == DomainTaskStatus.Completed || 
                task.Status == DomainTaskStatus.Cancelled)
            {
                _logger.LogInformation(
                    "Skipping overdue marking - task is already {Status}. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    task.Status, @event.TaskId, correlationId);
                return;
            }

            // Update BreachedAt to actual time when message was delivered (may be slightly after deadline)
            var now = DateTime.UtcNow;
            if (@event.BreachedAt < now.AddMinutes(-1)) // If BreachedAt is more than 1 minute old, use current time
            {
                @event.BreachedAt = now;
                @event.MinutesOverdue = (int)(now - @event.SLADeadline).TotalMinutes;
            }

            // Mark task as overdue
            task.IsOverdue = true;
            task.Status = DomainTaskStatus.Overdue;
            task.TaskOverdueEventId = @event.TaskId; // Store event ID for idempotency
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogWarning(
                "Task marked as overdue. TaskId: {TaskId}, MinutesOverdue: {MinutesOverdue}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.MinutesOverdue, correlationId);

            // Sync status update to WorkflowManagement.API so frontend can see it
            await SyncTaskStatusToWorkflowManagementAPIAsync(task, DomainTaskStatus.Overdue);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling TaskOverdueEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                @event.TaskId, correlationId);
            throw;
        }
    }

    /// <summary>
    /// Syncs task status to WorkflowManagement.API so frontend can see the update
    /// Since TaskService uses Guid TaskId and WorkflowManagement.API uses int TaskId,
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
            // WorkflowManagement.API expects "Overdue" status
            var statusString = newStatus.ToString();
            if (statusString == "InProgress")
            {
                statusString = "In Progress";
            }

            // Get all tasks for this workflow to find the matching task
            var tasksResponse = await _httpClient.GetAsync(
                $"{workflowManagementApiUrl}/tasks/workflow/{task.WorkflowId.Value}");

            if (tasksResponse.IsSuccessStatusCode)
            {
                var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
                
                // Parse JSON to find task by name
                // WorkflowManagement.API returns PascalCase properties
                using var jsonDoc = System.Text.Json.JsonDocument.Parse(tasksJson);
                var tasksArray = jsonDoc.RootElement.EnumerateArray();
                
                int? matchingTaskId = null;
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
                            matchingTaskId = taskIdProp.GetInt32();
                            break;
                        }
                    }
                }

                if (matchingTaskId.HasValue)
                {
                    // Update the task status via WorkflowManagement.API
                    var updateDto = new
                    {
                        TaskName = task.TaskName,
                        Description = task.Description,
                        Status = statusString,
                        Priority = task.Priority,
                        DueDate = task.SLADeadline,
                        StageId = task.CurrentStageId,
                        AssignedToMemberId = task.MemberId.Value,
                        IsOverdue = task.IsOverdue
                    };

                    var updateResponse = await _httpClient.PutAsJsonAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        updateDto);

                    if (updateResponse.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "Task overdue status synced to WorkflowManagement.API. TaskId: {TaskId}, WorkflowManagementTaskId: {WorkflowTaskId}, Status: {Status}",
                            task.TaskId, matchingTaskId.Value, statusString);
                    }
                    else
                    {
                        var errorContent = await updateResponse.Content.ReadAsStringAsync();
                        _logger.LogWarning(
                            "Failed to update task overdue status in WorkflowManagement.API. TaskId: {TaskId}, WorkflowTaskId: {WorkflowTaskId}, Status: {Status}, Error: {Error}",
                            task.TaskId, matchingTaskId.Value, statusString, errorContent);
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Task not found in WorkflowManagement.API for overdue status sync. TaskId: {TaskId}, TaskName: {TaskName}, WorkflowId: {WorkflowId}",
                        task.TaskId, task.TaskName, task.WorkflowId);
                }
            }
            else
            {
                _logger.LogWarning(
                    "Could not fetch tasks from WorkflowManagement.API for overdue status sync. TaskId: {TaskId}, Status: {Status}, StatusCode: {StatusCode}",
                    task.TaskId, statusString, tasksResponse.StatusCode);
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't break the flow
            _logger.LogError(ex,
                "Error syncing task overdue status to WorkflowManagement.API. TaskId: {TaskId}",
                task.TaskId);
        }
    }
}

