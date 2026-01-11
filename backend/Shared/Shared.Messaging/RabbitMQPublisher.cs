using RabbitMQ.Client;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Shared.Messaging;

/// <summary>
/// RabbitMQ event publisher implementation
/// </summary>
public class RabbitMQPublisher : IRabbitMQPublisher, IDisposable
{
    private readonly IConnection _connection;
    private IModel _channel;
    private readonly ILogger<RabbitMQPublisher> _logger;
    private readonly RabbitMQOptions _options;
    private readonly object _channelLock = new object();

    public RabbitMQPublisher(IOptions<RabbitMQOptions> options, ILogger<RabbitMQPublisher> logger)
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

    public async Task PublishAsync<T>(T eventData, string exchange, string routingKey, Guid correlationId) where T : class
    {
        try
        {
            // Ensure channel is open and ready (handles recovery)
            var channel = EnsureChannel();

            // Ensure exchange exists (Direct exchange, durable)
            channel.ExchangeDeclare(
                exchange: exchange,
                type: ExchangeType.Direct,
                durable: true,
                autoDelete: false);

            var json = JsonSerializer.Serialize(eventData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var body = Encoding.UTF8.GetBytes(json);

            var properties = channel.CreateBasicProperties();
            properties.Persistent = true; // Message durability
            properties.MessageId = Guid.NewGuid().ToString();
            properties.CorrelationId = correlationId.ToString();
            properties.Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            properties.Headers = new Dictionary<string, object>
            {
                { "EventType", typeof(T).Name }
            };

            channel.BasicPublish(
                exchange: exchange,
                routingKey: routingKey,
                basicProperties: properties,
                body: body);

            _logger.LogInformation(
                "Published event {EventType} to exchange {Exchange} with routing key {RoutingKey}, CorrelationId: {CorrelationId}",
                typeof(T).Name, exchange, routingKey, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to publish event {EventType} to exchange {Exchange}, CorrelationId: {CorrelationId}",
                typeof(T).Name, exchange, correlationId);
            throw;
        }
    }

    public void Dispose()
    {
        _channel?.Close();
        _channel?.Dispose();
        _connection?.Close();
        _connection?.Dispose();
    }
}

