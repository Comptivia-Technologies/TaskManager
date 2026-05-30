using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using Shared.Contracts.Constants;
using Shared.Contracts.EventContracts;

namespace Shared.Messaging;

public sealed class RabbitMQEventBus : IEventBus, IDisposable
{
    private readonly RabbitMQEventBusOptions _options;
    private readonly ILogger<RabbitMQEventBus> _logger;
    private readonly IConnection _connection;
    private readonly IModel _publishChannel;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly object _lock = new();
    private readonly Dictionary<string, Dictionary<string, (Type EventType, Func<object, Guid, Task> Handler)>> _consumers = new();
    private readonly Dictionary<string, (IModel Channel, string ConsumerTag)> _consumerChannels = new();

    public RabbitMQEventBus(IOptions<RabbitMQEventBusOptions> options, ILogger<RabbitMQEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        var factory = new ConnectionFactory
        {
            HostName = _options.HostName,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true,
            TopologyRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
        };

        _connection = factory.CreateConnection();
        _publishChannel = _connection.CreateModel();

        EnsureExchangeDeclared(_publishChannel);

        _logger.LogInformation(
            "RabbitMQEventBus initialized. Host={Host}:{Port}, VHost={VHost}, ServicePrefix={ServicePrefix}, Exchange={Exchange}",
            _options.HostName, _options.Port, _options.VirtualHost, _options.ServicePrefix, _options.ExchangeName);
    }

