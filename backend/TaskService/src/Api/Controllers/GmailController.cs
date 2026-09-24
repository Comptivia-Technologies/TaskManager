using Microsoft.AspNetCore.Mvc;
using TaskService.Application.Interfaces;

namespace TaskService.Api.Controllers;

[ApiController]
[Route("api/task-service/gmail")]
public class GmailController : ControllerBase
{
    private readonly IGmailInboundService _gmail;
    private readonly ILogger<GmailController> _logger;

    public GmailController(IGmailInboundService gmail, ILogger<GmailController> logger)
    {
        _gmail = gmail;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Push()
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();
            var authorization = Request.Headers.Authorization.ToString();
            await _gmail.HandlePushAsync(body, authorization);
            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Rejected Gmail push");
            return Unauthorized(new { error = "Unauthorized" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail push failed");
            return StatusCode(500, new { error = "Gmail push failed" });
        }
    }

    [HttpPost("watch")]
    public async Task<IActionResult> Watch()
    {
        try
        {
            var key = Request.Headers["X-Gmail-Watch-Key"].FirstOrDefault();
            await _gmail.RenewWatchAsync(key);
            return Ok(new { message = "Gmail watch renewed" });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Unauthorized" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail watch renewal failed");
            return StatusCode(500, new { error = "Gmail watch renewal failed" });
        }
    }
}
