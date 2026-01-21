using PriorityRuleEngine.API.Models;
using Shared.Contracts.EventContracts;

namespace PriorityRuleEngine.API.Services;

public interface IRuleEvaluator
{
    bool EvaluateRule(PriorityRule rule, WorkflowSelectedEvent workflowEvent);
}

