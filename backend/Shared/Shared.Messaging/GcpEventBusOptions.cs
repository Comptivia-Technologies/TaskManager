namespace Shared.Messaging;

public class GcpEventBusOptions : EventBusOptions
{
    public string ProjectId { get; set; } = string.Empty;
    public string? CredentialsPath { get; set; }
    public string? CredentialsJson { get; set; }
    
    // Pub/Sub configuration
    public string ServicePrefix { get; set; } = "task-manager";
    public int AckDeadlineSeconds { get; set; } = 300;
    public int MaxDeliveryAttempts { get; set; } = 3;
    
    // Cloud Scheduler
    public string SchedulerLocation { get; set; } = "us-central1";
    public string? ServiceAccountEmail { get; set; }
    
    public GcpEventBusOptions()
    {
        Provider = EventBusProvider.AWS; // Note: Add GCP to enum if needed
    }
}
