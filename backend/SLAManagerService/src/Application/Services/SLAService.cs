using System.Text.Json;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using SLAManagerService.Application.Interfaces;
using SLAManagerService.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace SLAManagerService.Application.Services;

/// <summary>
/// Service for configuring SLA for tasks
/// </summary>
public class SLAService : ISLAService
{
    private readonly ISLARepository _repository;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<SLAService> _logger;

    public SLAService(
        ISLARepository repository,
        IRabbitMQPublisher publisher,
        ILogger<SLAService> logger)
    {
        _repository = repository;
        _publisher = publisher;
        _logger = logger;
    }

    public async Task ConfigureSLAForTaskAsync(WorkflowSelectedEvent workflowSelectedEvent)
    {
        try
        {
            // Idempotency check
            var existingAssignment = await _repository.GetByTaskIdAsync(workflowSelectedEvent.TaskId);
            if (existingAssignment != null)
            {
                _logger.LogWarning(
                    "SLA already configured for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    workflowSelectedEvent.TaskId, workflowSelectedEvent.CorrelationId);
                return;
            }

            // Get SLA configuration for the workflow
            var slaConfig = await _repository.GetSLAConfigurationByWorkflowIdAsync(workflowSelectedEvent.WorkflowId);
            
            if (slaConfig == null)
            {
                _logger.LogWarning(
                    "No SLA configuration found for workflow. WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    workflowSelectedEvent.WorkflowId, workflowSelectedEvent.TaskId, workflowSelectedEvent.CorrelationId);
                return;
            }

            // Parse priority levels from JSONB
            var priorityLevels = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, int>>>(
                slaConfig.PriorityLevelsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (priorityLevels == null || !priorityLevels.Any())
            {
                _logger.LogWarning(
                    "Invalid SLA configuration JSON. WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    workflowSelectedEvent.WorkflowId, workflowSelectedEvent.TaskId, workflowSelectedEvent.CorrelationId);
                return;
            }

            // Get task priority from WorkflowSelectedEvent (passed from TaskCreatedEvent)
            var taskPriority = workflowSelectedEvent.TaskPriority;
            
            if (string.IsNullOrEmpty(taskPriority))
            {
                _logger.LogWarning(
                    "Task priority is empty, using default 'Medium'. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    workflowSelectedEvent.TaskId, workflowSelectedEvent.CorrelationId);
                taskPriority = "Medium";
            }

            // Find matching priority level (case-insensitive)
            var matchingPriority = priorityLevels.Keys.FirstOrDefault(
                p => p.Equals(taskPriority, StringComparison.OrdinalIgnoreCase));

            if (matchingPriority == null)
            {
                // Use first available priority as fallback
                matchingPriority = priorityLevels.Keys.First();
                _logger.LogWarning(
                    "Priority {Priority} not found in SLA config, using {FallbackPriority}. TaskId: {TaskId}",
                    taskPriority, matchingPriority, workflowSelectedEvent.TaskId);
            }

            var responseTimeMinutes = priorityLevels[matchingPriority]["responseTime"];
            var slaStartTime = DateTime.UtcNow;
            var slaDeadline = slaStartTime.AddMinutes(responseTimeMinutes);

            // Create SLA assignment
            var assignment = new SLAAssignment
            {
                TaskId = workflowSelectedEvent.TaskId,
                WorkflowId = workflowSelectedEvent.WorkflowId,
                Priority = matchingPriority,
                ResponseTimeMinutes = responseTimeMinutes,
                SLAStartTime = slaStartTime,
                SLADeadline = slaDeadline,
                IsOverdue = false,
                CreatedAt = DateTime.UtcNow,
                WorkflowSelectedEventId = workflowSelectedEvent.SelectionId // Use SelectionId for idempotency
            };

            await _repository.CreateAsync(assignment);

            // Publish SLAConfiguredEvent
            var slaConfiguredEvent = new SLAConfiguredEvent
            {
                SLAAssignmentId = assignment.SLAAssignmentId, // Include SLAAssignmentId for idempotency
                TaskId = workflowSelectedEvent.TaskId,
                WorkflowId = workflowSelectedEvent.WorkflowId,
                Priority = matchingPriority,
                ResponseTimeMinutes = responseTimeMinutes,
                SLAStartTime = slaStartTime,
                SLADeadline = slaDeadline,
                CorrelationId = workflowSelectedEvent.CorrelationId
            };

            await _publisher.PublishAsync(
                slaConfiguredEvent,
                RabbitMQConstants.SLAExchange,
                RabbitMQConstants.SLAConfigured,
                workflowSelectedEvent.CorrelationId);

            _logger.LogInformation(
                "SLA configured for task. TaskId: {TaskId}, Priority: {Priority}, ResponseTime: {ResponseTime}min, Deadline: {Deadline}, CorrelationId: {CorrelationId}",
                workflowSelectedEvent.TaskId, matchingPriority, responseTimeMinutes, slaDeadline, workflowSelectedEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error configuring SLA for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                workflowSelectedEvent.TaskId, workflowSelectedEvent.CorrelationId);
            throw;
        }
    }
}

