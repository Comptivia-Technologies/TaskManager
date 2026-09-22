using System.Text.Json;
using Google.Api.Gax.ResourceNames;
using Google.Cloud.PubSub.V1;
using Google.Cloud.Tasks.V2;
using Google.Protobuf;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Task = System.Threading.Tasks.Task;
using Type = System.Type;

namespace Shared.Messaging;

public class GcpEventBus : IEventBus, IDisposable
{
    private const int PubSubMinDeliveryAttempts = 5;
    private const int PubSubMaxDeliveryAttempts = 100;
    private static readonly TimeSpan MaxScheduleDelay = TimeSpan.FromHours(720);
    private const string PubSubScope = "https://www.googleapis.com/auth/pubsub";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly GcpEventBusOptions _options;
    private readonly ILogger<GcpEventBus> _logger;
    private readonly PublisherServiceApiClient _publisherClient;
    private readonly SubscriberServiceApiClient _subscriberClient;
    private readonly CloudTasksClient _tasksClient;
    private readonly Dictionary<string, Dictionary<string, (Type EventType, Func<object, Guid, Task> Handler)>> _handlers = new();
    private readonly Dictionary<string, SubscriberClient> _subscribers = new();
    private readonly Dictionary<string, int> _startGeneration = new();
    private readonly object _lock = new();
    private readonly object _topicLock = new();
    private bool _topicReady;
    private bool _disposed;

    public GcpEventBus(IOptions<GcpEventBusOptions> options, ILogger<GcpEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;
        _publisherClient = PublisherServiceApiClient.Create();
        _subscriberClient = SubscriberServiceApiClient.Create();
        _tasksClient = CloudTasksClient.Create();
    }

