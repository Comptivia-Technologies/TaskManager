namespace TaskService.Application.DTOs;

public class TaskAttachmentReadDto
{
    public Guid AttachmentId { get; set; }
    public Guid TaskId { get; set; }
    public Guid? StageId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public Guid? UploadedByMemberId { get; set; }
    public DateTime UploadedAt { get; set; }
}
