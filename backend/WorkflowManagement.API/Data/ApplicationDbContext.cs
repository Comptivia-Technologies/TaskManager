using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Team> Teams { get; set; }
    public DbSet<Member> Members { get; set; }
    public DbSet<Workflow> Workflows { get; set; }
    public DbSet<Stage> Stages { get; set; }
    public DbSet<Models.Task> Tasks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Team configuration for WorkflowManagement.API
        modelBuilder.Entity<Team>(entity =>
        {
            entity.HasKey(e => e.TeamId);
            entity.Property(e => e.TeamName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
        });

        // Member configuration for WorkflowManagement.API
        modelBuilder.Entity<Member>(entity =>
        {
            entity.HasKey(e => e.MemberId);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Role).IsRequired().HasMaxLength(100);
            entity.Property(e => e.SkillLevel).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            entity.Property(e => e.TeamId).IsRequired(false);

            entity.HasOne(m => m.Team)
                .WithMany(t => t.Members)
                .HasForeignKey(m => m.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        });

        // Workflow configuration
        modelBuilder.Entity<Workflow>(entity =>
        {
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.TeamId).IsRequired(false);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
            
            // JSONB column for storing workflow JSON
            entity.Property(e => e.WorkflowJson)
                .HasColumnType("jsonb")
                .IsRequired(false);

            entity.HasOne(w => w.Team)
                .WithMany(t => t.Workflows)
                .HasForeignKey(w => w.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        });

        // Stage configuration
        modelBuilder.Entity<Stage>(entity =>
        {
            entity.HasKey(e => e.StageId);
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.StageOrder).IsRequired();
            entity.Property(e => e.TeamId).IsRequired();
            entity.Property(e => e.CreatedAt).IsRequired();
            
            // Stage orchestration fields
            entity.Property(e => e.StageType)
                .HasConversion<int>() // Store as integer in database
                .IsRequired()
                .HasDefaultValue(StageType.Process);
            
            entity.Property(e => e.TransitionPolicy)
                .HasConversion<int>() // Store as integer in database
                .IsRequired()
                .HasDefaultValue(TransitionPolicy.OnComplete);
            
            entity.Property(e => e.TimeoutMinutes)
                .IsRequired(false);

            entity.HasOne(s => s.Workflow)
                .WithMany(w => w.Stages)
                .HasForeignKey(s => s.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(s => s.Team)
                .WithMany()
                .HasForeignKey(s => s.TeamId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Task configuration
        modelBuilder.Entity<Models.Task>(entity =>
        {
            entity.HasKey(e => e.TaskId);
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();

            entity.HasOne(t => t.Workflow)
                .WithMany(w => w.Tasks)
                .HasForeignKey(t => t.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Stage)
                .WithMany(s => s.Tasks)
                .HasForeignKey(t => t.StageId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.AssignedToMember)
                .WithMany(m => m.AssignedTasks)
                .HasForeignKey(t => t.AssignedToMemberId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}

