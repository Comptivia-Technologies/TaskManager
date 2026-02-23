using Microsoft.EntityFrameworkCore;
using SLAConfiguration.API.Models;

namespace SLAConfiguration.API.Data;

public class SLAConfigurationDbContext : DbContext
{
    public SLAConfigurationDbContext(DbContextOptions<SLAConfigurationDbContext> options) : base(options)
    {
    }

    public DbSet<Models.SLAConfiguration> SLAConfigurations { get; set; }
    
    // Reference to Workflows table in the same database
    public DbSet<Models.Workflow> Workflows { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // SLA Configuration configuration
        modelBuilder.Entity<Models.SLAConfiguration>(entity =>
        {
            entity.ToTable("SLAConfigurations");
            entity.HasKey(e => e.SLAConfigurationId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.WorkflowId).IsRequired();
            
            // Configure DateTime properties to use timestamp with time zone (PostgreSQL recommended)
            entity.Property(e => e.CreatedAt)
                .IsRequired()
                .HasColumnType("timestamp with time zone");
            
            entity.Property(e => e.UpdatedAt)
                .IsRequired()
                .HasColumnType("timestamp with time zone");
            
            // JSONB column for storing priority levels
            entity.Property(e => e.PriorityLevelsJson)
                .HasColumnType("jsonb")
                .IsRequired()
                .HasDefaultValue("{}");

            // Foreign key relationship with Workflow (in same database)
            entity.HasIndex(s => s.WorkflowId)
                .IsUnique();
        });

        // Workflow reference configuration (read-only from existing table)
        modelBuilder.Entity<Models.Workflow>(entity =>
        {
            entity.ToTable("Workflows");
            entity.HasKey(e => e.WorkflowId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.WorkflowName).IsRequired().HasMaxLength(200);
            // This entity is read-only, used only for joining data
        });
    }
}

