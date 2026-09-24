using Microsoft.EntityFrameworkCore;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;

namespace TaskService.Infrastructure.Repositories;

public class TaskAttachmentRepository : ITaskAttachmentRepository
{
    private readonly TaskDbContext _context;

    public TaskAttachmentRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AddAsync(TaskAttachment attachment)
    {
        attachment.AttachmentId = attachment.AttachmentId == Guid.Empty ? Guid.NewGuid() : attachment.AttachmentId;
        attachment.UploadedAt = attachment.UploadedAt.Kind switch
        {
            DateTimeKind.Utc => attachment.UploadedAt,
            DateTimeKind.Local => attachment.UploadedAt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(attachment.UploadedAt, DateTimeKind.Utc)
        };

        _context.TaskAttachments.Add(attachment);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskAttachment>> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskAttachments
            .Where(a => a.TaskId == taskId)
            .OrderBy(a => a.UploadedAt)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<TaskAttachment?> GetByIdAsync(Guid attachmentId)
    {
        return await _context.TaskAttachments
            .FirstOrDefaultAsync(a => a.AttachmentId == attachmentId);
    }
}
