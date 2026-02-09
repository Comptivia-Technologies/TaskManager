using Azure.Messaging.ServiceBus;
using Azure.Messaging.EventGrid;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Shared.Messaging;

public class AzureEventBus : IEventBus, IDisposable
{
    private readonly AzureEventBusOptions _options;
    private readonly ILogger<AzureEventBus> _logger;
    private readonly ServiceBusClient _serviceBusClient;
    private readonly EventGridPublisherClient? _eventGridClient;
    private readonly Dictionary<string, ServiceBusProcessor> _processors = new();
    private readonly object _lock = new object();

    public AzureEventBus(IOptions<AzureEventBusOptions> options, ILogger<AzureEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        _serviceBusClient = new ServiceBusClient(_options.ServiceBusConnectionString);

        // Initialize Event Grid client if endpoint is provided
        if (!string.IsNullOrEmpty(_options.EventGridTopicEndpoint) && !string.IsNullOrEmpty(_options.EventGridAccessKey))
        {
            _eventGridClient = new EventGridPublisherClient(
                new Uri(_options.EventGridTopicEndpoint),
                new Azure.AzureKeyCredential(_options.EventGridAccessKey));
        }
    }

    public async Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId) where T : class
    {
        try
        {
            var json = JsonSerializer.Serialize(eventData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Publish to Event Grid if available, otherwise use Service Bus topic
            if (_eventGridClient != null)
            {
                var eventGridEvent = new Azure.Messaging.EventGrid.EventGridEvent(
                    source,
                    detailType,
                    "1.0",
                    BinaryData.FromString(json));

                eventGridEvent.Id = correlationId.ToString();
                eventGridEvent.EventTime = DateTimeOffset.UtcNow;

                await _eventGridClient.SendEventAsync(eventGridEvent);

                _logger.LogInformation(
                    "Published event {EventType} to Event Grid. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
                    typeof(T).Name, source, detailType, correlationId);
            }
            else
            {
                // Fallback to Service Bus topic
                await using var sender = _serviceBusClient.CreateSender($"{_options.ServicePrefix}-{detailType.ToLower()}");
                
                var message = new ServiceBusMessage(json)
                {
                    MessageId = correlationId.ToString(),
                    CorrelationId = correlationId.ToString(),
                    Subject = detailType,
                    ApplicationProperties =
                    {
                        { "EventType", typeof(T).Name },
                        { "Source", source },
                        { "DetailType", detailType }
                    }
                };

                await sender.SendMessageAsync(message);

                _logger.LogInformation(
                    "Published event {EventType} to Service Bus. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
                    typeof(T).Name, source, detailType, correlationId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish event {EventType} to Azure. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
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

    public async Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        try
        {
            if (delay <= TimeSpan.Zero)
            {
                await PublishAsync(eventData, source, detailType, correlationId);
                return;
            }

            var scheduledTime = DateTime.UtcNow.Add(delay);
            var json = JsonSerializer.Serialize(eventData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Use Service Bus scheduled messages
            var topicName = $"{_options.ServicePrefix}-{detailType.ToLower()}";
            await using var sender = _serviceBusClient.CreateSender(topicName);

            var message = new ServiceBusMessage(json)
            {
                MessageId = correlationId.ToString(),
                CorrelationId = correlationId.ToString(),
                Subject = detailType,
                ScheduledEnqueueTime = scheduledTime,
                ApplicationProperties =
                {
                    { "EventType", typeof(T).Name },
                    { "Source", source },
                    { "DetailType", detailType },
                    { "ScheduledTime", scheduledTime.ToString("O") }
                }
            };

            await sender.SendMessageAsync(message);

            _logger.LogInformation(
                "Scheduled event {EventType} via Service Bus. ScheduledTime: {ScheduledTime}, CorrelationId: {CorrelationId}",
                typeof(T).Name, scheduledTime, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule event {EventType} via Azure Service Bus. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        lock (_lock)
        {
            if (_processors.ContainsKey(queueName))
            {
                _logger.LogWarning("Consumer for queue {QueueName} is already running", queueName);
                return;
            }

            var fullQueueName = $"{_options.ServicePrefix}-{queueName}";
            var processor = _serviceBusClient.CreateProcessor(fullQueueName, new ServiceBusProcessorOptions
            {
                MaxConcurrentCalls = 1,
                AutoCompleteMessages = false
            });

            processor.ProcessMessageAsync += async args =>
            {
                try
                {
                    var correlationId = Guid.Parse(
                        args.Message.CorrelationId ?? args.Message.MessageId ?? Guid.NewGuid().ToString());

                    var body = args.Message.Body.ToString();
                    var eventData = JsonSerializer.Deserialize<T>(body, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    if (eventData == null)
                    {
                        _logger.LogWarning("Failed to deserialize event data from queue {QueueName}. MessageId: {MessageId}",
                            queueName, args.Message.MessageId);
                        await args.CompleteMessageAsync(args.Message);
                        return;
                    }

                    await handler(eventData, correlationId);
                    await args.CompleteMessageAsync(args.Message);

                    _logger.LogDebug("Processed message {MessageId} from queue {QueueName}", args.Message.MessageId, queueName);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message {MessageId} from queue {QueueName}", args.Message.MessageId, queueName);
                    await args.AbandonMessageAsync(args.Message);
                }
            };

            processor.ProcessErrorAsync += args =>
            {
                _logger.LogError(args.Exception, "Error in Service Bus processor for queue {QueueName}", queueName);
                return Task.CompletedTask;
            };

            _processors[queueName] = processor;
            processor.StartProcessingAsync();

            _logger.LogInformation("Started consuming from queue {QueueName} for event type {EventType}", queueName, typeof(T).Name);
        }
    }

    public void StopConsuming()
    {
        lock (_lock)
        {
            foreach (var processor in _processors.Values)
            {
                processor.StopProcessingAsync().GetAwaiter().GetResult();
                processor.DisposeAsync().GetAwaiter().GetResult();
            }
            _processors.Clear();
            _logger.LogInformation("Stopped all consumers");
        }
    }

    public void Dispose()
    {
        StopConsuming();
        _serviceBusClient?.DisposeAsync().GetAwaiter().GetResult();
        // EventGridPublisherClient doesn't implement IDisposable - it's managed by the SDK
        // No explicit disposal needed
    }
}
