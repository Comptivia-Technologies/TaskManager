using Microsoft.AspNetCore.Mvc;
using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;

namespace TaskService.Api.Controllers;

/// <summary>
/// TaskService API - Task lifecycle management for TaskService.API (this is the controller for the TaskService API)
/// </summary>
[ApiController]
[Route("api/task-service")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;
    private readonly ILogger<TasksController> _logger;

    public TasksController(ITaskService taskService, ILogger<TasksController> logger)
    {
        _taskService = taskService;
        _logger = logger;
    }

    /// <summary>
    /// Create a new task - entry point for orchestration flow
    /// Returns taskId immediately. Use GET /api/task-service/{id} to retrieve full details after processing.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateTask([FromBody] TaskCreateDto createDto)
    {
        try
        {
            var task = await _taskService.CreateTaskAsync(createDto);
            return Accepted(new
            {
                taskId = task.TaskId,
                message = "Task creation initiated. Processing asynchronously. Use GET /api/task-service/{taskId} to retrieve full details."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating task");
            return StatusCode(500, new { error = "An error occurred while creating the task" });
        }
    }

    /// <summary>
    /// Sync all overdue tasks to WorkflowManagement.API
    /// This endpoint syncs existing overdue tasks that were marked overdue before the sync functionality was added
    /// </summary>
    [HttpPost("sync-overdue")]
    public async Task<ActionResult> SyncOverdueTasks()
    {
        try
        {
            await _taskService.SyncAllOverdueTasksAsync();
            return Ok(new { message = "Overdue tasks sync completed. Check logs for details." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing overdue tasks");
            return StatusCode(500, new { error = "An error occurred while syncing overdue tasks" });
        }
    }

    /// <summary>
    /// Cleanup orphaned tasks from WorkflowManagement.API
    /// This removes tasks that exist in WorkflowManagement but not in TaskService database
    /// </summary>
    [HttpPost("cleanup-orphaned")]
    public async Task<ActionResult> CleanupOrphanedTasks()
    {
        try
        {
            await _taskService.CleanupOrphanedTasksAsync();
            return Ok(new { message = "Orphaned tasks cleanup completed. Check logs for details." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up orphaned tasks");
            return StatusCode(500, new { error = "An error occurred while cleaning up orphaned tasks" });
        }
    }

    /// <summary>
    /// Sync all tasks from WorkflowManagement.API to TaskService
    /// This ensures tasks created directly in WorkflowManagement.API are synced to TaskService
    /// </summary>
    [HttpPost("sync-from-workflow-management")]
    public async Task<ActionResult> SyncTasksFromWorkflowManagement()
    {
        try
        {
            await _taskService.SyncAllTasksFromWorkflowManagementAsync();
            return Ok(new { message = "Tasks synced from WorkflowManagement.API to TaskService. Check logs for details." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error syncing tasks from WorkflowManagement.API");
            return StatusCode(500, new { error = "An error occurred while syncing tasks" });
        }
    }

    /// <summary>
    /// Get task by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<TaskReadDto>> GetTask(Guid id)
    {
        try
        {
            var task = await _taskService.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound(new { error = $"Task with ID {id} not found" });

            return Ok(task);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while retrieving the task" });
        }
    }

    /// <summary>
    /// Update task status (e.g., mark as Completed, InProgress, etc.)
    /// </summary>
    [HttpPut("status/{id}")]
    public async Task<ActionResult> UpdateTaskStatus(Guid id, [FromBody] UpdateTaskStatusDto statusDto)
    {
        try
        {
            await _taskService.UpdateTaskStatusAsync(id, statusDto.Status);
            return Ok(new { message = $"Task status updated to {statusDto.Status}" });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Task not found: {TaskId}", id);
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating task status for {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while updating task status" });
        }
    }

    /// <summary>
    /// Delete a task
    /// This will delete the task from both TaskService database and WorkflowManagement database
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTask(Guid id)
    {
        try
        {
            var deleted = await _taskService.DeleteTaskAsync(id);
            if (!deleted)
                return NotFound(new { error = $"Task with ID {id} not found" });

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while deleting the task" });
        }
    }

    /// <summary>
    /// Complete the current stage of a task
    /// This publishes a TaskStageCompletedEvent which triggers transition to the next stage
    /// </summary>
    [HttpPost("complete-stage/{id}")]
    public async Task<ActionResult> CompleteStage(Guid id)
    {
        try
        {
            await _taskService.CompleteCurrentStageAsync(id);
            return Ok(new { message = "Stage completed successfully. Task will transition to the next stage." });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Task not found: {TaskId}", id);
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Cannot complete stage for task {TaskId}: {Message}", id, ex.Message);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing stage for task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while completing the stage" });
        }
    }

    /// <summary>
    /// Escalate the current stage of a task to the next stage
    /// Unlike CompleteStage, this does NOT increment the member's completion count
    /// Used when a member cannot handle the task and needs to pass it to the next stage
    /// </summary>
    [HttpPost("escalate-stage/{id}")]
    public async Task<ActionResult> EscalateStage(Guid id, [FromBody] EscalateStageRequest request)
    {
        try
        {
            await _taskService.EscalateStageAsync(id, request.Reason ?? "No reason provided");
            return Ok(new { message = "Stage escalated successfully. Task will transition to the next stage." });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Task not found: {TaskId}", id);
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Cannot escalate stage for task {TaskId}: {Message}", id, ex.Message);
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error escalating stage for task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while escalating the stage" });
        }
    }

}

/// <summary>
/// Request DTO for escalating a stage
/// </summary>
public class EscalateStageRequest
{
    public string? Reason { get; set; }
}

