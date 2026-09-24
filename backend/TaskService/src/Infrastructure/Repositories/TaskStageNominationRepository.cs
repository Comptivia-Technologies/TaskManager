using Microsoft.EntityFrameworkCore;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;

namespace TaskService.Infrastructure.Repositories;

public class TaskStageNominationRepository : ITaskStageNominationRepository
{
    private readonly TaskDbContext _context;

    public TaskStageNominationRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task AddAsync(TaskStageNomination nomination)
    {
        nomination.NominationId = nomination.NominationId == Guid.Empty ? Guid.NewGuid() : nomination.NominationId;
        nomination.NominatedAt = nomination.NominatedAt.Kind switch
        {
            DateTimeKind.Utc => nomination.NominatedAt,
            DateTimeKind.Local => nomination.NominatedAt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(nomination.NominatedAt, DateTimeKind.Utc)
        };

        _context.TaskStageNominations.Add(nomination);
        await _context.SaveChangesAsync();
    }

    // Most recent wins, so a later nomination quietly supersedes an earlier one.
    public async System.Threading.Tasks.Task<TaskStageNomination?> GetForStageAsync(Guid taskId, Guid stageId)
    {
        return await _context.TaskStageNominations
            .Where(n => n.TaskId == taskId && n.StageId == stageId)
            .OrderByDescending(n => n.NominatedAt)
            .FirstOrDefaultAsync();
    }
}
