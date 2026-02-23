using Microsoft.EntityFrameworkCore;
using Workload.API.Models;
using TaskModel = Workload.API.Models.Task;

namespace Workload.API.Data;

public class WorkloadDbContext : DbContext
{
    public WorkloadDbContext(DbContextOptions<WorkloadDbContext> options) : base(options)
    {
    }

    public DbSet<Models.Workload> Workloads { get; set; }
    
    // Reference to Members and Tasks tables from WorkflowManagement database
    public DbSet<Member> Members { get; set; }
    public DbSet<TaskModel> Tasks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Workload configuration
        modelBuilder.Entity<Models.Workload>(entity =>
        {
            entity.ToTable("Workloads");
            entity.HasKey(e => e.WorkloadId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.MemberId).IsRequired();
            entity.Property(e => e.WorkloadScore).IsRequired();
            entity.Property(e => e.WorkloadStatus).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Efficiency).IsRequired();
            entity.Property(e => e.SkillLevel).IsRequired();
            entity.Property(e => e.TaskCompletionRate).IsRequired();
            entity.Property(e => e.ActiveTaskCount).IsRequired();
            entity.Property(e => e.PendingTaskCount).IsRequired();
            entity.Property(e => e.IsAvailable).IsRequired();
            entity.Property(e => e.CalculatedAt).IsRequired().HasColumnType("timestamp with time zone");
            entity.Property(e => e.CreatedAt).IsRequired().HasColumnType("timestamp with time zone");

            entity.HasIndex(w => w.MemberId);
            entity.HasIndex(w => w.CalculatedAt);
        });

        // Member reference configuration (read-only from existing table)
        modelBuilder.Entity<Member>(entity =>
        {
            entity.ToTable("Members");
            entity.HasKey(e => e.MemberId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(255);
            entity.Property(e => e.Role).HasMaxLength(100);
            entity.Property(e => e.SkillLevel).IsRequired();
            // This entity is read-only, used only for querying data
        });

        // Task reference configuration (read-only from existing table)
        modelBuilder.Entity<TaskModel>(entity =>
        {
            entity.ToTable("Tasks");
            entity.HasKey(e => e.TaskId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Status).HasMaxLength(50);
            entity.Property(e => e.Priority).HasMaxLength(50);
            // This entity is read-only, used only for querying data
        });
    }
}