    public Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId) where T : class
    {
        var json = JsonSerializer.Serialize(eventData, _jsonOptions);
        var body = Encoding.UTF8.GetBytes(json);

        var props = _publishChannel.CreateBasicProperties();
        props.Persistent = true;
        props.ContentType = "application/json";
        props.Type = detailType;
        props.AppId = source;
        props.MessageId = Guid.NewGuid().ToString("N");
        props.CorrelationId = correlationId.ToString();
        props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        _publishChannel.BasicPublish(
            exchange: GetNamespacedExchange(),
            routingKey: detailType,
            mandatory: false,
            basicProperties: props,
            body: body);

        return Task.CompletedTask;
    }

    public async Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTime) where T : class
    {
        var delay = scheduledTime - DateTime.UtcNow;
        if (delay <= TimeSpan.Zero)
        {
            await PublishAsync(eventData, source, detailType, correlationId);
            return;
        }

        await ScheduleAsync(eventData, source, detailType, correlationId, delay);
    }

    public Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        if (delay <= TimeSpan.Zero)
            return PublishAsync(eventData, source, detailType, correlationId);

        var json = JsonSerializer.Serialize(eventData, _jsonOptions);
        var body = Encoding.UTF8.GetBytes(json);

        var props = _publishChannel.CreateBasicProperties();
        props.Persistent = true;
        props.ContentType = "application/json";
        props.Type = detailType;
        props.AppId = source;
        props.MessageId = Guid.NewGuid().ToString("N");
        props.CorrelationId = correlationId.ToString();
        props.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        props.Headers = new Dictionary<string, object>
        {
            ["x-delay"] = (int)Math.Clamp(delay.TotalMilliseconds, 1, int.MaxValue)
        };

        _publishChannel.BasicPublish(
            exchange: GetNamespacedExchange(),
            routingKey: detailType,
            mandatory: false,
            basicProperties: props,
            body: body);

        return Task.CompletedTask;
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        var detailType = GetDetailTypeFromEventType<T>();
        var fullQueueName = $"{_options.ServicePrefix}-{queueName}";

        lock (_lock)
        {
            if (!_consumers.TryGetValue(queueName, out var map))
            {
                map = new Dictionary<string, (Type, Func<object, Guid, Task>)>(StringComparer.OrdinalIgnoreCase);
                _consumers[queueName] = map;
            }

            map[detailType] = (typeof(T), async (obj, correlationId) => await handler((T)obj, correlationId));

            if (_consumerChannels.ContainsKey(queueName))
            {
                // Channel already started; just ensure the queue is bound for this detailType.
                var chExisting = _consumerChannels[queueName].Channel;
                EnsureQueueDeclaredAndBound(chExisting, fullQueueName, detailType);
                _logger.LogInformation("Registered handler for {DetailType} on queue {Queue}", detailType, fullQueueName);
                return;
            }

            var channel = _connection.CreateModel();
            channel.BasicQos(0, _options.PrefetchCount, false);
            EnsureExchangeDeclared(channel);
            EnsureQueueDeclaredAndBound(channel, fullQueueName, detailType);

            var consumer = new AsyncEventingBasicConsumer(channel);
            consumer.Received += async (_, ea) =>
            {
                var rk = ea.RoutingKey;
                try
                {
                    if (!_consumers.TryGetValue(queueName, out var handlers) || !handlers.TryGetValue(rk, out var handlerInfo))
                    {
                        _logger.LogWarning("No handler registered for detail-type {DetailType} on queue {Queue}. DeliveryTag={DeliveryTag}", rk, fullQueueName, ea.DeliveryTag);
                        channel.BasicAck(ea.DeliveryTag, false);
                        return;
                    }

                    var payload = Encoding.UTF8.GetString(ea.Body.ToArray());
                    object? eventData;
                    try
                    {
                        eventData = JsonSerializer.Deserialize(payload, handlerInfo.EventType, _jsonOptions);
                    }
                    catch (JsonException ex) when (ex.Message.Contains("Guid") || ex.Message.Contains("could not be converted"))
                    {
                        _logger.LogWarning(ex, "Received legacy message with integer ID format (pre-Guid migration). Skipping. DetailType={DetailType}", rk);
                        channel.BasicAck(ea.DeliveryTag, false);
                        return;
                    }

                    if (eventData == null)
                    {
                        _logger.LogWarning("Failed to deserialize event payload for detail-type {DetailType}. DeliveryTag={DeliveryTag}", rk, ea.DeliveryTag);
                        channel.BasicAck(ea.DeliveryTag, false);
                        return;
                    }

                    Guid correlationId = Guid.NewGuid();
                    if (Guid.TryParse(ea.BasicProperties?.CorrelationId, out var cid) && cid != Guid.Empty)
                    {
                        correlationId = cid;
                    }
                    else
                    {
                        var correlationIdProperty = handlerInfo.EventType.GetProperty("CorrelationId");
                        if (correlationIdProperty != null && correlationIdProperty.PropertyType == typeof(Guid))
                        {
                            var eventCorrelationId = correlationIdProperty.GetValue(eventData);
                            if (eventCorrelationId is Guid g && g != Guid.Empty)
                                correlationId = g;
                        }
                    }

                    await handlerInfo.Handler(eventData, correlationId);
                    channel.BasicAck(ea.DeliveryTag, false);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message on queue {Queue}. DetailType={DetailType}, DeliveryTag={DeliveryTag}", fullQueueName, rk, ea.DeliveryTag);
                    // Requeue so it can be retried; handlers are expected to be idempotent.
                    channel.BasicNack(ea.DeliveryTag, false, requeue: true);
                }
            };

            var consumerTag = channel.BasicConsume(queue: fullQueueName, autoAck: false, consumer: consumer);
            _consumerChannels[queueName] = (channel, consumerTag);
            _logger.LogInformation("Started consumer for queue {Queue} (detail-type {DetailType})", fullQueueName, detailType);
        }
    }

    public void StopConsuming()
    {
        lock (_lock)
        {
            foreach (var kvp in _consumerChannels)
            {
                try
                {
                    kvp.Value.Channel.BasicCancel(kvp.Value.ConsumerTag);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to cancel consumer for queue {QueueName}", kvp.Key);
                }
                finally
                {
                    try { kvp.Value.Channel.Close(); } catch { }
                    kvp.Value.Channel.Dispose();
                }
            }

            _consumerChannels.Clear();
            _consumers.Clear();
            _logger.LogInformation("Stopped all consumers");
        }
    }

    public void Dispose()
    {
        StopConsuming();
        try { _publishChannel.Close(); } catch { }
        _publishChannel.Dispose();
        try { _connection.Close(); } catch { }
        _connection.Dispose();
    }

    private void EnsureExchangeDeclared(IModel channel)
    {
        var args = new Dictionary<string, object>
        {
            ["x-delayed-type"] = "topic"
        };

        channel.ExchangeDeclare(
            exchange: GetNamespacedExchange(),
            type: "x-delayed-message",
            durable: true,
            autoDelete: false,
            arguments: args);
    }

    private void EnsureQueueDeclaredAndBound(IModel channel, string fullQueueName, string detailType)
    {
        channel.QueueDeclare(queue: fullQueueName, durable: true, exclusive: false, autoDelete: false);
        channel.QueueBind(queue: fullQueueName, exchange: GetNamespacedExchange(), routingKey: detailType);
    }

    private string GetNamespacedExchange() => $"{_options.ServicePrefix}-{_options.ExchangeName}";

    private string GetDetailTypeFromEventType<T>() where T : class
    {
        var typeName = typeof(T).Name;
        return typeName switch
        {
            nameof(TaskCreatedEvent) => EventBusConstants.TaskCreated,
            nameof(WorkflowSelectedEvent) => EventBusConstants.WorkflowSelected,
            nameof(PriorityAssignedEvent) => EventBusConstants.PriorityAssigned,
            nameof(SLAConfiguredEvent) => EventBusConstants.SLAConfigured,
            nameof(TaskAssignedEvent) => EventBusConstants.TaskAssigned,
            nameof(TaskOverdueEvent) => EventBusConstants.TaskOverdue,
            nameof(TaskStageStartedEvent) => EventBusConstants.TaskStageStarted,
            nameof(TaskStageCompletedEvent) => EventBusConstants.TaskStageCompleted,
            nameof(TaskStageEscalatedEvent) => EventBusConstants.TaskStageEscalated,
            nameof(TaskStageEscalationTriggeredEvent) => EventBusConstants.TaskStageEscalationTriggered,
            nameof(TaskCompletedEvent) => EventBusConstants.TaskCompleted,
            nameof(TaskStatusUpdatedEvent) => EventBusConstants.TaskStatusUpdated,
            nameof(TaskStageReassignmentNeededEvent) => EventBusConstants.TaskStageReassignmentNeeded,
            _ => typeName.Replace("Event", "")
        };
    }
}

