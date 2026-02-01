using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Shared.Contracts.Constants;

namespace Shared.Messaging;

/// <summary>
/// RabbitMQ event consumer implementation with retry and DLQ support
/// </summary>
public class RabbitMQConsumer : IRabbitMQConsumer, IDisposable
{
    private readonly IConnection _connection;
    private IModel _channel;
    private readonly ILogger<RabbitMQConsumer> _logger;
    private readonly RabbitMQOptions _options;
    private readonly Dictionary<string, AsyncEventingBasicConsumer> _consumers = new();
    private readonly Dictionary<string, string> _consumerTags = new();
    private readonly object _channelLock = new object();

    public RabbitMQConsumer(IOptions<RabbitMQOptions> options, ILogger<RabbitMQConsumer> logger)
    {
        _options = options.Value;
        _logger = logger;

        try
        {
            var factory = new ConnectionFactory
            {
                HostName = _options.HostName,
                Port = _options.Port,
                UserName = _options.UserName,
                Password = _options.Password,
                VirtualHost = _options.VirtualHost,
                DispatchConsumersAsync = true,
                RequestedConnectionTimeout = TimeSpan.FromSeconds(30),
                AutomaticRecoveryEnabled = true, // Enable automatic recovery
                NetworkRecoveryInterval = TimeSpan.FromSeconds(10), // Retry every 10 seconds
                ContinuationTimeout = TimeSpan.FromSeconds(20)
            };

            _logger.LogInformation(
                "Attempting to connect to RabbitMQ at {HostName}:{Port}, VirtualHost: {VirtualHost}",
                _options.HostName, _options.Port, _options.VirtualHost);

            _connection = factory.CreateConnection();
            
            // Add event handlers for connection recovery
            _connection.ConnectionShutdown += (sender, args) =>
            {
                _logger.LogWarning(
                    "RabbitMQ connection shutdown. Reason: {Reason}, ReplyCode: {ReplyCode}, ReplyText: {ReplyText}",
                    args.Cause, args.ReplyCode, args.ReplyText);
            };

            _channel = _connection.CreateModel();
            
            // Add channel event handlers
            _channel.ModelShutdown += (sender, args) =>
            {
                _logger.LogWarning(
                    "RabbitMQ channel shutdown. Reason: {Reason}, ReplyCode: {ReplyCode}, ReplyText: {ReplyText}",
                    args.Cause, args.ReplyCode, args.ReplyText);
            };

            _logger.LogInformation(
                "Successfully connected to RabbitMQ at {HostName}:{Port}",
                _options.HostName, _options.Port);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to connect to RabbitMQ at {HostName}:{Port}. Please ensure RabbitMQ is running.",
                _options.HostName, _options.Port);
            throw;
        }
    }

    private IModel EnsureChannel()
    {
        lock (_channelLock)
        {
            // Wait for connection to be open (automatic recovery)
            if (!_connection.IsOpen)
            {
                var maxWaitTime = TimeSpan.FromSeconds(30);
                var startTime = DateTime.UtcNow;
                
                while (!_connection.IsOpen && (DateTime.UtcNow - startTime) < maxWaitTime)
                {
                    _logger.LogInformation("Waiting for RabbitMQ connection recovery...");
                    Thread.Sleep(1000);
                }

                if (!_connection.IsOpen)
                {
                    throw new InvalidOperationException("RabbitMQ connection is not open and recovery timed out.");
                }
            }

            // Recreate channel if it's closed
            if (_channel == null || !_channel.IsOpen)
            {
                _logger.LogInformation("Recreating RabbitMQ channel after connection recovery");
                
                // Dispose old channel if it exists
                try
                {
                    _channel?.Close();
                    _channel?.Dispose();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error disposing old channel");
                }

                _channel = _connection.CreateModel();
                
                // Re-register channel event handler
                _channel.ModelShutdown += (sender, args) =>
                {
                    _logger.LogWarning(
                        "RabbitMQ channel shutdown. Reason: {Reason}, ReplyCode: {ReplyCode}, ReplyText: {ReplyText}",
                        args.Cause, args.ReplyCode, args.ReplyText);
                };
            }

            return _channel;
        }
    }

    public void StartConsuming<T>(string exchange, string queue, string routingKey, Func<T, Guid, Task> handler) where T : class
    {
        try
        {
            _logger.LogInformation(
                "Starting to consume from queue {Queue} on exchange {Exchange} with routing key {RoutingKey}",
                queue, exchange, routingKey);

            // Ensure channel is open and ready (handles recovery)
            var channel = EnsureChannel();

            // Declare exchange (Direct, durable)
            channel.ExchangeDeclare(
                exchange: exchange,
                type: ExchangeType.Direct,
                durable: true,
                autoDelete: false);
            
            _logger.LogInformation("Exchange declared: {Exchange}", exchange);

            // Declare dead letter exchange
            var dlxName = $"{exchange}.dlx";
            channel.ExchangeDeclare(
                exchange: dlxName,
                type: ExchangeType.Direct,
                durable: true,
                autoDelete: false);

            // Declare dead letter queue
            var dlqName = $"{queue}.dlq";
            channel.QueueDeclare(
                queue: dlqName,
                durable: true,
                exclusive: false,
                autoDelete: false);

            channel.QueueBind(
                queue: dlqName,
                exchange: dlxName,
                routingKey: routingKey);

            // Declare main queue with DLX
            var queueArgs = new Dictionary<string, object>
            {
                { "x-dead-letter-exchange", dlxName },
                { "x-dead-letter-routing-key", routingKey },
                { "x-message-ttl", 300000 } // 5 minutes TTL for retries
            };

            var queueResult = channel.QueueDeclare(
                queue: queue,
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: queueArgs);

            _logger.LogInformation(
                "Queue declared: {Queue} on exchange {Exchange}. QueueName: {QueueName}, MessageCount: {MessageCount}, ConsumerCount: {ConsumerCount}",
                queue, exchange, queueResult.QueueName, queueResult.MessageCount, queueResult.ConsumerCount);

            // Bind queue to exchange
            channel.QueueBind(
                queue: queue,
                exchange: exchange,
                routingKey: routingKey);

            _logger.LogDebug(
                "Queue bound: {Queue} to exchange {Exchange} with routing key {RoutingKey}",
                queue, exchange, routingKey);

            // Create async consumer
            var consumer = new AsyncEventingBasicConsumer(channel);
            consumer.Received += async (model, ea) =>
            {
                var correlationId = Guid.Parse(ea.BasicProperties.CorrelationId ?? Guid.NewGuid().ToString());
                var retryCount = GetRetryCount(ea.BasicProperties.Headers);

                try
                {
                    // Ensure channel is still open for this message
                    var currentChannel = EnsureChannel();
                    
                    var body = ea.Body.ToArray();
                    var message = Encoding.UTF8.GetString(body);
                    var eventData = JsonSerializer.Deserialize<T>(message, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    if (eventData == null)
                    {
                        _logger.LogWarning("Received null event data for queue {Queue}, CorrelationId: {CorrelationId}",
                            queue, correlationId);
                        currentChannel.BasicAck(ea.DeliveryTag, false);
                        return;
                    }

                    _logger.LogInformation(
                        "Received event {EventType} from queue {Queue}, CorrelationId: {CorrelationId}, RetryCount: {RetryCount}",
                        typeof(T).Name, queue, correlationId, retryCount);

                    await handler(eventData, correlationId);

                    currentChannel.BasicAck(ea.DeliveryTag, false);

                    _logger.LogInformation(
                        "Successfully processed event {EventType}, CorrelationId: {CorrelationId}",
                        typeof(T).Name, correlationId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error processing event {EventType} from queue {Queue}, CorrelationId: {CorrelationId}, RetryCount: {RetryCount}",
                        typeof(T).Name, queue, correlationId, retryCount);

                    try
                    {
                        var currentChannel = EnsureChannel();
                        
                        if (retryCount < EventConstants.MaxRetryAttempts)
                        {
                            // Retry with incremented count
                            var retryProperties = currentChannel.CreateBasicProperties();
                            retryProperties.Persistent = true;
                            retryProperties.CorrelationId = correlationId.ToString();
                            retryProperties.Headers = new Dictionary<string, object>
                            {
                                { "x-retry-count", retryCount + 1 },
                                { "x-original-exchange", exchange },
                                { "x-original-routing-key", routingKey }
                            };

                            // Re-publish with delay (using TTL)
                            await Task.Delay(TimeSpan.FromSeconds(EventConstants.RetryDelaySeconds * (retryCount + 1)));
                            currentChannel.BasicPublish(exchange, routingKey, retryProperties, ea.Body);
                            currentChannel.BasicAck(ea.DeliveryTag, false);
                        }
                        else
                        {
                            // Max retries reached, send to DLQ
                            _logger.LogError(
                                "Max retries reached for event {EventType}, sending to DLQ, CorrelationId: {CorrelationId}",
                                typeof(T).Name, correlationId);
                            currentChannel.BasicNack(ea.DeliveryTag, false, false);
                        }
                    }
                    catch (Exception channelEx)
                    {
                        _logger.LogError(channelEx, "Error handling retry/DLQ for event {EventType}, CorrelationId: {CorrelationId}",
                            typeof(T).Name, correlationId);
                    }
                }
            };

            var consumerTag = channel.BasicConsume(
                queue: queue,
                autoAck: false,
                consumer: consumer);

            _consumers[queue] = consumer;
            _consumerTags[queue] = consumerTag;

            _logger.LogInformation(
                "Started consuming from queue {Queue} on exchange {Exchange} with routing key {RoutingKey}. ConsumerTag: {ConsumerTag}",
                queue, exchange, routingKey, consumerTag);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start consuming from queue {Queue}", queue);
            throw;
        }
    }

    private int GetRetryCount(IDictionary<string, object>? headers)
    {
        if (headers == null || !headers.ContainsKey("x-retry-count"))
            return 0;

        if (headers["x-retry-count"] is int count)
            return count;

        return 0;
    }

    public void StopConsuming()
    {
        lock (_channelLock)
        {
            try
            {
                var channel = _channel;
                if (channel != null && channel.IsOpen)
                {
                    foreach (var kvp in _consumers)
                    {
                        var queue = kvp.Key;
                        if (_consumerTags.TryGetValue(queue, out var consumerTag))
                        {
                            try
                            {
                                channel.BasicCancel(consumerTag);
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Error canceling consumer for queue {Queue}", queue);
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error stopping consumers");
            }
            finally
            {
                _consumers.Clear();
                _consumerTags.Clear();
            }
        }
    }

    public void Dispose()
    {
        StopConsuming();
        _channel?.Close();
        _channel?.Dispose();
        _connection?.Close();
        _connection?.Dispose();
    }
}

