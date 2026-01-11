using Microsoft.EntityFrameworkCore;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;
using DomainTask = TaskService.Domain.Entities.Task;

namespace TaskService.Infrastructure.Repositories;

/// <summary>
/// Repository implementation for Task entity
/// </summary>
public class TaskRepository : ITaskRepository
{
    private readonly TaskDbContext _context;

    public TaskRepository(TaskDbContext context)
    {
        _context = context;
    }

    public async System.Threading.Tasks.Task<DomainTask?> GetByIdAsync(Guid taskId)
    {
        return await _context.Tasks
            .FirstOrDefaultAsync(t => t.TaskId == taskId);
    }

    public async System.Threading.Tasks.Task<DomainTask?> GetByEventIdAsync(string eventType, Guid eventId)
    {
        return eventType switch
        {
            "WorkflowSelectedEvent" => await _context.Tasks
                .FirstOrDefaultAsync(t => t.WorkflowSelectedEventId == eventId),
            "SLAConfiguredEvent" => await _context.Tasks
                .FirstOrDefaultAsync(t => t.SLAConfiguredEventId == eventId),
            "TaskAssignedEvent" => await _context.Tasks
                .FirstOrDefaultAsync(t => t.TaskAssignedEventId == eventId),
            "TaskOverdueEvent" => await _context.Tasks
                .FirstOrDefaultAsync(t => t.TaskOverdueEventId == eventId),
            _ => null
        };
    }

    public async System.Threading.Tasks.Task<DomainTask> CreateAsync(DomainTask task)
    {
        _context.Tasks.Add(task);
        await _context.SaveChangesAsync();
        return task;
    }

    public async System.Threading.Tasks.Task<DomainTask> UpdateAsync(DomainTask task)
    {
        task.UpdatedAt = DateTime.UtcNow;
        
        // Load existing task to preserve event IDs that might already be set
        var existingTask = await _context.Tasks.FindAsync(task.TaskId);
        if (existingTask != null)
        {
            // Preserve event IDs if they're already set (don't overwrite with NULL)
            if (existingTask.WorkflowSelectedEventId.HasValue && !task.WorkflowSelectedEventId.HasValue)
            {
                task.WorkflowSelectedEventId = existingTask.WorkflowSelectedEventId;
            }
            if (existingTask.SLAConfiguredEventId.HasValue && !task.SLAConfiguredEventId.HasValue)
            {
                task.SLAConfiguredEventId = existingTask.SLAConfiguredEventId;
            }
            if (existingTask.TaskAssignedEventId.HasValue && !task.TaskAssignedEventId.HasValue)
            {
                task.TaskAssignedEventId = existingTask.TaskAssignedEventId;
            }
            if (existingTask.TaskOverdueEventId.HasValue && !task.TaskOverdueEventId.HasValue)
            {
                task.TaskOverdueEventId = existingTask.TaskOverdueEventId;
            }
            
            // Update all properties
            _context.Entry(existingTask).CurrentValues.SetValues(task);
        }
        else
        {
            _context.Tasks.Update(task);
        }
        
        await _context.SaveChangesAsync();
        return task;
    }

    public async System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetOverdueTasksAsync()
    {
        return await _context.Tasks
            .Where(t => t.SLADeadline.HasValue 
                && t.SLADeadline.Value < DateTime.UtcNow 
                && !t.IsOverdue
                && t.Status != TaskService.Domain.Enums.TaskStatus.Completed
                && t.Status != TaskService.Domain.Enums.TaskStatus.Cancelled)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<bool> ExistsAsync(Guid taskId)
    {
        return await _context.Tasks.AnyAsync(t => t.TaskId == taskId);
    }
}

