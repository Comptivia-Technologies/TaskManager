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

    [HttpGet("authorize")]
    public ActionResult Authorize([FromQuery] string? email)
    {
        try
        {
            return Ok(new { url = _gmail.BuildAuthorizeUrl(email) });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Could not build the Gmail authorize URL");
            return StatusCode(500, new { error = "Gmail is not configured" });
        }
    }

    [HttpGet("mailboxes")]
    public async Task<ActionResult> List()
    {
        var organizationId = ReadOrganizationId();
        if (organizationId == Guid.Empty)
            return Unauthorized(new { error = "Organization context required" });
        var mailboxes = await _gmail.ListMailboxesAsync(organizationId);
        return Ok(mailboxes);
    }

    [HttpPost("mailboxes")]
    public async Task<ActionResult> Connect([FromBody] GmailConnectRequest request)
    {
        try
        {
            var organizationId = ReadOrganizationId();
            var mailbox = await _gmail.ConnectAsync(request.Code, organizationId);
            return Ok(mailbox);
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Unauthorized" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Gmail mailbox connect failed");
            return StatusCode(500, new { error = "Could not connect the mailbox" });
        }
    }

    [HttpDelete("mailboxes/{mailboxId:guid}")]
    public async Task<ActionResult> Disconnect(Guid mailboxId)
    {
        var organizationId = ReadOrganizationId();
        if (organizationId == Guid.Empty)
            return Unauthorized(new { error = "Organization context required" });
        await _gmail.DisconnectAsync(mailboxId, organizationId);
        return NoContent();
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

    private Guid ReadOrganizationId()
    {
        var header = Request.Headers["X-Organization-Id"].FirstOrDefault();
        return Guid.TryParse(header, out var organizationId) ? organizationId : Guid.Empty;
    }
}

public class GmailConnectRequest
{
    public string Code { get; set; } = string.Empty;
}
