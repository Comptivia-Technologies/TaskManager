using PriorityRuleEngine.API.Models;

namespace PriorityRuleEngine.API.Repositories;

public interface IPriorityRuleRepository
{
    Task<IEnumerable<PriorityRule>> GetAllRulesAsync();
    Task<IEnumerable<PriorityRule>> GetActiveRulesAsync();
    Task<IEnumerable<PriorityRule>> GetActiveRulesByWorkflowIdAsync(Guid? workflowId);
    Task<PriorityRule?> GetByIdAsync(Guid ruleId);
    Task<PriorityRule> CreateAsync(PriorityRule rule);
    Task<PriorityRule?> UpdateAsync(Guid ruleId, PriorityRule rule);
    Task<bool> DeleteAsync(Guid ruleId);
}

