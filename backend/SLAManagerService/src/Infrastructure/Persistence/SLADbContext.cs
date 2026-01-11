using Microsoft.EntityFrameworkCore;
using SLAManagerService.Domain.Entities;

namespace SLAManagerService.Infrastructure.Persistence;

/// <summary>
/// DbContext for SLA Manager Service
/// </summary>
public class SLADbContext : DbContext
{
    public SLADbContext(DbContextOptions<SLADbContext> options) : base(options)
    {
    }

    public DbSet<SLAAssignment> SLAAssignments { get; set; }
    
    // Reference to SLAConfigurations table from SLAConfiguration database
    public DbSet<SLAConfiguration> SLAConfigurations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<SLAAssignment>(entity =>
        {
            entity.ToTable("SLAAssignments");
            entity.HasKey(e => e.SLAAssignmentId);
            
            entity.Property(e => e.TaskId).IsRequired();
            entity.Property(e => e.WorkflowId).IsRequired();
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ResponseTimeMinutes).IsRequired();
            
            // Configure DateTime properties to use timestamp with time zone (PostgreSQL recommended)
            // This ensures UTC times are stored and retrieved correctly
            entity.Property(e => e.SLAStartTime)
                .IsRequired()
                .HasColumnType("timestamp with time zone");
            entity.Property(e => e.SLADeadline)
                .IsRequired()
                .HasColumnType("timestamp with time zone");
            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasColumnType("timestamp with time zone");

            entity.HasIndex(e => e.TaskId).IsUnique();
            entity.HasIndex(e => e.WorkflowId);
            entity.HasIndex(e => e.SLADeadline);
            entity.HasIndex(e => e.IsOverdue);
        });

        // Reference SLA configuration (read-only)
        modelBuilder.Entity<SLAConfiguration>(entity =>
        {
            entity.ToTable("SLAConfigurations");
            entity.HasKey(e => e.SLAConfigurationId);
            entity.Property(e => e.WorkflowId).IsRequired();
        });
    }
}

