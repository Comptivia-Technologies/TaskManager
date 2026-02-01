using Shared.Contracts.EventContracts;

namespace PriorityRuleEngine.API.Services;

public interface IPriorityRuleService
{
    Task<PriorityAssignedEvent> EvaluatePriorityAsync(WorkflowSelectedEvent workflowEvent);
}

