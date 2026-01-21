using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PriorityRuleEngine.API.Data;
using PriorityRuleEngine.API.Models;

namespace PriorityRuleEngine.API.Repositories;

public class PriorityRuleRepository : IPriorityRuleRepository
{
    private readonly PriorityRuleDbContext _db;
    private readonly ILogger<PriorityRuleRepository> _logger;

    public PriorityRuleRepository(PriorityRuleDbContext db, ILogger<PriorityRuleRepository> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IEnumerable<PriorityRule>> GetAllRulesAsync()
    {
        return await _db.PriorityRules
            .OrderByDescending(r => r.Salience)
            .ToListAsync();
    }

    public async Task<IEnumerable<PriorityRule>> GetActiveRulesAsync()
    {
        return await _db.PriorityRules
            .Where(r => r.IsActive)
            .OrderByDescending(r => r.Salience)
            .ToListAsync();
    }

    public async Task<IEnumerable<PriorityRule>> GetActiveRulesByWorkflowIdAsync(int workflowId)
    {
        // Get workflow-specific rules AND global rules (where WorkflowId is null)
        return await _db.PriorityRules
            .Where(r => r.IsActive && (r.WorkflowId == workflowId || r.WorkflowId == null))
            .OrderByDescending(r => r.Salience)
            .ToListAsync();
    }

    public async Task<PriorityRule?> GetByIdAsync(int ruleId)
    {
        return await _db.PriorityRules.FindAsync(ruleId);
    }

    public async Task<PriorityRule> CreateAsync(PriorityRule rule)
    {
        _logger.LogInformation(
            "Repository: Creating rule. WorkflowId before Add: {WorkflowId}",
            rule.WorkflowId);
        
        rule.CreatedAt = DateTime.UtcNow;
        rule.UpdatedAt = DateTime.UtcNow;
        
        _db.PriorityRules.Add(rule);
        
        // Log entity state
        var entry = _db.Entry(rule);
        _logger.LogInformation(
            "Repository: Entity state: {State}, WorkflowId property state: {PropertyState}",
            entry.State, entry.Property(r => r.WorkflowId).IsModified);
        
        await _db.SaveChangesAsync();
        
        _logger.LogInformation(
            "Repository: Rule saved. RuleId: {RuleId}, WorkflowId after SaveChanges: {WorkflowId}",
            rule.RuleId, rule.WorkflowId);
        
        return rule;
    }

    public async Task<PriorityRule?> UpdateAsync(int ruleId, PriorityRule rule)
    {
        var existing = await _db.PriorityRules.FindAsync(ruleId);
        if (existing == null) return null;

        existing.RuleName = rule.RuleName;
        existing.Priority = rule.Priority;
        existing.Salience = rule.Salience;
        existing.IsActive = rule.IsActive;
        existing.ConditionsJson = rule.ConditionsJson;
        existing.MaxWorkloadScore = rule.MaxWorkloadScore;
        existing.TeamName = rule.TeamName;
        existing.WorkflowId = rule.WorkflowId;
        existing.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(int ruleId)
    {
        var rule = await _db.PriorityRules.FindAsync(ruleId);
        if (rule == null) return false;

        _db.PriorityRules.Remove(rule);
        await _db.SaveChangesAsync();
        return true;
    }
}

