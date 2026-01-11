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
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<TaskService> _logger;
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;

    public TaskService(
        ITaskRepository repository,
        IRabbitMQPublisher publisher,
        ILogger<TaskService> logger,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory)
    {
        _repository = repository;
        _publisher = publisher;
        _logger = logger;
        _configuration = configuration;
        _httpClient = httpClientFactory.CreateClient();
    }

    public async System.Threading.Tasks.Task<TaskReadDto> CreateTaskAsync(TaskCreateDto createDto)
    {
        var task = new DomainTask
        {
            TaskId = Guid.NewGuid(),
            TaskName = createDto.TaskName,
            Description = createDto.Description,
            Priority = createDto.Priority,
            TaskType = createDto.TaskType,
            Status = DomainTaskStatus.Created,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var createdTask = await _repository.CreateAsync(task);

        // Publish TaskCreatedEvent
        var correlationId = Guid.NewGuid();
        var taskCreatedEvent = new TaskCreatedEvent
        {
            TaskId = createdTask.TaskId,
            TaskName = createdTask.TaskName,
            Description = createdTask.Description,
            Priority = createdTask.Priority,
            TaskType = createdTask.TaskType,
            CreatedAt = createdTask.CreatedAt,
            CorrelationId = correlationId
        };

        await _publisher.PublishAsync(
            taskCreatedEvent,
            RabbitMQConstants.TaskExchange,
            RabbitMQConstants.TaskCreated,
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

        await _publisher.PublishAsync(
            statusUpdatedEvent,
            RabbitMQConstants.TaskExchange,
            RabbitMQConstants.TaskStatusUpdated,
            correlationId);

        _logger.LogInformation(
            "Task status updated. TaskId: {TaskId}, {OldStatus} → {NewStatus}, CorrelationId: {CorrelationId}",
            taskId, oldStatus, newStatus, correlationId);
    }

    /// <summary>
    /// Syncs task status to WorkflowManagement.API so WorkloadService can see the update
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
                ?? "http://localhost:5000/api";

            // Map status to WorkflowManagement.API format (string)
            // WorkloadService expects "In Progress" (with space), not "InProgress"
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
                        StageId = (int?)null,
                        AssignedToMemberId = task.MemberId.Value
                    };

                    var updateResponse = await _httpClient.PutAsJsonAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        updateDto);

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
            WorkflowId = task.WorkflowId,
            MemberId = task.MemberId,
            SLADeadline = task.SLADeadline,
            IsOverdue = task.IsOverdue,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };
    }
}

