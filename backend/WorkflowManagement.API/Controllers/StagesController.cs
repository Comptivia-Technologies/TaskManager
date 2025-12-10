using Microsoft.AspNetCore.Mvc;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Services;

namespace WorkflowManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StagesController : ControllerBase
{
    private readonly IStageService _stageService;
    private readonly ILogger<StagesController> _logger;

    public StagesController(IStageService stageService, ILogger<StagesController> logger)
    {
        _stageService = stageService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<StageReadDto>>> GetAllStages()
    {
        try
        {
            var stages = await _stageService.GetAllStagesAsync();
            return Ok(stages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all stages");
            return StatusCode(500, "An error occurred while retrieving stages");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StageReadDto>> GetStageById(int id)
    {
        try
        {
            var stage = await _stageService.GetStageByIdAsync(id);
            if (stage == null)
                return NotFound($"Stage with ID {id} not found");

            return Ok(stage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stage by ID {StageId}", id);
            return StatusCode(500, "An error occurred while retrieving the stage");
        }
    }

    [HttpPost]
    public async Task<ActionResult<StageReadDto>> CreateStage([FromBody] StageCreateDto stageCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var stage = await _stageService.CreateStageAsync(stageCreateDto);
            return CreatedAtAction(nameof(GetStageById), new { id = stage.StageId }, stage);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating stage");
            return StatusCode(500, "An error occurred while creating the stage");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<StageReadDto>> UpdateStage(int id, [FromBody] StageUpdateDto stageUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var stage = await _stageService.UpdateStageAsync(id, stageUpdateDto);
            if (stage == null)
                return NotFound($"Stage with ID {id} not found");

            return Ok(stage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating stage {StageId}", id);
            return StatusCode(500, "An error occurred while updating the stage");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStage(int id)
    {
        try
        {
            var deleted = await _stageService.DeleteStageAsync(id);
            if (!deleted)
                return NotFound($"Stage with ID {id} not found");

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting stage {StageId}", id);
            return StatusCode(500, "An error occurred while deleting the stage");
        }
    }

    [HttpGet("workflow/{workflowId}")]
    public async Task<ActionResult<IEnumerable<StageReadDto>>> GetStagesByWorkflow(int workflowId)
    {
        try
        {
            var stages = await _stageService.GetStagesByWorkflowAsync(workflowId);
            return Ok(stages);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting stages for workflow {WorkflowId}", workflowId);
            return StatusCode(500, "An error occurred while retrieving stages");
        }
    }
}



