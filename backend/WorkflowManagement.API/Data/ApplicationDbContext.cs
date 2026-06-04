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
    public DbSet<TaskAuditEntry> TaskAuditEntries { get; set; }
    public DbSet<Permission> Permissions { get; set; }
    public DbSet<Role> Roles { get; set; }
    public DbSet<RolePermission> RolePermissions { get; set; }
    public DbSet<AppUser> AppUsers { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Team>(entity =>
        {
            entity.HasKey(e => e.TeamId);
            entity.Property(e => e.TeamName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
        });

        modelBuilder.Entity<Member>(entity =>
        {
            entity.HasKey(e => e.MemberId);
            entity.Property(e => e.FirstName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.LastName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Email);
            entity.Property(e => e.Role).IsRequired().HasMaxLength(100);
            entity.Property(e => e.SkillLevel).IsRequired();
            entity.HasOne(m => m.Team)
                .WithMany(t => t.Members)
                .HasForeignKey(m => m.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        });

        modelBuilder.Entity<Workflow>(entity =>
        {
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.WorkflowJson).HasColumnType("jsonb");
            entity.HasOne(w => w.Team)
                .WithMany(t => t.Workflows)
                .HasForeignKey(w => w.TeamId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);
        });

        modelBuilder.Entity<Stage>(entity =>
        {
            entity.HasKey(e => e.StageId);
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.StageType).HasConversion<int>().HasDefaultValue(StageType.Process);
            entity.Property(e => e.TransitionPolicy).HasConversion<int>().HasDefaultValue(TransitionPolicy.OnComplete);
            entity.HasOne(s => s.Workflow).WithMany(w => w.Stages).HasForeignKey(s => s.WorkflowId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(s => s.Team).WithMany().HasForeignKey(s => s.TeamId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Models.Task>(entity =>
        {
            entity.HasKey(e => e.TaskId);
            entity.Property(e => e.TaskName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Status).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.HasOne(t => t.Workflow).WithMany(w => w.Tasks).HasForeignKey(t => t.WorkflowId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(t => t.Stage).WithMany(s => s.Tasks).HasForeignKey(t => t.StageId).OnDelete(DeleteBehavior.SetNull);
            entity.HasOne(t => t.AssignedToMember).WithMany(m => m.AssignedTasks).HasForeignKey(t => t.AssignedToMemberId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<TaskAuditEntry>(entity =>
        {
            entity.HasKey(e => e.AuditId);
            entity.HasIndex(e => e.EventId).IsUnique();
            entity.HasIndex(e => new { e.TaskId, e.OccurredAt });
            entity.Property(e => e.ActionType).IsRequired().HasMaxLength(50);
            entity.Property(e => e.StageName).HasMaxLength(200);
            entity.Property(e => e.NextStageName).HasMaxLength(200);
            entity.Property(e => e.Reason).HasMaxLength(500);
            entity.HasOne<Models.Task>()
                .WithMany()
                .HasForeignKey(e => e.TaskId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Permission>(entity =>
        {
            entity.HasKey(e => e.PermissionId);
            entity.Property(e => e.Code).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasKey(e => e.RoleId);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.HasMany(e => e.RolePermissions).WithOne(rp => rp.Role).HasForeignKey(rp => rp.RoleId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RolePermission>(entity =>
        {
            entity.HasKey(e => new { e.RoleId, e.PermissionId });
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.Email).IsRequired().HasMaxLength(200);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.FullName).IsRequired().HasMaxLength(200);
            entity.HasOne(u => u.Role).WithMany().HasForeignKey(u => u.RoleId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
