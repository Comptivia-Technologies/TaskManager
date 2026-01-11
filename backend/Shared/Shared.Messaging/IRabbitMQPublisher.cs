namespace Shared.Messaging;

/// <summary>
/// Interface for publishing events to RabbitMQ
/// </summary>
public interface IRabbitMQPublisher
{
    Task PublishAsync<T>(T eventData, string exchange, string routingKey, Guid correlationId) where T : class;
}

