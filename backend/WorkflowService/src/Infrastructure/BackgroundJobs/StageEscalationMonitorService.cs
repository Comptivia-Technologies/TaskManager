using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using WorkflowService.Application.Interfaces;

namespace WorkflowService.Infrastructure.BackgroundJobs;

/// <summary>
/// Background service that monitors stage timeouts and triggers escalations
/// Runs every minute to check for tasks that have exceeded their stage timeout
/// </summary>
public class StageEscalationMonitorService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<StageEscalationMonitorService> _logger;
    private readonly TimeSpan _pollingInterval = TimeSpan.FromMinutes(1); // Check every minute

    public StageEscalationMonitorService(
        IServiceProvider serviceProvider,
        ILogger<StageEscalationMonitorService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("StageEscalationMonitorService started. Polling interval: {Interval}", _pollingInterval);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckForEscalationsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in StageEscalationMonitorService");
            }

            await Task.Delay(_pollingInterval, stoppingToken);
        }

        _logger.LogInformation("StageEscalationMonitorService stopped");
    }

    private async Task CheckForEscalationsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IWorkflowRepository>();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        try
        {
            // Get all tasks that are in escalation stages and have exceeded timeout
            // Note: This would need to query TaskService database for tasks with StageTimeoutAt < Now
            // For now, we'll implement a placeholder that can be enhanced to query TaskService API
            
            _logger.LogDebug("Checking for stage escalations...");

            // TODO: Query TaskService API or database for tasks where:
            // - CurrentStageId is set
            // - StageTimeoutAt < DateTime.UtcNow
            // - Status is InStage
            // - TaskStageEscalationTriggeredEventId is null (not already escalated)
            
            // For now, this is a placeholder - you would need to:
            // 1. Add an API endpoint in TaskService to get tasks pending escalation
            // 2. Or add direct database access to TaskService database
            // 3. For each task found, get the current stage and next stage
            // 4. Publish TaskStageEscalationTriggeredEvent

            _logger.LogDebug("Stage escalation check completed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking for escalations");
        }
    }
}

