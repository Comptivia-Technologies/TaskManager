using Microsoft.AspNetCore.Mvc;
using Workload.API.DTOs;
using Workload.API.Services;

namespace Workload.API.Controllers;

/// <summary>
/// Controller for workload management and calculation for Workload.API
/// </summary>
[ApiController]
[Route("api/workload")]
public class WorkloadController : ControllerBase
{
    private readonly IWorkloadService _workloadService;
    private readonly ILogger<WorkloadController> _logger;

    public WorkloadController(IWorkloadService workloadService, ILogger<WorkloadController> logger)
    {
        _workloadService = workloadService;
        _logger = logger;
    }

    /// <summary>
    /// Gets workload summary for a specific member
    /// </summary>
    /// <param name="memberId">The ID of the member</param>
    /// <returns>Workload response with score, status, and metrics</returns>
    [HttpGet("{memberId}")]
    public async System.Threading.Tasks.Task<ActionResult<WorkloadResponseDto>> GetWorkloadByMemberId(int memberId)
    {
        try
        {
            var workload = await _workloadService.GetWorkloadByMemberIdAsync(memberId);
            return Ok(workload);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Member with ID {MemberId} not found", memberId);
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting workload for member {MemberId}. Exception: {ExceptionMessage}. StackTrace: {StackTrace}", 
                memberId, ex.Message, ex.StackTrace);
            return StatusCode(500, new { 
                error = "An error occurred while calculating workload",
                details = ex.Message,
                innerException = ex.InnerException?.Message
            });
        }
    }
}

