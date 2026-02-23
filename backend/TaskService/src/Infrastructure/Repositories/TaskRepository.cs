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
            "TaskStageEscalatedEvent" => await _context.Tasks
                .FirstOrDefaultAsync(t => t.TaskStageEscalatedEventId == eventId),
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
        
        // Load existing task to preserve values that shouldn't be overwritten with NULL
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
            
            // Preserve WorkflowId and MemberId if they're already set (don't overwrite with NULL)
            if (existingTask.WorkflowId.HasValue && !task.WorkflowId.HasValue)
            {
                task.WorkflowId = existingTask.WorkflowId;
            }
            if (existingTask.MemberId.HasValue && !task.MemberId.HasValue)
            {
                task.MemberId = existingTask.MemberId;
            }
            
            // Preserve SLA fields if they're already set (don't overwrite with NULL)
            if (existingTask.SLAStartTime.HasValue && !task.SLAStartTime.HasValue)
            {
                task.SLAStartTime = existingTask.SLAStartTime;
            }
            if (existingTask.SLADeadline.HasValue && !task.SLADeadline.HasValue)
            {
                task.SLADeadline = existingTask.SLADeadline;
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

    public async System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetAlreadyOverdueTasksAsync()
    {
        return await _context.Tasks
            .Where(t => t.IsOverdue 
                && t.Status == TaskService.Domain.Enums.TaskStatus.Overdue
                && t.WorkflowId.HasValue 
                && t.MemberId.HasValue)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<bool> DeleteAsync(Guid taskId)
    {
        var task = await _context.Tasks.FindAsync(taskId);
        if (task == null)
            return false;

        _context.Tasks.Remove(task);
        await _context.SaveChangesAsync();
        return true;
    }

    public async System.Threading.Tasks.Task<IEnumerable<string>> GetAllTaskNamesAsync()
    {
        return await _context.Tasks
            .Select(t => t.TaskName)
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<IEnumerable<Guid>> GetDistinctOrganizationIdsAsync()
    {
        return await _context.Tasks
            .Select(t => t.OrganizationId)
            .Distinct()
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<bool> ExistsAsync(Guid taskId)
    {
        return await _context.Tasks.AnyAsync(t => t.TaskId == taskId);
    }
}

