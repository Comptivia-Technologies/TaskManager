using Shared.Contracts.EventContracts;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using Microsoft.Extensions.Logging;
using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using DomainTask = TaskService.Domain.Entities.Task;

namespace TaskService.Application.EventHandlers;

/// <summary>
/// Event handler for PriorityAssignedEvent
/// Updates task with priority assigned by rule engine and syncs to WorkflowManagement.API
/// </summary>
public class PriorityAssignedEventHandler
{
    private readonly ITaskRepository _repository;
    private readonly ILogger<PriorityAssignedEventHandler> _logger;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public PriorityAssignedEventHandler(
        ITaskRepository repository,
        ILogger<PriorityAssignedEventHandler> logger,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration)
    {
        _repository = repository;
        _logger = logger;
        _httpClient = httpClientFactory.CreateClient();
        _configuration = configuration;
    }

    public async System.Threading.Tasks.Task HandleAsync(PriorityAssignedEvent @event, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "=== PriorityAssignedEventHandler START === TaskId: {TaskId}, Priority: {Priority}, RuleId: {RuleId}, RuleName: {RuleName}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.Priority, @event.RuleId, @event.RuleName, correlationId);

            var task = await _repository.GetByIdAsync(@event.TaskId);
            if (task == null)
            {
                _logger.LogWarning(
                    "Task not found for PriorityAssignedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    @event.TaskId, correlationId);
                return;
            }

            _logger.LogInformation(
                "Current task priority before update: {CurrentPriority}, New priority from rule: {NewPriority}",
                task.Priority, @event.Priority);

            // Update task priority in TaskService database
            task.Priority = @event.Priority;
            task.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(task);

            _logger.LogInformation(
                "✓ Task priority updated in TaskService. TaskId: {TaskId}, Priority: {Priority}, RuleId: {RuleId}, RuleName: {RuleName}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.Priority, @event.RuleId, @event.RuleName, correlationId);

            // Sync priority update to WorkflowManagement.API so frontend can see it
            _logger.LogInformation("Syncing priority to WorkflowManagement.API...");
            await SyncTaskPriorityToWorkflowManagementAPIAsync(task, @event.Priority);
            
            _logger.LogInformation(
                "=== PriorityAssignedEventHandler END === TaskId: {TaskId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                @event.TaskId, @event.Priority, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "❌ ERROR in PriorityAssignedEventHandler. TaskId: {TaskId}, Priority: {Priority}, CorrelationId: {CorrelationId}, Exception: {Exception}",
                @event.TaskId, @event.Priority, correlationId, ex.ToString());
            throw;
        }
    }

    /// <summary>
    /// Syncs task priority to WorkflowManagement.API so frontend can display the updated priority
    /// </summary>
    private async System.Threading.Tasks.Task SyncTaskPriorityToWorkflowManagementAPIAsync(DomainTask task, string priority)
    {
        try
        {
            var workflowManagementApiUrl = _configuration["WorkflowManagementApi:BaseUrl"] 
                ?? "http://localhost:5000/api";

            // Find the matching task in WorkflowManagement.API by TaskName
            // Try to get tasks by workflow first if WorkflowId is available
            string tasksUrl;
            if (task.WorkflowId.HasValue)
            {
                tasksUrl = $"{workflowManagementApiUrl}/tasks/workflow/{task.WorkflowId.Value}";
            }
            else
            {
                // Fallback to getting all tasks (less efficient but works)
                tasksUrl = $"{workflowManagementApiUrl}/tasks";
            }

            var tasksResponse = await _httpClient.GetAsync(tasksUrl);
            
            if (!tasksResponse.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Could not fetch tasks from WorkflowManagement.API for priority sync. StatusCode: {StatusCode}",
                    tasksResponse.StatusCode);
                return;
            }

            var tasksJson = await tasksResponse.Content.ReadAsStringAsync();
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
                // Get current task data to preserve other fields
                var getTaskResponse = await _httpClient.GetAsync($"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}");
                if (getTaskResponse.IsSuccessStatusCode)
                {
                    var currentTaskJson = await getTaskResponse.Content.ReadAsStringAsync();
                    using var currentTaskDoc = System.Text.Json.JsonDocument.Parse(currentTaskJson);
                    var currentTask = currentTaskDoc.RootElement;

                    // Helper to get property value (handles both camelCase and PascalCase)
                    string? GetStringProperty(string camelCase, string pascalCase)
                    {
                        if (currentTask.TryGetProperty(camelCase, out var camelProp))
                            return camelProp.GetString();
                        if (currentTask.TryGetProperty(pascalCase, out var pascalProp))
                            return pascalProp.GetString();
                        return null;
                    }

                    int? GetIntProperty(string camelCase, string pascalCase)
                    {
                        if (currentTask.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                            return camelProp.GetInt32();
                        if (currentTask.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                            return pascalProp.GetInt32();
                        return null;
                    }

                    DateTimeOffset? GetDateTimeProperty(string camelCase, string pascalCase)
                    {
                        if (currentTask.TryGetProperty(camelCase, out var camelProp) && camelProp.ValueKind == System.Text.Json.JsonValueKind.String)
                        {
                            if (DateTimeOffset.TryParse(camelProp.GetString(), out var dt))
                                return dt;
                        }
                        if (currentTask.TryGetProperty(pascalCase, out var pascalProp) && pascalProp.ValueKind == System.Text.Json.JsonValueKind.String)
                        {
                            if (DateTimeOffset.TryParse(pascalProp.GetString(), out var dt))
                                return dt;
                        }
                        return null;
                    }

                    // Update only the priority field, preserve all other fields
                    var updateDto = new
                    {
                        TaskName = GetStringProperty("taskName", "TaskName") ?? task.TaskName,
                        Description = GetStringProperty("description", "Description"),
                        Status = GetStringProperty("status", "Status") ?? "Pending",
                        Priority = priority, // Update priority
                        DueDate = GetDateTimeProperty("dueDate", "DueDate"),
                        StageId = GetIntProperty("stageId", "StageId"),
                        AssignedToMemberId = GetIntProperty("assignedToMemberId", "AssignedToMemberId")
                    };

                    var updateResponse = await _httpClient.PutAsJsonAsync(
                        $"{workflowManagementApiUrl}/tasks/{matchingTaskId.Value}",
                        updateDto);

                    if (updateResponse.IsSuccessStatusCode)
                    {
                        _logger.LogInformation(
                            "✓ Task priority synced to WorkflowManagement.API. TaskId: {TaskId}, WorkflowManagementTaskId: {WorkflowTaskId}, Priority: {Priority}",
                            task.TaskId, matchingTaskId.Value, priority);
                    }
                    else
                    {
                        var errorContent = await updateResponse.Content.ReadAsStringAsync();
                        _logger.LogError(
                            "❌ Failed to sync task priority to WorkflowManagement.API. TaskId: {TaskId}, Status: {Status}, Error: {Error}",
                            task.TaskId, updateResponse.StatusCode, errorContent);
                    }
                }
                else
                {
                    _logger.LogWarning(
                        "Could not get task details from WorkflowManagement.API for priority sync. TaskId: {TaskId}, Status: {Status}",
                        matchingTaskId.Value, getTaskResponse.StatusCode);
                }
            }
            else
            {
                _logger.LogWarning(
                    "⚠ Task not found in WorkflowManagement.API yet for priority sync. TaskName: {TaskName}, TaskId: {TaskId}. " +
                    "This usually means the task hasn't been created in WorkflowManagement.API yet. " +
                    "Priority will be synced when task is assigned or you can manually refresh the task list.",
                    task.TaskName, task.TaskId);
                
                // Try to find by TaskId as fallback (if WorkflowManagement.API stores TaskId)
                // This is a workaround - ideally tasks should be created in WorkflowManagement.API first
            }
        }
        catch (Exception ex)
        {
            // Don't throw - sync failure shouldn't break the flow
            _logger.LogError(ex,
                "Error syncing task priority to WorkflowManagement.API. TaskId: {TaskId}",
                task.TaskId);
        }
    }
}

