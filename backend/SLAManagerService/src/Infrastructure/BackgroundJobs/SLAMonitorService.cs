using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SLAManagerService.Application.Interfaces;
using SLAManagerService.Domain.Entities;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;

namespace SLAManagerService.Infrastructure.BackgroundJobs;

/// <summary>
/// Background service that monitors SLA deadlines and publishes overdue events
/// This is a fallback mechanism - delayed messages handle most overdue detection
/// </summary>
public class SLAMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IEventBus _eventBus;
    private readonly ILogger<SLAMonitorService> _logger;
    private readonly TimeSpan _pollingInterval = TimeSpan.FromMinutes(1); // Check every 1 minute (fallback only - delayed messages handle most cases)

    public SLAMonitorService(
        IServiceProvider serviceProvider,
        IEventBus eventBus,
        ILogger<SLAMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _eventBus = eventBus;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SLA Monitor Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckOverdueSLAsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in SLA Monitor Service");
            }

            await Task.Delay(_pollingInterval, stoppingToken);
        }

        _logger.LogInformation("SLA Monitor Service stopped");
    }

    private async Task CheckOverdueSLAsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ISLARepository>();

        IEnumerable<Domain.Entities.SLAAssignment> activeAssignments;
        try
        {
            activeAssignments = await repository.GetActiveSLAAssignmentsAsync();
        }
        catch (Npgsql.PostgresException ex) when (ex.SqlState == "42P01") // Table doesn't exist
        {
            _logger.LogWarning("SLAAssignments table does not exist yet. Waiting for database initialization...");
            return; // Skip this iteration, will retry on next polling cycle
        }

        var now = DateTime.UtcNow;
        var activeAssignmentsList = activeAssignments.ToList();
        
        _logger.LogInformation(
            "Checking overdue SLAs. Found {Count} active assignments. Current time: {Now} (UTC)",
            activeAssignmentsList.Count, now);

        foreach (var assignment in activeAssignmentsList)
        {
            // Ensure deadline is in UTC for comparison
            // If loaded from database as Unspecified, assume it's UTC (since we store UTC)
            var deadlineUtc = assignment.SLADeadline.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(assignment.SLADeadline, DateTimeKind.Utc)
                : assignment.SLADeadline.ToUniversalTime();
            
            var isOverdue = deadlineUtc < now;
            var timeUntilDeadline = deadlineUtc - now;
            
            _logger.LogInformation(
                "Checking assignment. TaskId: {TaskId}, Deadline: {Deadline} (Kind: {Kind}), DeadlineUTC: {DeadlineUTC}, CurrentTime: {Now} (UTC), IsOverdue: {IsOverdue}, DeadlinePassed: {DeadlinePassed}, TimeUntilDeadline: {TimeUntilDeadline}",
                assignment.TaskId, assignment.SLADeadline, assignment.SLADeadline.Kind, deadlineUtc, now, assignment.IsOverdue, isOverdue, timeUntilDeadline);
            
            if (isOverdue && !assignment.IsOverdue)
            {
                // Mark as overdue
                assignment.IsOverdue = true;
                await repository.UpdateAsync(assignment);

                // Calculate minutes overdue (use UTC deadline)
                var minutesOverdue = (int)(now - deadlineUtc).TotalMinutes;

                // Publish TaskOverdueEvent
                var overdueEvent = new TaskOverdueEvent
                {
                    TaskId = assignment.TaskId,
                    MemberId = 0, // Will be set by Task Service if task is assigned
                    SLADeadline = deadlineUtc, // Use UTC deadline
                    BreachedAt = now,
                    MinutesOverdue = minutesOverdue,
                    CorrelationId = Guid.NewGuid()
                };

                await _eventBus.PublishAsync(
                    overdueEvent,
                    EventBusConstants.SLASource,
                    EventBusConstants.TaskOverdue,
                    overdueEvent.CorrelationId);

                _logger.LogWarning(
                    "SLA breached for task. TaskId: {TaskId}, MinutesOverdue: {MinutesOverdue}, CorrelationId: {CorrelationId}",
                    assignment.TaskId, minutesOverdue, overdueEvent.CorrelationId);
            }
        }
    }
}

