using TaskService.Application.DTOs;

namespace TaskService.Application.Interfaces;

public interface ITaskAttachmentService
{
    System.Threading.Tasks.Task<TaskAttachmentReadDto> UploadAsync(
        Guid taskId,
        string fileName,
        string? contentType,
        long sizeBytes,
        Stream content,
        CancellationToken cancellationToken = default);

    System.Threading.Tasks.Task<IReadOnlyList<TaskAttachmentReadDto>> GetForTaskAsync(Guid taskId);

    System.Threading.Tasks.Task<(Stream Content, string FileName, string ContentType)?> OpenAsync(Guid attachmentId);
}
