using Microsoft.AspNetCore.Mvc;
using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;

namespace TaskService.Api.Controllers;

[ApiController]
[Route("api/task-service")]
public class AttachmentsController : ControllerBase
{
    private readonly ITaskAttachmentService _attachmentService;
    private readonly ILogger<AttachmentsController> _logger;

    public AttachmentsController(ITaskAttachmentService attachmentService, ILogger<AttachmentsController> logger)
    {
        _attachmentService = attachmentService;
        _logger = logger;
    }

    /// <summary>
    /// Upload a file against a task. It is tagged with whichever stage the task is on.
    /// </summary>
    [HttpPost("{id}/attachments")]
    [RequestSizeLimit(26 * 1024 * 1024)]
    public async Task<ActionResult<TaskAttachmentReadDto>> Upload(Guid id, IFormFile file)
    {
        try
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "A file is required." });

            await using var stream = file.OpenReadStream();
            var created = await _attachmentService.UploadAsync(
                id, file.FileName, file.ContentType, file.Length, stream, HttpContext.RequestAborted);

            return Ok(created);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading attachment for task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while uploading the file" });
        }
    }

    /// <summary>
    /// Files uploaded against a task.
    /// </summary>
    [HttpGet("{id}/attachments")]
    public async Task<ActionResult<IReadOnlyList<TaskAttachmentReadDto>>> List(Guid id)
    {
        try
        {
            return Ok(await _attachmentService.GetForTaskAsync(id));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listing attachments for task {TaskId}", id);
            return StatusCode(500, new { error = "An error occurred while retrieving attachments" });
        }
    }

    /// <summary>
    /// Download a file. Always served as an attachment so an uploaded HTML or SVG
    /// file cannot be rendered inline and run script against this origin.
    /// </summary>
    [HttpGet("attachments/{attachmentId}")]
    public async Task<IActionResult> Download(Guid attachmentId)
    {
        try
        {
            var found = await _attachmentService.OpenAsync(attachmentId);
            if (found == null)
                return NotFound(new { error = "Attachment not found" });

            return File(found.Value.Content, "application/octet-stream", found.Value.FileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading attachment {AttachmentId}", attachmentId);
            return StatusCode(500, new { error = "An error occurred while downloading the file" });
        }
    }
}
