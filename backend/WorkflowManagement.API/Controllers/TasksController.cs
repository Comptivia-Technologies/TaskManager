using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;
    private readonly ILogger<TasksController> _logger;

    public TasksController(ITaskService taskService, ILogger<TasksController> logger)
    {
        _taskService = taskService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<TaskReadDto>> CreateTask([FromBody] TaskCreateDto taskCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var task = await _taskService.CreateTaskAsync(taskCreateDto);
            return CreatedAtAction(nameof(GetTaskById), new { id = task.TaskId }, task);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating task");
            return StatusCode(500, "An error occurred while creating the task");
        }
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetAllTasks()
    {
        try
        {
            var tasks = await _taskService.GetAllTasksAsync();
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all tasks");
            return StatusCode(500, "An error occurred while retrieving tasks");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TaskReadDto>> GetTaskById(Guid id)
    {
        try
        {
            var task = await _taskService.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound($"Task with ID {id} not found");

            return Ok(task);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting task by ID {TaskId}", id);
            return StatusCode(500, "An error occurred while retrieving the task");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<TaskReadDto>> UpdateTask(Guid id, [FromBody] TaskUpdateDto taskUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var task = await _taskService.UpdateTaskAsync(id, taskUpdateDto);
            if (task == null)
                return NotFound($"Task with ID {id} not found");

            return Ok(task);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating task {TaskId}", id);
            return StatusCode(500, "An error occurred while updating the task");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTask(Guid id)
    {
        try
        {
            var deleted = await _taskService.DeleteTaskAsync(id);
            if (!deleted)
                return NotFound($"Task with ID {id} not found");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting task {TaskId}", id);
            return StatusCode(500, "An error occurred while deleting the task");
        }
    }

    [HttpGet("workflow/{workflowId}")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetTasksByWorkflow(Guid workflowId)
    {
        try
        {
            var tasks = await _taskService.GetTasksByWorkflowAsync(workflowId);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tasks for workflow {WorkflowId}", workflowId);
            return StatusCode(500, "An error occurred while retrieving tasks");
        }
    }

    [HttpGet("stage/{stageId}")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetTasksByStage(Guid stageId)
    {
        try
        {
            var tasks = await _taskService.GetTasksByStageAsync(stageId);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tasks for stage {StageId}", stageId);
            return StatusCode(500, "An error occurred while retrieving tasks");
        }
    }

    [HttpGet("member/{memberId}")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetTasksByMember(Guid memberId)
    {
        try
        {
            var tasks = await _taskService.GetTasksByMemberAsync(memberId);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tasks for member {MemberId}", memberId);
            return StatusCode(500, "An error occurred while retrieving tasks");
        }
    }
}



