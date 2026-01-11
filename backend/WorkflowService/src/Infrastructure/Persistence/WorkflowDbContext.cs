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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<WorkflowSelection>(entity =>
        {
            entity.ToTable("WorkflowSelections");
            entity.HasKey(e => e.SelectionId);
            
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.WorkflowId).IsRequired();
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.SelectionReason).HasMaxLength(500);
            entity.Property(e => e.SelectedAt).IsRequired();

            entity.HasIndex(e => e.TaskId).IsUnique();
            entity.HasIndex(e => e.WorkflowId);
        });

        // Reference workflow configuration (read-only)
        modelBuilder.Entity<Application.Interfaces.Workflow>(entity =>
        {
            entity.ToTable("Workflows");
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.TeamId).IsRequired(false);
        });
    }
}

