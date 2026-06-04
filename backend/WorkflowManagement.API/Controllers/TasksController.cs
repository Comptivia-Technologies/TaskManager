using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.Authorization;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;
    private readonly ITaskAuditService _taskAuditService;
    private readonly ILogger<TasksController> _logger;

    public TasksController(
        ITaskService taskService,
        ITaskAuditService taskAuditService,
        ILogger<TasksController> logger)
    {
        _taskService = taskService;
        _taskAuditService = taskAuditService;
        _logger = logger;
    }

    [HttpPost]
    [RequirePermission("tasks.manage")]
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
    [RequirePermission("tasks.view")]
    public async Task<ActionResult<PaginatedTasksResponseDto>> GetAllTasks([FromQuery] string? priority, [FromQuery] int page = 1, [FromQuery] int limit = 10)
    {
        try
        {
            var result = await _taskService.GetTasksPaginatedAsync(priority, page, limit);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all tasks");
            return StatusCode(500, "An error occurred while retrieving tasks");
        }
    }

    [HttpGet("{id:guid}/audit")]
    [RequirePermission("tasks.view")]
    public async Task<ActionResult<IEnumerable<TaskAuditEntryReadDto>>> GetTaskAudit(Guid id)
    {
        try
        {
            var task = await _taskService.GetTaskByIdAsync(id);
            if (task == null)
                return NotFound($"Task with ID {id} not found");

            var audit = await _taskAuditService.GetAuditByTaskIdAsync(id);
            return Ok(audit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting audit for task {TaskId}", id);
            return StatusCode(500, "An error occurred while retrieving task audit history");
        }
    }

    [HttpPost("{id:guid}/audit")]
    [RequirePermission("tasks.manage")]
    public async Task<ActionResult<TaskAuditEntryReadDto>> RecordTaskAudit(Guid id, [FromBody] TaskAuditEntryCreateDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var entry = await _taskAuditService.RecordAuditEntryAsync(id, dto);
            if (entry == null)
                return NotFound($"Task with ID {id} not found");

            return Ok(entry);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recording audit for task {TaskId}", id);
            return StatusCode(500, "An error occurred while recording task audit entry");
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

    [HttpGet("assigned/me")]
    [RequirePermission("tasks.view")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetMyAssignedTasks()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value;
        if (string.IsNullOrWhiteSpace(email))
            return BadRequest("Email claim not found in token.");

        var tasks = await _taskService.GetTasksAssignedToEmailAsync(email);
        if (tasks == null)
            return NotFound("No member record found for your email.");

        return Ok(tasks);
    }

    [HttpGet("member/summary/{memberId}")]
    public async Task<ActionResult<MemberTaskSummaryDto>> GetMemberTaskSummary(Guid memberId)
    {
        try
        {
            var summary = await _taskService.GetMemberTaskSummaryAsync(memberId);
            return Ok(summary);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting task summary for member {MemberId}", memberId);
            return StatusCode(500, "An error occurred while retrieving the task summary");
        }
    }
}



