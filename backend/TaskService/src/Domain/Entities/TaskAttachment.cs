namespace TaskService.Domain.Entities;

/// <summary>
/// A file uploaded against a task, optionally tied to the stage it was added at.
/// FileName is what the uploader called it and is only ever echoed back; the bytes
/// live at StorageKey, which the service generates.
/// </summary>
public class TaskAttachment
{
    public Guid AttachmentId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Guid TaskId { get; set; }
    public Guid? StageId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long SizeBytes { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public Guid? UploadedByMemberId { get; set; }
    public DateTime UploadedAt { get; set; }
}
