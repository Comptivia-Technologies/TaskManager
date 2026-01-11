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

            // Idempotency check - use AssignmentId instead of TaskId
            var existingTask = await _repository.GetByEventIdAsync("TaskAssignedEvent", @event.AssignmentId);
            if (existingTask != null && existingTask.TaskAssignedEventId == @event.AssignmentId)
            {
                _logger.LogWarning(
                    "TaskAssignedEvent already processed. TaskId: {TaskId}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, @event.AssignmentId, correlationId);
                return;
            }

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for TaskAssignedEvent. TaskId: {TaskId}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}. Will retry later.",
                    @event.TaskId, @event.AssignmentId, correlationId);
                // Don't throw - task might be created later, RabbitMQ will retry
                return;
            }

            // Update task with member assignment
            task.MemberId = @event.MemberId;
            task.Status = DomainTaskStatus.Assigned;
            task.TaskAssignedEventId = @event.AssignmentId; // Store AssignmentId for idempotency
            // Preserve other event IDs (don't overwrite)
            // WorkflowSelectedEventId and SLAConfiguredEventId should already be set
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "Task assigned to member. TaskId: {TaskId}, MemberId: {MemberId}, MemberName: {MemberName}, WorkloadScore: {WorkloadScore}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}. Task updated in database.",
                @event.TaskId, @event.MemberId, @event.MemberName, @event.WorkloadScore, @event.AssignmentId, correlationId);

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
                ?? "http://localhost:5000/api";

            // Map task to WorkflowManagement.API format
            // WorkloadService expects "In Progress" (with space), not "InProgress"
            var statusString = task.Status.ToString();
            if (statusString == "InProgress")
            {
                statusString = "In Progress";
            }

            var taskCreateDto = new
            {
                TaskName = task.TaskName,
                Description = task.Description,
                Status = statusString,
                Priority = task.Priority,
                DueDate = task.SLADeadline, // Use SLA deadline as due date
                WorkflowId = task.WorkflowId.Value,
                StageId = (int?)null, // Can be set later if needed
                AssignedToMemberId = task.MemberId.Value
            };

            var response = await _httpClient.PostAsJsonAsync(
                $"{workflowManagementApiUrl}/tasks",
                taskCreateDto);

            if (response.IsSuccessStatusCode)
            {
                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogInformation(
                    "Task synced to WorkflowManagement.API. TaskId: {TaskId}, Response: {Response}",
                    task.TaskId, responseContent);
            }
            else
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to sync task to WorkflowManagement.API. TaskId: {TaskId}, Status: {Status}, Error: {Error}",
                    task.TaskId, response.StatusCode, errorContent);
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
}

