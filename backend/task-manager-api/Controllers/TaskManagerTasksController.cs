using Microsoft.AspNetCore.Mvc;
using TaskManager.API.DTOs;
using TaskManager.API.Services;

namespace TaskManager.API.Controllers;

[ApiController]
[Route("api/task-manager/tasks")]
public class TaskManagerTasksController : ControllerBase
{
    private readonly ITaskManagerService _taskManagerService;
    private readonly ILogger<TaskManagerTasksController> _logger;

    public TaskManagerTasksController(ITaskManagerService taskManagerService, ILogger<TaskManagerTasksController> logger)
    {
        _taskManagerService = taskManagerService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskManagerTaskReadDto>>> GetAllTasks()
    {
        var tasks = await _taskManagerService.GetAllTasksAsync();
        return Ok(tasks);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<TaskManagerTaskReadDto>> GetTaskById(int id)
    {
        var task = await _taskManagerService.GetTaskByIdAsync(id);
        if (task == null)
        {
            return NotFound(new { error = $"Task with ID {id} not found" });
        }

        return Ok(task);
    }

    [HttpPost]
    public async Task<ActionResult<TaskManagerTaskReadDto>> CreateTask([FromBody] TaskManagerTaskCreateDto createDto)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        try
        {
            var created = await _taskManagerService.CreateTaskAsync(createDto);
            return CreatedAtAction(nameof(GetTaskById), new { id = created.TaskId }, created);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Validation error while creating managed task");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating managed task");
            return StatusCode(500, new { error = "An error occurred while creating the task" });
        }
    }
}


