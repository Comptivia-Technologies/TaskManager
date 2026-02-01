using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using PriorityRuleEngine.API.Services;
using Microsoft.Extensions.Logging;

namespace PriorityRuleEngine.API.EventHandlers;

/// <summary>
/// Event handler for WorkflowSelectedEvent - Evaluates workflow-specific priority rules and publishes PriorityAssignedEvent
/// </summary>
public class WorkflowSelectedEventHandler
{
    private readonly IPriorityRuleService _priorityRuleService;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<WorkflowSelectedEventHandler> _logger;

    public WorkflowSelectedEventHandler(
        IPriorityRuleService priorityRuleService,
        IRabbitMQPublisher publisher,
        ILogger<WorkflowSelectedEventHandler> logger)
    {
        _priorityRuleService = priorityRuleService;
        _publisher = publisher;
        _logger = logger;
    }

    public async Task HandleAsync(WorkflowSelectedEvent workflowEvent, Guid correlationId)
    {
        try
        {
            _logger.LogInformation(
                "Received WorkflowSelectedEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                workflowEvent.TaskId, workflowEvent.WorkflowId, correlationId);

            // Evaluate priority using workflow-specific rules
            var priorityAssignedEvent = await _priorityRuleService.EvaluatePriorityAsync(workflowEvent);

            _logger.LogInformation(
                "Priority assigned. TaskId: {TaskId}, Priority: {Priority}, RuleId: {RuleId}, RuleName: {RuleName}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                priorityAssignedEvent.TaskId, priorityAssignedEvent.Priority, 
                priorityAssignedEvent.RuleId, priorityAssignedEvent.RuleName, 
                priorityAssignedEvent.WorkflowId, correlationId);

            // Publish PriorityAssignedEvent
            _logger.LogInformation(
                "Publishing PriorityAssignedEvent to exchange: {Exchange}, routing key: {RoutingKey}...",
                RabbitMQConstants.TaskExchange, RabbitMQConstants.PriorityAssigned);
            
            await _publisher.PublishAsync(
                priorityAssignedEvent,
                RabbitMQConstants.TaskExchange,
                RabbitMQConstants.PriorityAssigned,
                correlationId);

            _logger.LogInformation(
                "✓ PriorityAssignedEvent published successfully. TaskId: {TaskId}, WorkflowId: {WorkflowId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                priorityAssignedEvent.TaskId, priorityAssignedEvent.WorkflowId, priorityAssignedEvent.Priority, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error handling WorkflowSelectedEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}, CorrelationId: {CorrelationId}",
                workflowEvent.TaskId, workflowEvent.WorkflowId, correlationId);
            throw;
        }
    }
}

