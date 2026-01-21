using Shared.Contracts.EventContracts;
using PriorityRuleEngine.API.Models;
using PriorityRuleEngine.API.Repositories;
using Microsoft.Extensions.Logging;

namespace PriorityRuleEngine.API.Services;

public class PriorityRuleService : IPriorityRuleService
{
    private readonly IPriorityRuleRepository _repository;
    private readonly IRuleEvaluator _evaluator;
    private readonly ILogger<PriorityRuleService> _logger;

    public PriorityRuleService(
        IPriorityRuleRepository repository,
        IRuleEvaluator evaluator,
        ILogger<PriorityRuleService> logger)
    {
        _repository = repository;
        _evaluator = evaluator;
        _logger = logger;
    }

    public async Task<PriorityAssignedEvent> EvaluatePriorityAsync(WorkflowSelectedEvent workflowEvent)
    {
        try
        {
            // Get workflow-specific priority rules (ordered by salience - highest first)
            // This includes both workflow-specific rules AND global rules (where WorkflowId is null)
            var rules = await _repository.GetActiveRulesByWorkflowIdAsync(workflowEvent.WorkflowId);
            var rulesList = rules.ToList();

            if (!rulesList.Any())
            {
                _logger.LogWarning(
                    "No active priority rules found for workflow {WorkflowId}. Using default priority 'Medium'. TaskId: {TaskId}",
                    workflowEvent.WorkflowId, workflowEvent.TaskId);
                return CreateDefaultPriorityEvent(workflowEvent);
            }

            _logger.LogInformation(
                "Evaluating {RuleCount} rules for workflow {WorkflowId}, TaskId: {TaskId}",
                rulesList.Count, workflowEvent.WorkflowId, workflowEvent.TaskId);

            // Evaluate each rule against the task
            foreach (var rule in rulesList)
            {
                try
                {
                    _logger.LogInformation(
                        "Evaluating rule. RuleId: {RuleId}, RuleName: {RuleName}, Priority: {Priority}, WorkflowId: {WorkflowId}, IsActive: {IsActive}",
                        rule.RuleId, rule.RuleName, rule.Priority, rule.WorkflowId, rule.IsActive);
                    
                    if (_evaluator.EvaluateRule(rule, workflowEvent))
                    {
                        _logger.LogInformation(
                            "✓ Priority rule MATCHED. RuleId: {RuleId}, RuleName: {RuleName}, Priority: {Priority}, TaskId: {TaskId}, WorkflowId: {WorkflowId}",
                            rule.RuleId, rule.RuleName, rule.Priority, workflowEvent.TaskId, workflowEvent.WorkflowId);

                        return new PriorityAssignedEvent
                        {
                            TaskId = workflowEvent.TaskId,
                            WorkflowId = workflowEvent.WorkflowId,
                            Priority = rule.Priority,
                            AssignedBy = "RuleEngine",
                            RuleId = rule.RuleId,
                            RuleName = rule.RuleName,
                            OriginalTaskData = workflowEvent.TaskData,
                            CorrelationId = workflowEvent.CorrelationId,
                            AssignedAt = DateTime.UtcNow
                        };
                    }
                    else
                    {
                        _logger.LogInformation(
                            "Rule did not match. RuleId: {RuleId}, RuleName: {RuleName}, Priority: {Priority}",
                            rule.RuleId, rule.RuleName, rule.Priority);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "❌ Error evaluating rule. RuleId: {RuleId}, RuleName: {RuleName}, TaskId: {TaskId}",
                        rule.RuleId, rule.RuleName, workflowEvent.TaskId);
                    // Continue to next rule
                }
            }

            // No rule matched - use default
            _logger.LogWarning(
                "⚠ No priority rule matched for workflow {WorkflowId}. Using default priority 'Medium'. TaskId: {TaskId}",
                workflowEvent.WorkflowId, workflowEvent.TaskId);
            return CreateDefaultPriorityEvent(workflowEvent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error evaluating priority rules. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                workflowEvent.TaskId, workflowEvent.WorkflowId, workflowEvent.CorrelationId);
            // Return default on error
            return CreateDefaultPriorityEvent(workflowEvent);
        }
    }

    private PriorityAssignedEvent CreateDefaultPriorityEvent(WorkflowSelectedEvent workflowEvent)
    {
        return new PriorityAssignedEvent
        {
            TaskId = workflowEvent.TaskId,
            WorkflowId = workflowEvent.WorkflowId,
            Priority = "Medium",  // Default priority
            AssignedBy = "RuleEngine",
            RuleId = null,
            RuleName = "Default",
            OriginalTaskData = workflowEvent.TaskData,
            CorrelationId = workflowEvent.CorrelationId,
            AssignedAt = DateTime.UtcNow
        };
    }
}

