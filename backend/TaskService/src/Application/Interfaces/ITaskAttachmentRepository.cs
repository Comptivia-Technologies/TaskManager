using TaskService.Domain.Entities;

namespace TaskService.Application.Interfaces;

public interface ITaskAttachmentRepository
{
    System.Threading.Tasks.Task AddAsync(TaskAttachment attachment);
    System.Threading.Tasks.Task<IReadOnlyList<TaskAttachment>> GetByTaskIdAsync(Guid taskId);
    System.Threading.Tasks.Task<TaskAttachment?> GetByIdAsync(Guid attachmentId);
}