    public async Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId) where T : class
    {
        try
        {
            EnsureTopic();
            var json = JsonSerializer.Serialize(eventData, JsonOptions);
            var message = BuildMessage(json, typeof(T).Name, source, detailType, correlationId);
            await _publisherClient.PublishAsync(TopicName, new[] { message });

            _logger.LogInformation(
                "Published event {EventType} to Pub/Sub topic {Topic}. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
                typeof(T).Name, TopicId, source, detailType, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish event {EventType} to GCP Pub/Sub. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
    }

    public Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTime) where T : class
    {
        return ScheduleAtAsync(eventData, source, detailType, correlationId, AsUtc(scheduledTime));
    }

    public Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        if (delay <= TimeSpan.Zero)
        {
            return PublishAsync(eventData, source, detailType, correlationId);
        }

        return ScheduleAtAsync(eventData, source, detailType, correlationId, DateTime.UtcNow.Add(delay));
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        var detailType = EventDetailTypeMapper.GetDetailType(typeof(T));
        int generation;

        lock (_lock)
        {
            if (!_handlers.TryGetValue(queueName, out var handlers))
            {
                handlers = new Dictionary<string, (Type, Func<object, Guid, Task>)>();
                _handlers[queueName] = handlers;
            }

            if (handlers.ContainsKey(detailType))
            {
                _logger.LogWarning(
                    "Consumer for queue {QueueName} and event type {EventType} ({DetailType}) is already running",
                    queueName, typeof(T).Name, detailType);
                return;
            }

            handlers[detailType] = (typeof(T), (obj, corrId) => handler((T)obj, corrId));
            if (_subscribers.ContainsKey(queueName))
            {
                _logger.LogInformation(
                    "Registered handler for queue {QueueName} and event type {EventType} ({DetailType})",
                    queueName, typeof(T).Name, detailType);
                return;
            }

            generation = _startGeneration.GetValueOrDefault(queueName) + 1;
            _startGeneration[queueName] = generation;
        }

        _logger.LogInformation(
            "Registered handler for queue {QueueName} and event type {EventType} ({DetailType})",
            queueName, typeof(T).Name, detailType);
        _ = StartSubscriberAfterRegistrationsAsync(queueName, generation);
    }

    private async Task StartSubscriberAfterRegistrationsAsync(string queueName, int generation)
    {
        // Startup registers several handlers on one queue before app.Run. Wait until that burst finishes.
        await Task.Delay(TimeSpan.FromSeconds(1));

        lock (_lock)
        {
            if (_disposed || _subscribers.ContainsKey(queueName) || _startGeneration.GetValueOrDefault(queueName) != generation)
            {
                return;
            }
        }

        EnsureTopic();
        EnsureSubscription(queueName);

        var subscriptionName = SubscriptionName.FromProjectSubscription(_options.ProjectId, SubscriptionId(queueName));
        var subscriber = SubscriberClient.Create(subscriptionName);
        var startTask = subscriber.StartAsync((message, _) => HandleMessageAsync(queueName, message));
        _ = startTask.ContinueWith(
            completed => _logger.LogError(completed.Exception, "Subscriber for queue {QueueName} stopped", queueName),
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted,
            TaskScheduler.Default);

        lock (_lock)
        {
            if (_disposed || _startGeneration.GetValueOrDefault(queueName) != generation)
            {
                subscriber.StopAsync(CancellationToken.None);
                return;
            }

            _subscribers[queueName] = subscriber;
        }

        _logger.LogInformation("Started consuming from subscription {Subscription} for queue {QueueName}", subscriptionName, queueName);
    }

    public void StopConsuming()
    {
        List<SubscriberClient> subscribers;
        lock (_lock)
        {
            subscribers = _subscribers.Values.ToList();
            _subscribers.Clear();
            _handlers.Clear();
            _startGeneration.Clear();
        }

        foreach (var subscriber in subscribers)
        {
            try
            {
                subscriber.StopAsync(CancellationToken.None).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to stop a Pub/Sub subscriber");
            }
        }

        _logger.LogInformation("Stopped all consumers");
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        StopConsuming();
    }

    private async Task ScheduleAtAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTimeUtc) where T : class
    {
        if (scheduledTimeUtc <= DateTime.UtcNow)
        {
            await PublishAsync(eventData, source, detailType, correlationId);
            return;
        }

        var delay = scheduledTimeUtc - DateTime.UtcNow;
        if (delay > MaxScheduleDelay)
        {
            throw new InvalidOperationException(
                $"Cloud Tasks can schedule at most {MaxScheduleDelay.TotalDays:0} days ahead. DetailType: {detailType}, CorrelationId: {correlationId}, ScheduledTime: {scheduledTimeUtc:o}.");
        }

        if (string.IsNullOrWhiteSpace(_options.ServiceAccountEmail))
        {
            throw new InvalidOperationException(
                "EventBus:GCP:ServiceAccountEmail is required to schedule delayed events with Cloud Tasks.");
        }

        try
        {
            EnsureTopic();
            EnsureTasksQueue();

            var json = JsonSerializer.Serialize(eventData, JsonOptions);
            var publishBody = JsonSerializer.Serialize(new
            {
                messages = new[]
                {
                    new
                    {
                        data = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(json)),
                        attributes = new Dictionary<string, string>
                        {
                            ["EventType"] = typeof(T).Name,
                            ["Source"] = source,
                            ["DetailType"] = detailType,
                            ["CorrelationId"] = correlationId.ToString()
                        }
                    }
                }
            });

            var taskId = SanitizeTaskId($"{_options.ServicePrefix}-{detailType}-{correlationId:N}");
            var queueName = QueueName.FromProjectLocationQueue(_options.ProjectId, _options.SchedulerLocation, QueueId);
            var task = new Google.Cloud.Tasks.V2.Task
            {
                Name = TaskName.FromProjectLocationQueueTask(_options.ProjectId, _options.SchedulerLocation, QueueId, taskId).ToString(),
                ScheduleTime = Google.Protobuf.WellKnownTypes.Timestamp.FromDateTime(DateTime.SpecifyKind(scheduledTimeUtc, DateTimeKind.Utc)),
                HttpRequest = new HttpRequest
                {
                    HttpMethod = Google.Cloud.Tasks.V2.HttpMethod.Post,
                    Url = $"https://pubsub.googleapis.com/v1/{TopicName}:publish",
                    Body = ByteString.CopyFromUtf8(publishBody),
                    OauthToken = new OAuthToken
                    {
                        ServiceAccountEmail = _options.ServiceAccountEmail,
                        Scope = PubSubScope
                    }
                }
            };
            task.HttpRequest.Headers["Content-Type"] = "application/json";

            try
            {
                await _tasksClient.CreateTaskAsync(queueName, task);
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
            {
                _logger.LogInformation(
                    "Delayed event {EventType} is already scheduled. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    typeof(T).Name, taskId, correlationId);
                return;
            }

            _logger.LogInformation(
                "Scheduled event {EventType} via Cloud Tasks. Queue: {Queue}, TaskId: {TaskId}, ScheduledTime: {ScheduledTime}, CorrelationId: {CorrelationId}",
                typeof(T).Name, queueName, taskId, scheduledTimeUtc, correlationId);
        }
        catch (Exception ex) when (ex is not InvalidOperationException)
        {
            _logger.LogError(ex, "Failed to schedule event {EventType} via Cloud Tasks. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
    }

    private async Task<SubscriberClient.Reply> HandleMessageAsync(string queueName, PubsubMessage message)
    {
        try
        {
            Dictionary<string, (Type EventType, Func<object, Guid, Task> Handler)> handlers;
            lock (_lock)
            {
                if (!_handlers.TryGetValue(queueName, out var registered) || registered.Count == 0)
                {
                    _logger.LogWarning("No handlers registered for queue {QueueName}", queueName);
                    return SubscriberClient.Reply.Ack;
                }

                handlers = new Dictionary<string, (Type, Func<object, Guid, Task>)>(registered);
            }

            var json = message.Data.ToStringUtf8();
            message.Attributes.TryGetValue("DetailType", out var detailType);
            message.Attributes.TryGetValue("CorrelationId", out var correlationHeader);

            if (!string.IsNullOrEmpty(detailType))
            {
                if (!handlers.TryGetValue(detailType, out var match))
                {
                    _logger.LogDebug(
                        "No handler for detail-type {DetailType} on queue {QueueName}. MessageId: {MessageId}",
                        detailType, queueName, message.MessageId);
                    return SubscriberClient.Reply.Ack;
                }

                var eventData = JsonSerializer.Deserialize(json, match.EventType, JsonOptions);
                if (eventData == null)
                {
                    _logger.LogWarning(
                        "Failed to deserialize {DetailType} from queue {QueueName}. MessageId: {MessageId}",
                        detailType, queueName, message.MessageId);
                    return SubscriberClient.Reply.Ack;
                }

                await match.Handler(eventData, ResolveCorrelationId(correlationHeader, eventData, match.EventType));
                _logger.LogDebug(
                    "Processed message {MessageId} from queue {QueueName} for detail-type {DetailType}",
                    message.MessageId, queueName, detailType);
                return SubscriberClient.Reply.Ack;
            }

            foreach (var (eventType, handler) in handlers.Values)
            {
                try
                {
                    var inferred = JsonSerializer.Deserialize(json, eventType, JsonOptions);
                    if (inferred == null)
                    {
                        continue;
                    }

                    await handler(inferred, ResolveCorrelationId(correlationHeader, inferred, eventType));
                    return SubscriberClient.Reply.Ack;
                }
                catch (JsonException)
                {
                    // Try the next registered event type.
                }
            }

            _logger.LogDebug(
                "No handler for detail-type {DetailType} on queue {QueueName}. MessageId: {MessageId}",
                detailType, queueName, message.MessageId);
            return SubscriberClient.Reply.Ack;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing message {MessageId} from queue {QueueName}", message.MessageId, queueName);
            return SubscriberClient.Reply.Nack;
        }
    }

    private void EnsureTopic()
    {
        if (_topicReady)
        {
            return;
        }

        lock (_topicLock)
        {
            if (_topicReady)
            {
                return;
            }

            RequireProjectId();
            try
            {
                _publisherClient.CreateTopic(TopicName);
                _logger.LogInformation("Created Pub/Sub topic {Topic}", TopicId);
            }
            catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
            {
            }

            _topicReady = true;
        }
    }

    private void EnsureSubscription(string queueName)
    {
        RequireProjectId();
        var subscriptionId = SubscriptionId(queueName);
        var subscriptionName = SubscriptionName.FromProjectSubscription(_options.ProjectId, subscriptionId);
        var deadLetterTopic = EnsureDeadLetterTopic();

        var subscription = new Subscription
        {
            SubscriptionName = subscriptionName,
            TopicAsTopicName = TopicName,
            AckDeadlineSeconds = _options.AckDeadlineSeconds
        };

        if (deadLetterTopic != null)
        {
            subscription.DeadLetterPolicy = new DeadLetterPolicy
            {
                DeadLetterTopic = deadLetterTopic.ToString(),
                MaxDeliveryAttempts = DeliveryAttempts()
            };
        }

        try
        {
            _subscriberClient.CreateSubscription(subscription);
            _logger.LogInformation("Created subscription {Subscription} on topic {Topic}", subscriptionId, TopicId);
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
        {
            var existing = _subscriberClient.GetSubscription(subscriptionName);
            if (!string.Equals(existing.Topic, TopicName.ToString(), StringComparison.Ordinal))
            {
                _logger.LogError(
                    "Subscription {Subscription} is bound to {ActualTopic}. Events are published to {ExpectedTopic}. Delete that subscription so it can be recreated.",
                    subscriptionId, existing.Topic, TopicName);
            }
        }
        catch (RpcException ex) when (deadLetterTopic != null &&
                                      (ex.StatusCode == StatusCode.FailedPrecondition || ex.StatusCode == StatusCode.PermissionDenied || ex.StatusCode == StatusCode.InvalidArgument))
        {
            _logger.LogWarning(ex, "Creating subscription {Subscription} with a dead-letter topic failed. Retrying without it.", subscriptionId);
            subscription.DeadLetterPolicy = null;
            try
            {
                _subscriberClient.CreateSubscription(subscription);
            }
            catch (RpcException retry) when (retry.StatusCode == StatusCode.AlreadyExists)
            {
            }
        }
    }

    private TopicName? EnsureDeadLetterTopic()
    {
        var deadLetterName = TopicName.FromProjectTopic(_options.ProjectId, $"{_options.ServicePrefix}-dlq");
        try
        {
            _publisherClient.CreateTopic(deadLetterName);
            _logger.LogInformation("Created dead-letter topic {Topic}", deadLetterName.TopicId);
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
        {
        }
        catch (RpcException ex)
        {
            _logger.LogWarning(ex, "Could not create dead-letter topic {Topic}", deadLetterName.TopicId);
            return null;
        }

        return deadLetterName;
    }

    private void EnsureTasksQueue()
    {
        RequireProjectId();
        var queueName = QueueName.FromProjectLocationQueue(_options.ProjectId, _options.SchedulerLocation, QueueId);
        try
        {
            _tasksClient.GetQueue(queueName);
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
        {
            var parent = LocationName.FromProjectLocation(_options.ProjectId, _options.SchedulerLocation);
            _tasksClient.CreateQueue(parent, new Queue { Name = queueName.ToString() });
            _logger.LogInformation("Created Cloud Tasks queue {Queue}", queueName);
        }
    }

    private static PubsubMessage BuildMessage(string json, string eventType, string source, string detailType, Guid correlationId)
    {
        return new PubsubMessage
        {
            Data = ByteString.CopyFromUtf8(json),
            Attributes =
            {
                { "EventType", eventType },
                { "Source", source },
                { "DetailType", detailType },
                { "CorrelationId", correlationId.ToString() }
            }
        };
    }

    private static Guid ResolveCorrelationId(string? header, object eventData, Type eventType)
    {
        if (!string.IsNullOrEmpty(header) && Guid.TryParse(header, out var fromHeader))
        {
            return fromHeader;
        }

        var property = eventType.GetProperty("CorrelationId");
        if (property?.PropertyType == typeof(Guid) && property.GetValue(eventData) is Guid fromEvent && fromEvent != Guid.Empty)
        {
            return fromEvent;
        }

        return Guid.NewGuid();
    }

    private static DateTime AsUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }

    private static string SanitizeTaskId(string taskId)
    {
        var chars = taskId.Select(ch => char.IsLetterOrDigit(ch) || ch is '_' or '-' ? ch : '-').ToArray();
        var sanitized = new string(chars);
        return sanitized.Length <= 500 ? sanitized : sanitized[..500];
    }

    private int DeliveryAttempts()
    {
        var attempts = _options.MaxDeliveryAttempts;
        if (attempts < PubSubMinDeliveryAttempts)
        {
            return PubSubMinDeliveryAttempts;
        }

        return attempts > PubSubMaxDeliveryAttempts ? PubSubMaxDeliveryAttempts : attempts;
    }

    private string SubscriptionId(string queueName) => $"{_options.ServicePrefix}-{queueName}";

    private string QueueId =>
        string.IsNullOrWhiteSpace(_options.TasksQueueId)
            ? $"{_options.ServicePrefix}-schedules"
            : _options.TasksQueueId;

    private string TopicId => _options.ServicePrefix;

    private TopicName TopicName => TopicName.FromProjectTopic(_options.ProjectId, TopicId);

    private void RequireProjectId()
    {
        if (string.IsNullOrWhiteSpace(_options.ProjectId))
        {
            throw new InvalidOperationException("EventBus:GCP:ProjectId is required.");
        }
    }
}
