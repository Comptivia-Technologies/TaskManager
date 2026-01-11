using Microsoft.EntityFrameworkCore;
using TaskService.Domain.Entities;
using DomainTask = TaskService.Domain.Entities.Task;

namespace TaskService.Infrastructure.Persistence;

/// <summary>
/// DbContext for Task Service
/// </summary>
public class TaskDbContext : DbContext
{
    public TaskDbContext(DbContextOptions<TaskDbContext> options) : base(options)
    {
    }

    public DbSet<DomainTask> Tasks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DomainTask>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(e => e.TaskId);
            
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TaskType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Status).IsRequired().HasConversion<int>();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            // Indexes for performance
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.WorkflowId);
            entity.HasIndex(e => e.MemberId);
            entity.HasIndex(e => e.SLADeadline);
            entity.HasIndex(e => e.IsOverdue);
            
            // Indexes for idempotency checks
            entity.HasIndex(e => e.WorkflowSelectedEventId);
            entity.HasIndex(e => e.SLAConfiguredEventId);
            entity.HasIndex(e => e.TaskAssignedEventId);
        });
    }
}

