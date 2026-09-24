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
    public DbSet<TaskStageHistory> TaskStageHistories { get; set; }
    public DbSet<TaskStageData> TaskStageDataEntries { get; set; }
    public DbSet<TaskAttachment> TaskAttachments { get; set; }
    public DbSet<TaskStageNomination> TaskStageNominations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<DomainTask>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(e => e.TaskId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.Property(e => e.TaskType).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Status).IsRequired().HasConversion<int>();
            entity.Property(e => e.DataJson).HasColumnType("jsonb").IsRequired(false);
            entity.Property(e => e.CreatedByMemberId).IsRequired(false);
            entity.Property(e => e.ReturnedAt).IsRequired(false).HasColumnType("timestamp with time zone");
            entity.Property(e => e.ReturnReason).IsRequired(false);
            entity.Property(e => e.ReturnedFromStageName).IsRequired(false).HasMaxLength(200);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            
            // Stage tracking fields
            entity.Property(e => e.CurrentStageId).IsRequired(false);
            entity.Property(e => e.CurrentStageStartedAt).IsRequired(false).HasColumnType("timestamp with time zone");
            entity.Property(e => e.StageTimeoutAt).IsRequired(false).HasColumnType("timestamp with time zone");

            // Indexes for performance
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.WorkflowId);
            entity.HasIndex(e => e.MemberId);
            entity.HasIndex(e => e.CurrentStageId);
            entity.HasIndex(e => e.SLADeadline);
            entity.HasIndex(e => e.StageTimeoutAt); // For escalation monitoring
            entity.HasIndex(e => e.IsOverdue);
            
            // Indexes for idempotency checks
            entity.HasIndex(e => e.WorkflowSelectedEventId);
            entity.HasIndex(e => e.SLAConfiguredEventId);
            entity.HasIndex(e => e.TaskAssignedEventId);
            entity.HasIndex(e => e.TaskStageStartedEventId);
            entity.HasIndex(e => e.TaskStageCompletedEventId);
            entity.HasIndex(e => e.TaskStageEscalatedEventId);
            entity.HasIndex(e => e.TaskStageEscalationTriggeredEventId);
            entity.HasIndex(e => e.TaskCompletedEventId);
        });

        modelBuilder.Entity<TaskStageHistory>(entity =>
        {
            entity.ToTable("TaskStageHistory");
            entity.HasKey(e => e.HistoryId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.Sequence).IsRequired();
            entity.Property(e => e.Action).IsRequired().HasMaxLength(20);
            entity.Property(e => e.StageId).IsRequired();
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.StageOrder).IsRequired();
            entity.Property(e => e.MemberId).IsRequired();
            entity.Property(e => e.MemberName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.FromStageName).HasMaxLength(200);
            entity.Property(e => e.ToStageName).HasMaxLength(200);
            entity.Property(e => e.OccurredAt).IsRequired().HasColumnType("timestamp with time zone");
            entity.Property(e => e.CorrelationId).IsRequired();
            entity.HasIndex(e => e.TaskId);
            entity.HasIndex(e => new { e.TaskId, e.Sequence }).IsUnique();
            entity.HasIndex(e => new { e.CorrelationId, e.Action }).IsUnique();
        });

        modelBuilder.Entity<TaskStageData>(entity =>
        {
            entity.ToTable("TaskStageData");
            entity.HasKey(e => e.StageDataId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.StageId).IsRequired();
            entity.Property(e => e.DataJson).IsRequired().HasColumnType("jsonb");
            entity.Property(e => e.SubmittedAt).IsRequired().HasColumnType("timestamp with time zone");
            entity.HasIndex(e => e.TaskId);
            entity.HasIndex(e => new { e.TaskId, e.StageId });
        });

        modelBuilder.Entity<TaskStageNomination>(entity =>
        {
            entity.ToTable("TaskStageNomination");
            entity.HasKey(e => e.NominationId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.StageId).IsRequired();
            entity.Property(e => e.MemberId).IsRequired();
            entity.Property(e => e.NominatedAt).IsRequired().HasColumnType("timestamp with time zone");
            entity.HasIndex(e => e.TaskId);
            entity.HasIndex(e => new { e.TaskId, e.StageId });
        });

        modelBuilder.Entity<TaskAttachment>(entity =>
        {
            entity.ToTable("TaskAttachment");
            entity.HasKey(e => e.AttachmentId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.FileName).IsRequired().HasMaxLength(260);
            entity.Property(e => e.ContentType).IsRequired().HasMaxLength(200);
            entity.Property(e => e.SizeBytes).IsRequired();
            entity.Property(e => e.StorageKey).IsRequired().HasMaxLength(400);
            entity.Property(e => e.UploadedAt).IsRequired().HasColumnType("timestamp with time zone");
            entity.HasIndex(e => e.TaskId);
            entity.HasIndex(e => new { e.TaskId, e.StageId });
        });
    }
}

