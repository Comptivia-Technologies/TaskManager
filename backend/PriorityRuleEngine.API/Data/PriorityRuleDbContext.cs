using Microsoft.EntityFrameworkCore;
using PriorityRuleEngine.API.Models;

namespace PriorityRuleEngine.API.Data;

public class PriorityRuleDbContext : DbContext
{
    public PriorityRuleDbContext(DbContextOptions<PriorityRuleDbContext> options) : base(options) { }

    public DbSet<PriorityRule> PriorityRules { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PriorityRule>(entity =>
        {
            entity.ToTable("PriorityRules");
            entity.HasKey(e => e.RuleId);
            entity.Property(e => e.OrganizationId).IsRequired();
            entity.HasIndex(e => e.OrganizationId);
            entity.Property(e => e.RuleName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Priority).IsRequired().HasMaxLength(50);
            entity.Property(e => e.ConditionsJson).IsRequired();
            entity.Property(e => e.TeamName).HasMaxLength(200);
            entity.Property(e => e.WorkflowId).IsRequired(false); // Explicitly set as nullable
            entity.Property(e => e.CreatedAt).IsRequired();
            entity.Property(e => e.UpdatedAt).IsRequired();
        });
    }
}

