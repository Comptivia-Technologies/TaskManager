using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorkflowsController : ControllerBase
{
    private readonly IWorkflowService _workflowService;
    private readonly ILogger<WorkflowsController> _logger;

    public WorkflowsController(IWorkflowService workflowService, ILogger<WorkflowsController> logger)
    {
        _workflowService = workflowService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<WorkflowReadDto>>> GetAllWorkflows()
    {
        try
        {
            var workflows = await _workflowService.GetAllWorkflowsAsync();
            return Ok(workflows);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all workflows");
            return StatusCode(500, "An error occurred while retrieving workflows");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<WorkflowReadDto>> GetWorkflowById(int id)
    {
        try
        {
            var workflow = await _workflowService.GetWorkflowByIdAsync(id);
            if (workflow == null)
                return NotFound($"Workflow with ID {id} not found");

            return Ok(workflow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workflow by ID {WorkflowId}", id);
            return StatusCode(500, "An error occurred while retrieving the workflow");
        }
    }

    [HttpPost]
    public async Task<ActionResult<WorkflowReadDto>> CreateWorkflow([FromBody] WorkflowCreateDto workflowCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var workflow = await _workflowService.CreateWorkflowAsync(workflowCreateDto);
            return CreatedAtAction(nameof(GetWorkflowById), new { id = workflow.WorkflowId }, workflow);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating workflow");
            return StatusCode(500, "An error occurred while creating the workflow");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<WorkflowReadDto>> UpdateWorkflow(int id, [FromBody] WorkflowUpdateDto workflowUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var workflow = await _workflowService.UpdateWorkflowAsync(id, workflowUpdateDto);
            if (workflow == null)
                return NotFound($"Workflow with ID {id} not found");

            return Ok(workflow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating workflow {WorkflowId}", id);
            return StatusCode(500, "An error occurred while updating the workflow");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteWorkflow(int id)
    {
        try
        {
            var deleted = await _workflowService.DeleteWorkflowAsync(id);
            if (!deleted)
                return NotFound($"Workflow with ID {id} not found");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting workflow {WorkflowId}", id);
            return StatusCode(500, "An error occurred while deleting the workflow");
        }
    }

    [HttpGet("{id}/stages")]
    public async Task<ActionResult<IEnumerable<StageReadDto>>> GetWorkflowStages(int id)
    {
        try
        {
            var stages = await _workflowService.GetWorkflowStagesAsync(id);
            return Ok(stages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stages for workflow {WorkflowId}", id);
            return StatusCode(500, "An error occurred while retrieving workflow stages");
        }
    }

    [HttpGet("{id}/tasks")]
    public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetWorkflowTasks(int id)
    {
        try
        {
            var tasks = await _workflowService.GetWorkflowTasksAsync(id);
            return Ok(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting tasks for workflow {WorkflowId}", id);
            return StatusCode(500, "An error occurred while retrieving workflow tasks");
        }
    }

    [HttpGet("{id}/json")]
    public async Task<ActionResult<object>> GetWorkflowJson(int id)
    {
        try
        {
            var workflow = await _workflowService.GetWorkflowByIdAsync(id);
            if (workflow == null)
                return NotFound($"Workflow with ID {id} not found");

            // Return workflow with all team names populated
            return Ok(workflow);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workflow JSON for {WorkflowId}", id);
            return StatusCode(500, "An error occurred while retrieving the workflow JSON");
        }
    }

    [HttpPost("{id}/update-json")]
    public async Task<IActionResult> UpdateWorkflowJson(int id)
    {
        try
        {
            await _workflowService.UpdateWorkflowJsonAsync(id);
            return Ok(new { message = "Workflow JSON updated successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating workflow JSON for {WorkflowId}", id);
            return StatusCode(500, "An error occurred while updating the workflow JSON");
        }
    }
}



