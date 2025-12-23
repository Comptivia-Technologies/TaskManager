using Microsoft.EntityFrameworkCore;
using TaskManager.API.Models;

namespace TaskManager.API.Data;

public class TaskManagerDbContext : DbContext
{
    public TaskManagerDbContext(DbContextOptions<TaskManagerDbContext> options) : base(options)
    {
    }

    public DbSet<TaskManagerTask> Tasks { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TaskManagerTask>(entity =>
        {
            // Use a separate table to avoid conflicting with the existing "Tasks" table
            // in the WorkflowManagement database.
            entity.ToTable("TaskManagerTasks");

            entity.HasKey(e => e.TaskId);

            entity.Property(e => e.Title)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.Description)
                .HasMaxLength(2000);

            entity.Property(e => e.Status)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.Priority)
                .IsRequired()
                .HasMaxLength(50);

            entity.Property(e => e.WorkflowName)
                .IsRequired()
                .HasMaxLength(200);

            entity.Property(e => e.ExternalTaskId)
                .HasMaxLength(200);

            entity.Property(e => e.PayloadJson)
                .IsRequired();

            entity.Property(e => e.CreatedAt)
                .IsRequired();

            entity.Property(e => e.UpdatedAt)
                .IsRequired();

            // Indexes for query performance
            entity.HasIndex(e => e.TaskId);
            entity.HasIndex(e => e.WorkflowId);
            entity.HasIndex(e => e.Status);
        });
    }
}


