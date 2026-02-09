using Google.Cloud.PubSub.V1;
using Google.Cloud.Scheduler.V1;
using Google.Api.Gax.ResourceNames;
using Google.Protobuf.WellKnownTypes;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Grpc.Core;

namespace Shared.Messaging;

public class GcpEventBus : IEventBus, IDisposable
{
    private readonly GcpEventBusOptions _options;
    private readonly ILogger<GcpEventBus> _logger;
    private readonly PublisherServiceApiClient _publisherClient;
    private readonly SubscriberServiceApiClient _subscriberClient;
    private readonly CloudSchedulerClient? _schedulerClient;
    private readonly Dictionary<string, (SubscriberClient Client, CancellationTokenSource Cts)> _subscribers = new();
    private readonly object _lock = new object();

    public GcpEventBus(IOptions<GcpEventBusOptions> options, ILogger<GcpEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        // Initialize Pub/Sub clients
        _publisherClient = PublisherServiceApiClient.Create();
        _subscriberClient = SubscriberServiceApiClient.Create();

        // Initialize Cloud Scheduler client if service account is provided
        if (!string.IsNullOrEmpty(_options.ServiceAccountEmail))
        {
            _schedulerClient = CloudSchedulerClient.Create();
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

            var topicName = Google.Cloud.PubSub.V1.TopicName.FromProjectTopic(_options.ProjectId, $"{_options.ServicePrefix}-{detailType.ToLower()}");
            
            // Ensure topic exists
            try
            {
                await _publisherClient.CreateTopicAsync(topicName);
                _logger.LogInformation("Created topic {TopicName}", topicName);
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
            {
                // Topic already exists, continue
            }

            var message = new PubsubMessage
            {
                Data = Google.Protobuf.ByteString.CopyFromUtf8(json),
                MessageId = correlationId.ToString(),
                Attributes =
                {
                    { "EventType", typeof(T).Name },
                    { "Source", source },
                    { "DetailType", detailType },
                    { "CorrelationId", correlationId.ToString() }
                }
            };

            await _publisherClient.PublishAsync(topicName, new[] { message });

            _logger.LogInformation(
                "Published event {EventType} to Pub/Sub. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
                typeof(T).Name, source, detailType, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish event {EventType} to GCP Pub/Sub. CorrelationId: {CorrelationId}",
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

            if (_schedulerClient == null)
            {
                _logger.LogWarning("Cloud Scheduler not configured. Publishing event immediately instead of scheduling.");
                await PublishAsync(eventData, source, detailType, correlationId);
                return;
            }

            var scheduledTime = DateTime.UtcNow.Add(delay);
            var json = JsonSerializer.Serialize(eventData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            var scheduleName = $"projects/{_options.ProjectId}/locations/{_options.SchedulerLocation}/jobs/{_options.ServicePrefix}-{detailType.ToLower()}-{correlationId:N}";
            
            var topicName = Google.Cloud.PubSub.V1.TopicName.FromProjectTopic(_options.ProjectId, $"{_options.ServicePrefix}-{detailType.ToLower()}");
            var topicPath = $"projects/{_options.ProjectId}/topics/{topicName.TopicId}";

            var job = new Job
            {
                Name = scheduleName,
                PubsubTarget = new PubsubTarget
                {
                    TopicName = topicPath,
                    Data = Google.Protobuf.ByteString.CopyFromUtf8(json),
                    Attributes =
                    {
                        { "EventType", typeof(T).Name },
                        { "Source", source },
                        { "DetailType", detailType },
                        { "CorrelationId", correlationId.ToString() }
                    }
                },
                Schedule = $"0 {scheduledTime.Minute} {scheduledTime.Hour} {scheduledTime.Day} {scheduledTime.Month} *", // Cron format
                TimeZone = "UTC"
            };

            if (!string.IsNullOrEmpty(_options.ServiceAccountEmail))
            {
                // ServiceAccountEmail is set via IAM policy, not directly on PubsubTarget
                // This is handled at the job level or via IAM bindings
            }

            var parent = LocationName.FromProjectLocation(_options.ProjectId, _options.SchedulerLocation);
            
            try
            {
                await _schedulerClient.CreateJobAsync(parent, job);
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
            {
                // Job already exists, update it
                var updateRequest = new UpdateJobRequest
                {
                    Job = job
                };
                await _schedulerClient.UpdateJobAsync(updateRequest);
            }

            _logger.LogInformation(
                "Scheduled event {EventType} via Cloud Scheduler. ScheduleName: {ScheduleName}, ScheduledTime: {ScheduledTime}, CorrelationId: {CorrelationId}",
                typeof(T).Name, scheduleName, scheduledTime, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule event {EventType} via Cloud Scheduler. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        lock (_lock)
        {
            if (_subscribers.ContainsKey(queueName))
            {
                _logger.LogWarning("Consumer for subscription {QueueName} is already running", queueName);
                return;
            }

            var subscriptionName = Google.Cloud.PubSub.V1.SubscriptionName.FromProjectSubscription(_options.ProjectId, $"{_options.ServicePrefix}-{queueName}");
            var topicName = Google.Cloud.PubSub.V1.TopicName.FromProjectTopic(_options.ProjectId, $"{_options.ServicePrefix}-{queueName}");

            // Ensure subscription exists
            try
            {
                _subscriberClient.CreateSubscription(new Subscription
                {
                    SubscriptionName = subscriptionName,
                    TopicAsTopicName = topicName,
                    AckDeadlineSeconds = _options.AckDeadlineSeconds,
                    DeadLetterPolicy = new DeadLetterPolicy
                    {
                        MaxDeliveryAttempts = _options.MaxDeliveryAttempts
                    }
                });
                _logger.LogInformation("Created subscription {SubscriptionName}", subscriptionName);
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
            {
                // Subscription already exists, continue
            }

            var subscriber = SubscriberClient.Create(subscriptionName);
            var cts = new CancellationTokenSource();
            
            // Start subscriber with message handler
            _ = subscriber.StartAsync(async (message, cancellationToken) =>
            {
                try
                {
                    var correlationId = Guid.Parse(
                        message.Attributes.GetValueOrDefault("CorrelationId") ?? message.MessageId ?? Guid.NewGuid().ToString());

                    var json = message.Data.ToStringUtf8();
                    var eventData = JsonSerializer.Deserialize<T>(json, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    });

                    if (eventData == null)
                    {
                        _logger.LogWarning("Failed to deserialize event data from subscription {QueueName}. MessageId: {MessageId}",
                            queueName, message.MessageId);
                        return SubscriberClient.Reply.Ack;
                    }

                    await handler(eventData, correlationId);
                    _logger.LogDebug("Processed message {MessageId} from subscription {QueueName}", message.MessageId, queueName);
                    return SubscriberClient.Reply.Ack;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing message {MessageId} from subscription {QueueName}", message.MessageId, queueName);
                    return SubscriberClient.Reply.Nack;
                }
            });

            _subscribers[queueName] = (subscriber, cts);
            _logger.LogInformation("Started consuming from subscription {QueueName} for event type {EventType}", queueName, typeof(T).Name);
        }
    }

    public void StopConsuming()
    {
        lock (_lock)
        {
            foreach (var (subscriber, cts) in _subscribers.Values)
            {
                cts.Cancel();
                subscriber.StopAsync(CancellationToken.None).GetAwaiter().GetResult();
                cts.Dispose();
            }
            _subscribers.Clear();
            _logger.LogInformation("Stopped all consumers");
        }
    }

    public void Dispose()
    {
        StopConsuming();
        // Google Cloud clients don't require explicit disposal - they're managed by the SDK
        // The clients will be garbage collected when no longer referenced
    }
}
