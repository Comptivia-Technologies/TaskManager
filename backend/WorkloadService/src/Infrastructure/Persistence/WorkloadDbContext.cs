using Microsoft.EntityFrameworkCore;
using WorkloadService.Domain.Entities;
using DomainTask = WorkloadService.Domain.Entities.Task;
using DomainStage = WorkloadService.Domain.Entities.Stage;

namespace WorkloadService.Infrastructure.Persistence;

/// <summary>
/// DbContext for Workload Service
/// </summary>
public class WorkloadDbContext : DbContext
{
    public WorkloadDbContext(DbContextOptions<WorkloadDbContext> options) : base(options)
    {
    }

    public DbSet<TaskAssignment> TaskAssignments { get; set; }
    
    // Reference entities from WorkflowManagement database
    public DbSet<Member> Members { get; set; }
    public DbSet<DomainTask> Tasks { get; set; }
    public DbSet<Workflow> Workflows { get; set; }
    public DbSet<DomainStage> Stages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TaskAssignment>(entity =>
        {
            entity.ToTable("TaskAssignments");
            entity.HasKey(e => e.AssignmentId);
            
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.MemberId).IsRequired();
            entity.Property(e => e.WorkloadScore).IsRequired();
            entity.Property(e => e.AssignmentReason).HasMaxLength(500);
            entity.Property(e => e.AssignedAt).IsRequired();

            entity.HasIndex(e => e.TaskId).IsUnique();
            entity.HasIndex(e => e.MemberId);
        });

        // Reference member configuration (read-only)
        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("Members");
            entity.HasKey(e => e.MemberId);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.SkillLevel).IsRequired();
            entity.Property(e => e.TeamId).IsRequired();
        });

        // Reference task configuration (read-only)
        modelBuilder.Entity<DomainTask>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(e => e.TaskId);
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Priority).HasMaxLength(50);
        });

        // Reference workflow configuration (read-only)
        modelBuilder.Entity<Workflow>(entity =>
        {
            entity.ToTable("Workflows");
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TeamId).IsRequired(false);
        });

        // Reference stage configuration (read-only)
        modelBuilder.Entity<DomainStage>(entity =>
        {
            entity.ToTable("Stages");
            entity.HasKey(e => e.StageId);
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.StageOrder).IsRequired();
            entity.Property(e => e.WorkflowId).IsRequired();
            entity.Property(e => e.TeamId).IsRequired();
        });
    }
}

