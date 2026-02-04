namespace Shared.Messaging;

/// <summary>
/// Abstraction for event bus operations
/// </summary>
public interface IEventBus
{
    /// <summary>
    /// Publishes an event immediately
    /// </summary>
    Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId) where T : class;
    
    /// <summary>
    /// Schedules an event to be published at a specific time
    /// </summary>
    Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTime) where T : class;
    
    /// <summary>
    /// Schedules an event to be published after a delay
    /// </summary>
    Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class;
    
    /// <summary>
    /// Starts consuming events from a queue
    /// </summary>
    void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class;
    
    /// <summary>
    /// Stops all consumers
    /// </summary>
    void StopConsuming();
}
