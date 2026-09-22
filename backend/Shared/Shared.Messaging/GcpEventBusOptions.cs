namespace Shared.Messaging;

public class GcpEventBusOptions : EventBusOptions
{
    public string ProjectId { get; set; } = string.Empty;
    public string? CredentialsPath { get; set; }
    public string? CredentialsJson { get; set; }

    public string ServicePrefix { get; set; } = "task-manager";
    public int AckDeadlineSeconds { get; set; } = 300;
    public int MaxDeliveryAttempts { get; set; } = 5;

    /// <summary>Cloud Tasks queue location. Same key as the previous scheduler location.</summary>
    public string SchedulerLocation { get; set; } = "asia-south1";

    /// <summary>Cloud Tasks queue id for one-shot delayed events. Defaults to {ServicePrefix}-schedules.</summary>
    public string? TasksQueueId { get; set; }

    public string? ServiceAccountEmail { get; set; }

    public GcpEventBusOptions()
    {
        Provider = EventBusProvider.GCP;
    }
}
