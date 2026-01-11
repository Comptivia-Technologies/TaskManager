using Microsoft.AspNetCore.Mvc;
using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;

namespace TaskService.Api.Controllers;

/// <summary>
/// API Gateway entry point for task creation
/// </summary>
[ApiController]
[Route("api/tasks")]
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
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<TaskReadDto>> CreateTask([FromBody] TaskCreateDto createDto)
    {
        try
        {
            var task = await _taskService.CreateTaskAsync(createDto);
            return CreatedAtAction(nameof(GetTask), new { id = task.TaskId }, task);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating task");
            return StatusCode(500, new { error = "An error occurred while creating the task" });
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
    [HttpPut("{id}/status")]
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
}

