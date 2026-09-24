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
    private readonly IEventBus _eventBus;
    private readonly ILogger<SLAService> _logger;

    public SLAService(
        ISLARepository repository,
        IEventBus eventBus,
        ILogger<SLAService> logger)
    {
        _repository = repository;
        _eventBus = eventBus;
        _logger = logger;
    }

    public async Task ConfigureSLAForTaskAsync(PriorityAssignedEvent priorityAssignedEvent)
    {
        try
        {
            _logger.LogInformation(
                "=== SLA Configuration Started === TaskId: {TaskId}, WorkflowId: {WorkflowId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                priorityAssignedEvent.TaskId, priorityAssignedEvent.WorkflowId, priorityAssignedEvent.Priority, priorityAssignedEvent.CorrelationId);

            // Validate WorkflowId
            if (priorityAssignedEvent.WorkflowId == Guid.Empty)
            {
                _logger.LogError(
                    "❌ INVALID WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    priorityAssignedEvent.WorkflowId, priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
                throw new ArgumentException($"Invalid WorkflowId: {priorityAssignedEvent.WorkflowId}");
            }

            // Idempotency check
            _logger.LogInformation("Checking for existing SLA assignment...");
            var existingAssignment = await _repository.GetByTaskIdAsync(priorityAssignedEvent.TaskId);
            if (existingAssignment != null)
            {
                _logger.LogWarning(
                    "SLA already configured for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
                return;
            }

            // Get SLA configuration for the workflow
            _logger.LogInformation(
                "Looking up SLA configuration for WorkflowId: {WorkflowId}...",
                priorityAssignedEvent.WorkflowId);
            var slaConfig = await _repository.GetSLAConfigurationByWorkflowIdAsync(priorityAssignedEvent.WorkflowId);
            
            if (slaConfig == null)
            {
                _logger.LogError(
                    "❌ NO SLA CONFIGURATION FOUND for WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}. SLA assignment will NOT be created, member assignment will NOT occur.",
                    priorityAssignedEvent.WorkflowId, priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
                return;
            }

            _logger.LogInformation(
                "✓ Found SLA configuration. WorkflowId: {WorkflowId}, SLAConfigurationId: {SLAConfigurationId}",
                priorityAssignedEvent.WorkflowId, slaConfig.SLAConfigurationId);

            // Parse priority levels from JSONB
            _logger.LogInformation("Parsing PriorityLevelsJson...");
            var priorityLevels = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, int>>>(
                slaConfig.PriorityLevelsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (priorityLevels == null || !priorityLevels.Any())
            {
                _logger.LogError(
                    "❌ Invalid SLA configuration JSON. WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}, JSON: {Json}",
                    priorityAssignedEvent.WorkflowId, priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId, slaConfig.PriorityLevelsJson);
                return;
            }

            _logger.LogInformation(
                "✓ Parsed priority levels. Available priorities: {Priorities}",
                string.Join(", ", priorityLevels.Keys));

            // Get task priority from PriorityAssignedEvent (assigned by rule engine)
            var taskPriority = priorityAssignedEvent.Priority;
            
            if (string.IsNullOrEmpty(taskPriority))
            {
                _logger.LogWarning(
                    "Task priority is empty, using default 'Medium'. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
                taskPriority = "Medium";
            }

            _logger.LogInformation("Task priority: {TaskPriority}", taskPriority);

            // Find matching priority level (case-insensitive)
            var matchingPriority = priorityLevels.Keys.FirstOrDefault(
                p => p.Equals(taskPriority, StringComparison.OrdinalIgnoreCase));

            if (matchingPriority == null)
            {
                // Use first available priority as fallback
                matchingPriority = priorityLevels.Keys.First();
                _logger.LogWarning(
                    "Priority {Priority} not found in SLA config, using {FallbackPriority}. TaskId: {TaskId}",
                    taskPriority, matchingPriority, priorityAssignedEvent.TaskId);
            }

            var responseTimeMinutes = priorityLevels[matchingPriority]["responseTime"];
            var slaStartTime = DateTime.UtcNow;
            var slaDeadline = slaStartTime.AddMinutes(responseTimeMinutes);

            _logger.LogInformation(
                "Creating SLA assignment. Priority: {Priority}, ResponseTime: {ResponseTime}min, Deadline: {Deadline}",
                matchingPriority, responseTimeMinutes, slaDeadline);

            // Create SLA assignment
            var assignment = new SLAAssignment
            {
                TaskId = priorityAssignedEvent.TaskId,
                WorkflowId = priorityAssignedEvent.WorkflowId,
                Priority = matchingPriority,
                ResponseTimeMinutes = responseTimeMinutes,
                SLAStartTime = slaStartTime,
                SLADeadline = slaDeadline,
                IsOverdue = false,
                CreatedAt = DateTime.UtcNow,
                WorkflowSelectedEventId = null // Not using WorkflowSelectedEventId anymore
            };

            _logger.LogInformation("Saving SLA assignment to database...");
            await _repository.CreateAsync(assignment);
            _logger.LogInformation(
                "✓ SLA assignment created. SLAAssignmentId: {SLAAssignmentId}, TaskId: {TaskId}",
                assignment.SLAAssignmentId, assignment.TaskId);

            // Publish SLAConfiguredEvent
            var slaConfiguredEvent = new SLAConfiguredEvent
            {
                SLAAssignmentId = assignment.SLAAssignmentId, // Include SLAAssignmentId for idempotency
                TaskId = priorityAssignedEvent.TaskId,
                WorkflowId = priorityAssignedEvent.WorkflowId,
                Priority = matchingPriority,
                ResponseTimeMinutes = responseTimeMinutes,
                SLAStartTime = slaStartTime,
                SLADeadline = slaDeadline,
                // Final relay of the creator before WorkloadService assigns the first stage.
                PreferredMemberId = priorityAssignedEvent.PreferredMemberId,
                CorrelationId = priorityAssignedEvent.CorrelationId
            };

            _logger.LogInformation("Publishing SLAConfiguredEvent...");
            await _eventBus.PublishAsync(
                slaConfiguredEvent,
                EventBusConstants.SLASource,
                EventBusConstants.SLAConfigured,
                priorityAssignedEvent.CorrelationId);

            _logger.LogInformation(
                "✓ SLAConfiguredEvent published. TaskId: {TaskId}, WorkflowId: {WorkflowId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                priorityAssignedEvent.TaskId, priorityAssignedEvent.WorkflowId, matchingPriority, priorityAssignedEvent.CorrelationId);

            // Publish delayed TaskOverdueEvent that will be delivered at the SLA deadline
            var delay = slaDeadline - DateTime.UtcNow;
            if (delay > TimeSpan.Zero)
            {
                try
                {
                    var overdueEvent = new TaskOverdueEvent
                    {
                        TaskId = priorityAssignedEvent.TaskId,
                        MemberId = Guid.Empty, // Will be set by TaskService if task is assigned
                        SLADeadline = slaDeadline,
                        BreachedAt = slaDeadline, // Will be set to actual breach time when delivered
                        MinutesOverdue = 0, // Will be calculated when delivered
                        CorrelationId = Guid.NewGuid()
                    };

                    await _eventBus.ScheduleAsync(
                        overdueEvent,
                        EventBusConstants.SLASource,
                        EventBusConstants.TaskOverdue,
                        overdueEvent.CorrelationId,
                        delay);

                    _logger.LogInformation(
                        "Scheduled delayed TaskOverdueEvent for TaskId: {TaskId}, Deadline: {Deadline}, Delay: {Delay}ms, CorrelationId: {CorrelationId}",
                        priorityAssignedEvent.TaskId, slaDeadline, (int)delay.TotalMilliseconds, overdueEvent.CorrelationId);
                }
                catch (Exception ex)
                {
                    // Don't fail SLA configuration if delayed message fails
                    // Fallback worker will catch overdue tasks
                    _logger.LogWarning(ex,
                        "Failed to publish delayed TaskOverdueEvent for TaskId: {TaskId}. Fallback worker will handle overdue detection. CorrelationId: {CorrelationId}",
                        priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
                }
            }
            else
            {
                // Deadline already passed (shouldn't happen, but handle it)
                _logger.LogWarning(
                    "Task {TaskId} SLA deadline has already passed. Marking as overdue immediately.",
                    priorityAssignedEvent.TaskId);
                
                // Publish overdue event immediately
                var overdueEvent = new TaskOverdueEvent
                {
                        TaskId = priorityAssignedEvent.TaskId,
                    MemberId = Guid.Empty,
                    SLADeadline = slaDeadline,
                    BreachedAt = DateTime.UtcNow,
                    MinutesOverdue = (int)(DateTime.UtcNow - slaDeadline).TotalMinutes,
                    CorrelationId = Guid.NewGuid()
                };

                await _eventBus.PublishAsync(
                    overdueEvent,
                    EventBusConstants.SLASource,
                    EventBusConstants.TaskOverdue,
                    overdueEvent.CorrelationId);
            }

            _logger.LogInformation(
                "SLA configured for task. TaskId: {TaskId}, Priority: {Priority}, ResponseTime: {ResponseTime}min, Deadline: {Deadline}, CorrelationId: {CorrelationId}",
                priorityAssignedEvent.TaskId, matchingPriority, responseTimeMinutes, slaDeadline, priorityAssignedEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error configuring SLA for task. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    priorityAssignedEvent.TaskId, priorityAssignedEvent.CorrelationId);
            throw;
        }
    }
}

