using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Shared.Messaging;

public class RabbitMQEventBus : IEventBus, IDisposable
{
    private readonly RabbitMQEventBusOptions _options;
    private readonly ILogger<RabbitMQEventBus> _logger;
    private readonly ConnectionFactory _factory;
    private readonly object _publishLock = new();
    private readonly object _consumerLock = new();
    private readonly Dictionary<string, Dictionary<string, (Type EventType, Func<object, Guid, Task> Handler)>> _consumers = new();
    private readonly Dictionary<string, IModel> _consumerChannels = new();
    private readonly CancellationTokenSource _lifetimeCts = new();
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private IConnection? _connection;
    private IModel? _publishChannel;
    private bool _usesDelayedExchange;
    private bool _disposed;

    public RabbitMQEventBus(IOptions<RabbitMQEventBusOptions> options, ILogger<RabbitMQEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        _factory = new ConnectionFactory
        {
            HostName = _options.HostName,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5)
        };

        Connect();
        DeclareExchange();

        _logger.LogInformation(
            "RabbitMQEventBus initialized. Host: {Host}:{Port}, Exchange: {Exchange}, DelayedExchange: {Delayed}",
            _options.HostName, _options.Port, _options.ExchangeName, _usesDelayedExchange);
    }

    public Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId) where T : class
    {
        PublishInternal(eventData, source, detailType, correlationId, delayMs: 0);
        return Task.CompletedTask;
    }

    public Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTime) where T : class
    {
        var delay = scheduledTime - DateTime.UtcNow;
        return ScheduleAsync(eventData, source, detailType, correlationId, delay);
    }

    public Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        if (delay <= TimeSpan.Zero)
        {
            return PublishAsync(eventData, source, detailType, correlationId);
        }

        if (_usesDelayedExchange)
        {
            var delayMs = delay.TotalMilliseconds > int.MaxValue ? int.MaxValue : (int)delay.TotalMilliseconds;
            PublishInternal(eventData, source, detailType, correlationId, delayMs);
            _logger.LogInformation(
                "Scheduled event {EventType} via delayed exchange. DelayMs: {DelayMs}, CorrelationId: {CorrelationId}",
                typeof(T).Name, delayMs, correlationId);
            return Task.CompletedTask;
        }

        _ = PublishAfterDelayAsync(eventData, source, detailType, correlationId, delay);
        _logger.LogWarning(
            "Delayed exchange plugin not available. Scheduling {EventType} in-process. Delay: {Delay}, CorrelationId: {CorrelationId}",
            typeof(T).Name, delay, correlationId);
        return Task.CompletedTask;
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        lock (_consumerLock)
        {
            var detailType = EventDetailTypeMapper.GetDetailType(typeof(T));

            if (!_consumers.ContainsKey(queueName))
            {
                _consumers[queueName] = new Dictionary<string, (Type, Func<object, Guid, Task>)>();
            }

            if (_consumers[queueName].ContainsKey(detailType))
            {
                _logger.LogWarning(
                    "Consumer for queue {QueueName} and event type {EventType} ({DetailType}) is already running",
                    queueName, typeof(T).Name, detailType);
                return;
            }

            _consumers[queueName][detailType] = (typeof(T), (obj, corrId) => handler((T)obj, corrId));

            var channel = GetOrCreateConsumerChannel(queueName);
            channel.QueueBind(queueName, _options.ExchangeName, detailType);

            _logger.LogInformation(
                "Registered handler for queue {QueueName} and event type {EventType} ({DetailType})",
                queueName, typeof(T).Name, detailType);
        }
    }

    public void StopConsuming()
    {
        lock (_consumerLock)
        {
            foreach (var channel in _consumerChannels.Values)
            {
                try { channel.Close(); } catch { /* ignore */ }
                try { channel.Dispose(); } catch { /* ignore */ }
            }

            _consumerChannels.Clear();
            _consumers.Clear();
            _logger.LogInformation("Stopped all RabbitMQ consumers");
        }
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        _lifetimeCts.Cancel();
        StopConsuming();

        try { _publishChannel?.Close(); } catch { /* ignore */ }
        try { _publishChannel?.Dispose(); } catch { /* ignore */ }
        try { _connection?.Close(); } catch { /* ignore */ }
        try { _connection?.Dispose(); } catch { /* ignore */ }
        _lifetimeCts.Dispose();
    }

    private void Connect()
    {
        try
        {
            _connection = _factory.CreateConnection();
            _publishChannel = _connection.CreateModel();
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Failed to connect to RabbitMQ at {_options.HostName}:{_options.Port}. Start RabbitMQ locally (e.g. docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management).",
                ex);
        }
    }

    private void DeclareExchange()
    {
        try
        {
            _publishChannel!.ExchangeDeclare(
                _options.ExchangeName,
                "x-delayed-message",
                durable: true,
                autoDelete: false,
                arguments: new Dictionary<string, object> { ["x-delayed-type"] = "topic" });
            _usesDelayedExchange = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "RabbitMQ delayed-message plugin not installed. Falling back to topic exchange.");
            RecreatePublishChannel();
            _publishChannel!.ExchangeDeclare(_options.ExchangeName, ExchangeType.Topic, durable: true);
            _usesDelayedExchange = false;
        }
    }

    private void RecreatePublishChannel()
    {
        try { _publishChannel?.Dispose(); } catch { /* ignore */ }
        _publishChannel = _connection!.CreateModel();
    }

    private void PublishInternal<T>(T eventData, string source, string detailType, Guid correlationId, int delayMs) where T : class
    {
        var json = JsonSerializer.Serialize(eventData, _jsonOptions);
        var body = Encoding.UTF8.GetBytes(json);

        lock (_publishLock)
        {
            var props = _publishChannel!.CreateBasicProperties();
            props.Persistent = true;
            props.ContentType = "application/json";
            props.CorrelationId = correlationId.ToString();
            props.MessageId = correlationId.ToString();
            props.Type = detailType;
            props.Headers = new Dictionary<string, object>
            {
                ["EventType"] = typeof(T).Name,
                ["Source"] = source,
                ["DetailType"] = detailType,
                ["CorrelationId"] = correlationId.ToString()
            };

            if (delayMs > 0)
            {
                props.Headers["x-delay"] = delayMs;
            }

            _publishChannel.BasicPublish(
                exchange: _options.ExchangeName,
                routingKey: detailType,
                basicProperties: props,
                body: body);
        }

        _logger.LogInformation(
            "Published event {EventType} to RabbitMQ. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
            typeof(T).Name, source, detailType, correlationId);
    }

    private async Task PublishAfterDelayAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        try
        {
            await Task.Delay(delay, _lifetimeCts.Token);
            if (_disposed)
            {
                return;
            }

            await PublishAsync(eventData, source, detailType, correlationId);
        }
        catch (OperationCanceledException)
        {
            // shutting down
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish delayed event {EventType}. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
        }
    }

    private IModel GetOrCreateConsumerChannel(string queueName)
    {
        if (_consumerChannels.TryGetValue(queueName, out var existing))
        {
            return existing;
        }

        var channel = _connection!.CreateModel();
        channel.BasicQos(0, 10, false);
        channel.QueueDeclare(queueName, durable: true, exclusive: false, autoDelete: false);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.Received += async (_, ea) => await HandleMessageAsync(queueName, channel, ea);
        channel.BasicConsume(queueName, autoAck: false, consumer);

        _consumerChannels[queueName] = channel;
        _logger.LogInformation("Started consuming from queue {QueueName}", queueName);
        return channel;
    }

    private async Task HandleMessageAsync(string queueName, IModel channel, BasicDeliverEventArgs ea)
    {
        try
        {
            var detailJson = Encoding.UTF8.GetString(ea.Body.ToArray());
            var detailType = GetHeader(ea.BasicProperties, "DetailType") ?? ea.BasicProperties.Type;
            var correlationId = ParseCorrelationId(ea.BasicProperties);

            Dictionary<string, (Type EventType, Func<object, Guid, Task> Handler)>? handlers;
            lock (_consumerLock)
            {
                _consumers.TryGetValue(queueName, out handlers);
                if (handlers != null)
                {
                    handlers = new Dictionary<string, (Type, Func<object, Guid, Task>)>(handlers);
                }
            }

            if (handlers == null || handlers.Count == 0)
            {
                _logger.LogWarning("No handlers registered for queue {QueueName}", queueName);
                channel.BasicAck(ea.DeliveryTag, false);
                return;
            }

            if (string.IsNullOrEmpty(detailType) || !handlers.TryGetValue(detailType, out var registered))
            {
                var processed = false;
                foreach (var (eventType, handler) in handlers.Values)
                {
                    try
                    {
                        var inferred = JsonSerializer.Deserialize(detailJson, eventType, _jsonOptions);
                        if (inferred == null)
                        {
                            continue;
                        }

                        await handler(inferred, correlationId ?? GetCorrelationIdFromEvent(inferred, eventType));
                        processed = true;
                        break;
                    }
                    catch (JsonException)
                    {
                        // try next handler
                    }
                }

                if (!processed)
                {
                    _logger.LogWarning(
                        "No matching handler for queue {QueueName}, detailType {DetailType}",
                        queueName, detailType);
                }

                channel.BasicAck(ea.DeliveryTag, false);
                return;
            }

            var eventData = JsonSerializer.Deserialize(detailJson, registered.EventType, _jsonOptions);
            if (eventData == null)
            {
                _logger.LogWarning("Failed to deserialize {DetailType} from queue {QueueName}", detailType, queueName);
                channel.BasicAck(ea.DeliveryTag, false);
                return;
            }

            var corrId = correlationId ?? GetCorrelationIdFromEvent(eventData, registered.EventType);
            await registered.Handler(eventData, corrId);
            channel.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process message from queue {QueueName}", queueName);
            var retryCount = GetRetryCount(ea.BasicProperties, ea.Redelivered);
            if (ea.Redelivered || retryCount + 1 >= _options.MaxReceiveCount)
            {
                channel.BasicNack(ea.DeliveryTag, false, requeue: false);
                return;
            }

            channel.BasicNack(ea.DeliveryTag, false, requeue: true);
        }
    }

    private static Guid GetCorrelationIdFromEvent(object eventData, Type eventType)
    {
        var property = eventType.GetProperty("CorrelationId");
        if (property != null && property.PropertyType == typeof(Guid) && property.GetValue(eventData) is Guid guid && guid != Guid.Empty)
        {
            return guid;
        }

        return Guid.NewGuid();
    }

    private static Guid? ParseCorrelationId(IBasicProperties properties)
    {
        var header = GetHeader(properties, "CorrelationId");
        if (!string.IsNullOrEmpty(header) && Guid.TryParse(header, out var fromHeader))
        {
            return fromHeader;
        }

        if (!string.IsNullOrEmpty(properties.CorrelationId) && Guid.TryParse(properties.CorrelationId, out var fromProp))
        {
            return fromProp;
        }

        return null;
    }

    private static int GetRetryCount(IBasicProperties properties, bool redelivered)
    {
        if (properties.Headers == null || !properties.Headers.TryGetValue("x-delivery-count", out var value) || value == null)
        {
            return redelivered ? 1 : 0;
        }

        return value switch
        {
            int i => i,
            long l => (int)l,
            byte[] bytes when int.TryParse(Encoding.UTF8.GetString(bytes), out var parsed) => parsed,
            _ => redelivered ? 1 : 0
        };
    }

    private static string? GetHeader(IBasicProperties properties, string key)
    {
        if (properties.Headers == null || !properties.Headers.TryGetValue(key, out var value) || value == null)
        {
            return null;
        }

        return value switch
        {
            byte[] bytes => Encoding.UTF8.GetString(bytes),
            string s => s,
            _ => value.ToString()
        };
    }
}
