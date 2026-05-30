namespace Shared.Messaging;

public class AwsEventBusOptions : EventBusOptions
{
    public string Region { get; set; } = "us-east-1";
    public string EventBusName { get; set; } = "default";
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }
    public string? SessionToken { get; set; }
    public string? RoleArn { get; set; }
    
    // SNS/SQS configuration
    public string ServicePrefix { get; set; } = "task-manager";
    public bool AutoCreateQueues { get; set; } = true;
    public int VisibilityTimeoutSeconds { get; set; } = 300;
    public int MaxReceiveCount { get; set; } = 3;
    
    // EventBridge Scheduler
    public string SchedulerGroupName { get; set; } = "task-manager-schedules";
    public string? SchedulerRoleArn { get; set; }
    
    public AwsEventBusOptions()
    {
        Provider = EventBusProvider.AWS;
    }
}
