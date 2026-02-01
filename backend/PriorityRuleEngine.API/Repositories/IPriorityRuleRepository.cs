using PriorityRuleEngine.API.Models;

namespace PriorityRuleEngine.API.Repositories;

public interface IPriorityRuleRepository
{
    Task<IEnumerable<PriorityRule>> GetAllRulesAsync();
    Task<IEnumerable<PriorityRule>> GetActiveRulesAsync();
    Task<IEnumerable<PriorityRule>> GetActiveRulesByWorkflowIdAsync(int workflowId);
    Task<PriorityRule?> GetByIdAsync(int ruleId);
    Task<PriorityRule> CreateAsync(PriorityRule rule);
    Task<PriorityRule?> UpdateAsync(int ruleId, PriorityRule rule);
    Task<bool> DeleteAsync(int ruleId);
}

