using Microsoft.EntityFrameworkCore;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;

namespace TaskService.Infrastructure.Repositories;

public class TaskStageHistoryRepository : ITaskStageHistoryRepository
{
    private readonly TaskDbContext _context;

    public TaskStageHistoryRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AppendAsync(TaskStageHistory entry)
    {
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                await AppendOnceAsync(entry);
                return;
            }
            catch (DbUpdateException) when (attempt == 0)
            {
                _context.ChangeTracker.Clear();
            }
        }
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<TaskStageHistory>> GetByTaskIdAsync(Guid taskId)
    {
        return await _context.TaskStageHistories
            .Where(h => h.TaskId == taskId)
            .OrderBy(h => h.Sequence)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<TaskStageHistory?> GetLastAssignmentAsync(Guid taskId, Guid stageId)
    {
        return await _context.TaskStageHistories
            .Where(h => h.TaskId == taskId && h.StageId == stageId && h.Action == TaskStageHistory.Assigned)
            .OrderByDescending(h => h.Sequence)
            .FirstOrDefaultAsync();
    }

    private async System.Threading.Tasks.Task AppendOnceAsync(TaskStageHistory entry)
    {
        var exists = await _context.TaskStageHistories
            .AnyAsync(h => h.CorrelationId == entry.CorrelationId && h.Action == entry.Action);
        if (exists)
            return;

        var maxSequence = await _context.TaskStageHistories
            .Where(h => h.TaskId == entry.TaskId)
            .Select(h => (int?)h.Sequence)
            .MaxAsync() ?? 0;

        entry.HistoryId = entry.HistoryId == Guid.Empty ? Guid.NewGuid() : entry.HistoryId;
        entry.Sequence = maxSequence + 1;
        entry.OccurredAt = EnsureUtc(entry.OccurredAt);

        _context.TaskStageHistories.Add(entry);
        await _context.SaveChangesAsync();
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
