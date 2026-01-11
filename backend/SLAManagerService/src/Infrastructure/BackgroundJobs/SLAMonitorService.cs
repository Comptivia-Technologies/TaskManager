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
/// </summary>
public class SLAMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<SLAMonitorService> _logger;
    private readonly TimeSpan _pollingInterval = TimeSpan.FromMinutes(1); // Check every minute

    public SLAMonitorService(
        IServiceProvider serviceProvider,
        IRabbitMQPublisher publisher,
        ILogger<SLAMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _publisher = publisher;
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

        foreach (var assignment in activeAssignments)
        {
            if (assignment.SLADeadline < now && !assignment.IsOverdue)
            {
                // Mark as overdue
                assignment.IsOverdue = true;
                await repository.UpdateAsync(assignment);

                // Calculate minutes overdue
                var minutesOverdue = (int)(now - assignment.SLADeadline).TotalMinutes;

                // Publish TaskOverdueEvent
                var overdueEvent = new TaskOverdueEvent
                {
                    TaskId = assignment.TaskId,
                    MemberId = 0, // Will be set by Task Service if task is assigned
                    SLADeadline = assignment.SLADeadline,
                    BreachedAt = now,
                    MinutesOverdue = minutesOverdue,
                    CorrelationId = Guid.NewGuid()
                };

                await _publisher.PublishAsync(
                    overdueEvent,
                    RabbitMQConstants.SLAExchange,
                    RabbitMQConstants.TaskOverdue,
                    overdueEvent.CorrelationId);

                _logger.LogWarning(
                    "SLA breached for task. TaskId: {TaskId}, MinutesOverdue: {MinutesOverdue}, CorrelationId: {CorrelationId}",
                    assignment.TaskId, minutesOverdue, overdueEvent.CorrelationId);
            }
        }
    }
}

