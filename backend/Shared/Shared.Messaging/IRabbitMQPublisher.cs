namespace Shared.Messaging;

/// <summary>
/// Interface for publishing events to RabbitMQ
/// </summary>
public interface IRabbitMQPublisher
{
    Task PublishAsync<T>(T eventData, string exchange, string routingKey, Guid correlationId) where T : class;
    
    /// <summary>
    /// Publishes a delayed message that will be delivered after the specified delay
    /// Requires rabbitmq_delayed_message_exchange plugin to be enabled
    /// </summary>
    Task PublishDelayedAsync<T>(T eventData, string exchange, string routingKey, Guid correlationId, TimeSpan delay) where T : class;
}

