using Microsoft.EntityFrameworkCore;
using WorkflowService.Domain.Entities;

namespace WorkflowService.Infrastructure.Persistence;

/// <summary>
/// DbContext for Workflow Service
/// </summary>
public class WorkflowDbContext : DbContext
{
    public WorkflowDbContext(DbContextOptions<WorkflowDbContext> options) : base(options)
    {
    }

    public DbSet<WorkflowSelection> WorkflowSelections { get; set; }
    
    // Reference to Workflows table from WorkflowManagement database
    public DbSet<Application.Interfaces.Workflow> Workflows { get; set; }
    
    // Reference to Stages table from WorkflowManagement database (using database entity)
    public DbSet<StageDbEntity> Stages { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<WorkflowSelection>(entity =>
        {
            entity.ToTable("WorkflowSelections");
            entity.HasKey(e => e.SelectionId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.WorkflowId).IsRequired();
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.SelectionReason).HasMaxLength(500);
            entity.Property(e => e.SelectedAt).IsRequired();
            
            // Stage orchestration tracking
            entity.Property(e => e.StageOrchestrationStarted).IsRequired().HasDefaultValue(false);
            entity.Property(e => e.StageOrchestrationStartedAt).IsRequired(false);

            entity.HasIndex(e => e.TaskId).IsUnique();
            entity.HasIndex(e => e.WorkflowId);
        });

        // Reference workflow configuration (read-only)
        modelBuilder.Entity<Application.Interfaces.Workflow>(entity =>
        {
            entity.ToTable("Workflows");
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TeamId).IsRequired(false);
        });
        
        // Reference stage configuration (read-only)
        // Use StageDbEntity which matches the database structure
        modelBuilder.Entity<StageDbEntity>(entity =>
        {
            entity.ToTable("Stages");
            entity.HasKey(e => e.StageId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.StageOrder).IsRequired();
            entity.Property(e => e.WorkflowId).IsRequired();
            entity.Property(e => e.TeamId).IsRequired();
            entity.Property(e => e.StageType).IsRequired();
            entity.Property(e => e.TransitionPolicy).IsRequired();
            entity.Property(e => e.TimeoutMinutes).IsRequired(false);
        });
    }
}

