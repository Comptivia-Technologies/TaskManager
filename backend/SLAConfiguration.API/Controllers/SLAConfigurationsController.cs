using Microsoft.AspNetCore.Mvc;
using SLAConfiguration.API.DTOs;
using SLAConfiguration.API.Services;

namespace SLAConfiguration.API.Controllers;

[ApiController]
[Route("api/sla-configurations")]
public class SLAConfigurationsController : ControllerBase
{
    private readonly ISLAService _slaService;
    private readonly ILogger<SLAConfigurationsController> _logger;

    public SLAConfigurationsController(ISLAService slaService, ILogger<SLAConfigurationsController> logger)
    {
        _slaService = slaService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<SLAConfigurationReadDto>>> GetAllSLAConfigurations()
    {
        try
        {
            var slaConfigs = await _slaService.GetAllSLAConfigurationsAsync();
            return Ok(slaConfigs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all SLA configurations");
            return StatusCode(500, new { error = "An error occurred while retrieving SLA configurations" });
        }
    }

    [HttpGet("workflow/{workflowId}")]
    public async Task<ActionResult<SLAConfigurationReadDto>> GetSLAConfigurationByWorkflowId(int workflowId)
    {
        try
        {
            var slaConfig = await _slaService.GetSLAConfigurationByWorkflowIdAsync(workflowId);
            if (slaConfig == null)
                return NotFound(new { error = $"SLA configuration for workflow ID {workflowId} not found" });

            return Ok(slaConfig);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting SLA configuration for workflow {WorkflowId}", workflowId);
            return StatusCode(500, new { error = "An error occurred while retrieving the SLA configuration" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<SLAConfigurationReadDto>> CreateSLAConfiguration([FromBody] SLAConfigurationCreateDto slaCreateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var slaConfig = await _slaService.CreateSLAConfigurationAsync(slaCreateDto);
            return CreatedAtAction(
                nameof(GetSLAConfigurationByWorkflowId),
                new { workflowId = slaConfig.WorkflowId },
                slaConfig
            );
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating SLA configuration: {Message}", ex.Message);
            _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
            return StatusCode(500, new { error = $"An error occurred while creating the SLA configuration: {ex.Message}" });
        }
    }

    [HttpPut("workflow/{workflowId}")]
    public async Task<ActionResult<SLAConfigurationReadDto>> UpdateSLAConfiguration(int workflowId, [FromBody] SLAConfigurationUpdateDto slaUpdateDto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var slaConfig = await _slaService.UpdateSLAConfigurationAsync(workflowId, slaUpdateDto);
            if (slaConfig == null)
                return NotFound(new { error = $"SLA configuration for workflow ID {workflowId} not found" });

            return Ok(slaConfig);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating SLA configuration for workflow {WorkflowId}", workflowId);
            return StatusCode(500, new { error = "An error occurred while updating the SLA configuration" });
        }
    }

    [HttpDelete("workflow/{workflowId}")]
    public async Task<IActionResult> DeleteSLAConfiguration(int workflowId)
    {
        try
        {
            var deleted = await _slaService.DeleteSLAConfigurationAsync(workflowId);
            if (!deleted)
                return NotFound(new { error = $"SLA configuration for workflow ID {workflowId} not found" });

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting SLA configuration for workflow {WorkflowId}", workflowId);
            return StatusCode(500, new { error = "An error occurred while deleting the SLA configuration" });
        }
    }
}

