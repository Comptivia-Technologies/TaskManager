using Microsoft.AspNetCore.Mvc;

namespace APIGateway.Api.Controllers;

/// <summary>
/// Health check endpoint for Load Balancer API Gateway
/// </summary>
[ApiController]
[Route("")]
public class HealthController : ControllerBase
{
    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", service = "API Gateway" });
    }
}
