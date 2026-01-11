namespace Shared.Messaging;

/// <summary>
/// Interface for consuming events from RabbitMQ
/// </summary>
public interface IRabbitMQConsumer
{
    void StartConsuming<T>(string exchange, string queue, string routingKey, Func<T, Guid, Task> handler) where T : class;
    void StopConsuming();
}

