using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;

namespace TaskService.Application.Services;

public class TaskAttachmentService : ITaskAttachmentService
{
    private const long DefaultMaxBytes = 25L * 1024 * 1024;

    private readonly ITaskRepository _taskRepository;
    private readonly ITaskAttachmentRepository _attachmentRepository;
    private readonly IFileStorage _storage;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TaskAttachmentService> _logger;

    public TaskAttachmentService(
        ITaskRepository taskRepository,
        ITaskAttachmentRepository attachmentRepository,
        IFileStorage storage,
        IConfiguration configuration,
        ILogger<TaskAttachmentService> logger)
    {
        _taskRepository = taskRepository;
        _attachmentRepository = attachmentRepository;
        _storage = storage;
        _configuration = configuration;
        _logger = logger;
    }

    private long MaxBytes =>
        long.TryParse(_configuration["FileStorage:MaxBytes"], out var configured) && configured > 0
            ? configured
            : DefaultMaxBytes;

    public async System.Threading.Tasks.Task<TaskAttachmentReadDto> UploadAsync(
        Guid taskId,
        string fileName,
        string? contentType,
        long sizeBytes,
        Stream content,
        CancellationToken cancellationToken = default)
    {
        var task = await _taskRepository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        if (sizeBytes <= 0)
            throw new InvalidOperationException("The file is empty.");

        if (sizeBytes > MaxBytes)
            throw new InvalidOperationException($"The file exceeds the {MaxBytes / (1024 * 1024)} MB limit.");

        var safeName = SafeFileName(fileName);

        // The storage key is generated, never built from the uploaded name, so a
        // crafted filename cannot steer where the bytes land.
        var storageKey = $"{task.OrganizationId}/{taskId}/{Guid.NewGuid():N}{SafeExtension(safeName)}";

        await _storage.SaveAsync(storageKey, content, cancellationToken);

        var attachment = new TaskAttachment
        {
            OrganizationId = task.OrganizationId,
            TaskId = taskId,
            StageId = task.CurrentStageId,
            FileName = safeName,
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
            SizeBytes = sizeBytes,
            StorageKey = storageKey,
            UploadedByMemberId = task.MemberId,
            UploadedAt = DateTime.UtcNow
        };

        await _attachmentRepository.AddAsync(attachment);
        _logger.LogInformation(
            "Attachment stored. TaskId: {TaskId}, AttachmentId: {AttachmentId}, Bytes: {Bytes}",
            taskId, attachment.AttachmentId, sizeBytes);

        return MapToDto(attachment);
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskAttachmentReadDto>> GetForTaskAsync(Guid taskId)
    {
        var task = await _taskRepository.GetByIdAsync(taskId);
        if (task == null)
            throw new KeyNotFoundException($"Task with ID {taskId} not found");

        var rows = await _attachmentRepository.GetByTaskIdAsync(taskId);
        return rows.Select(MapToDto).ToList();
    }

    public async System.Threading.Tasks.Task<(Stream Content, string FileName, string ContentType)?> OpenAsync(Guid attachmentId)
    {
        var attachment = await _attachmentRepository.GetByIdAsync(attachmentId);
        if (attachment == null)
            return null;

        var stream = await _storage.OpenReadAsync(attachment.StorageKey);
        if (stream == null)
        {
            _logger.LogWarning(
                "Attachment row exists but its file is missing. AttachmentId: {AttachmentId}, StorageKey: {StorageKey}",
                attachmentId, attachment.StorageKey);
            return null;
        }

        return (stream, attachment.FileName, attachment.ContentType);
    }

    // Keeps the leaf name only, so "../../secrets.txt" reduces to "secrets.txt",
    // and strips characters that would be awkward in a download header.
    private static string SafeFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            return "upload";

        var leaf = Path.GetFileName(fileName.Replace('\\', '/'));
        var cleaned = new string(leaf.Where(c => !char.IsControl(c) && c != '"' && c != '\r' && c != '\n').ToArray()).Trim();

        if (string.IsNullOrWhiteSpace(cleaned) || cleaned == "." || cleaned == "..")
            return "upload";

        return cleaned.Length > 200 ? cleaned[^200..] : cleaned;
    }

    private static string SafeExtension(string safeName)
    {
        var extension = Path.GetExtension(safeName);
        if (string.IsNullOrWhiteSpace(extension) || extension.Length > 20)
            return string.Empty;

        var cleaned = new string(extension.Where(c => char.IsLetterOrDigit(c) || c == '.').ToArray());
        return cleaned == "." ? string.Empty : cleaned;
    }

    private static TaskAttachmentReadDto MapToDto(TaskAttachment attachment) => new()
    {
        AttachmentId = attachment.AttachmentId,
        TaskId = attachment.TaskId,
        StageId = attachment.StageId,
        FileName = attachment.FileName,
        ContentType = attachment.ContentType,
        SizeBytes = attachment.SizeBytes,
        UploadedByMemberId = attachment.UploadedByMemberId,
        UploadedAt = attachment.UploadedAt
    };
}
