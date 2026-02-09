namespace Shared.Messaging;

public class AzureEventBusOptions : EventBusOptions
{
    public string ServiceBusConnectionString { get; set; } = string.Empty;
    public string EventGridTopicEndpoint { get; set; } = string.Empty;
    public string EventGridAccessKey { get; set; } = string.Empty;
    
    // Service Bus configuration
    public string ServicePrefix { get; set; } = "task-manager";
    public int MaxDeliveryCount { get; set; } = 3;
    public int LockDurationSeconds { get; set; } = 300;
    
    // Event Grid configuration
    public string EventGridTopicName { get; set; } = "task-manager-events";
    
    public AzureEventBusOptions()
    {
        Provider = EventBusProvider.AWS; // Note: Add Azure to enum if needed
    }
}
