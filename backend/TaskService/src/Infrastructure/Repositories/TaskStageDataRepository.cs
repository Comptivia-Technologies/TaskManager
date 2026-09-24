using Microsoft.EntityFrameworkCore;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;

namespace TaskService.Infrastructure.Repositories;

public class TaskStageDataRepository : ITaskStageDataRepository
{
    private readonly TaskDbContext _context;

    public TaskStageDataRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AppendAsync(TaskStageData entry)
    {
        entry.StageDataId = entry.StageDataId == Guid.Empty ? Guid.NewGuid() : entry.StageDataId;
        entry.SubmittedAt = EnsureUtc(entry.SubmittedAt);

        _context.TaskStageDataEntries.Add(entry);
        await _context.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskStageData>> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskStageDataEntries
            .Where(d => d.TaskId == taskId)
            .OrderBy(d => d.SubmittedAt)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskStageData>> GetLatestPerStageAsync(Guid taskId)
    {
        var rows = await GetByTaskIdAsync(taskId);
        return rows
            .GroupBy(d => d.StageId)
            .Select(g => g.OrderByDescending(d => d.SubmittedAt).First())
            .ToList();
    }

    private static DateTime EnsureUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
