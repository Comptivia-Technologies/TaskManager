using Amazon.EventBridge;
using Amazon.EventBridge.Model;
using Amazon.SQS;
using Amazon.SQS.Model;
using Amazon.Scheduler;
using Amazon.Scheduler.Model;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Shared.Messaging;

public class AwsEventBus : IEventBus, IDisposable
{
    private readonly AwsEventBusOptions _options;
    private readonly ILogger<AwsEventBus> _logger;
    private readonly IAmazonEventBridge _eventBridge;
    private readonly IAmazonSQS _sqs;
    private readonly IAmazonScheduler _scheduler;
    private readonly Dictionary<string, CancellationTokenSource> _consumers = new();
    private readonly object _lock = new object();
    private string? _accountId;

    public AwsEventBus(IOptions<AwsEventBusOptions> options, ILogger<AwsEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        var awsConfig = new AmazonEventBridgeConfig { RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(_options.Region) };
        var sqsConfig = new AmazonSQSConfig { RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(_options.Region) };
        var schedulerConfig = new AmazonSchedulerConfig { RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(_options.Region) };

        // Use IAM role if credentials are not provided
        if (string.IsNullOrEmpty(_options.AccessKeyId))
        {
            _logger.LogInformation("Using IAM role for AWS credentials (no explicit AccessKeyId provided)");
            _eventBridge = new AmazonEventBridgeClient(awsConfig);
            _sqs = new AmazonSQSClient(sqsConfig);
            _scheduler = new AmazonSchedulerClient(schedulerConfig);
        }
        else
        {
            _logger.LogInformation("Using explicit AWS credentials from configuration");
            _eventBridge = new AmazonEventBridgeClient(_options.AccessKeyId, _options.SecretAccessKey, _options.SessionToken, awsConfig);
            _sqs = new AmazonSQSClient(_options.AccessKeyId, _options.SecretAccessKey, _options.SessionToken, sqsConfig);
            _scheduler = new AmazonSchedulerClient(_options.AccessKeyId, _options.SecretAccessKey, _options.SessionToken, schedulerConfig);
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

            var putEventsRequest = new PutEventsRequest
            {
                Entries = new List<PutEventsRequestEntry>
                {
                    new PutEventsRequestEntry
                    {
                        Source = source,
                        DetailType = detailType,
                        Detail = json,
                        EventBusName = _options.EventBusName,
                        Time = DateTime.UtcNow
                    }
                }
            };

            // Add correlation ID as trace header
            putEventsRequest.Entries[0].TraceHeader = correlationId.ToString();

            var response = await _eventBridge.PutEventsAsync(putEventsRequest);

            if (response.FailedEntryCount > 0)
            {
                var error = response.Entries[0].ErrorMessage;
                _logger.LogError("Failed to publish event {EventType} to EventBridge. Error: {Error}", typeof(T).Name, error);
                throw new Exception($"EventBridge publish failed: {error}");
            }

            _logger.LogInformation(
                "Published event {EventType} to EventBridge. Source: {Source}, DetailType: {DetailType}, CorrelationId: {CorrelationId}",
                typeof(T).Name, source, detailType, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish event {EventType} to EventBridge. CorrelationId: {CorrelationId}",
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

        // Use the TimeSpan overload but with the exact scheduled time
        await ScheduleAsync(eventData, source, detailType, correlationId, delay, scheduledTime);
    }
    
    private async Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay, DateTime? exactScheduledTime = null) where T : class
    {
        try
        {
            if (delay <= TimeSpan.Zero)
            {
                await PublishAsync(eventData, source, detailType, correlationId);
                return;
            }

            var scheduledTime = exactScheduledTime ?? DateTime.UtcNow.Add(delay);
            var json = JsonSerializer.Serialize(eventData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            // Create schedule name (must be unique, max 64 chars)
            var scheduleName = $"{_options.ServicePrefix}-{detailType.ToLower().Replace(".", "-")}-{correlationId:N}";
            if (scheduleName.Length > 64)
            {
                scheduleName = scheduleName.Substring(0, 64);
            }
            
            // Ensure scheduler group exists
            await EnsureSchedulerGroupExistsAsync();

            // Get account ID for ARN construction
            var accountId = await GetAccountIdAsync();
            
            // Target: Publish to EventBridge
            var target = new Amazon.Scheduler.Model.Target
            {
                Arn = $"arn:aws:events:{_options.Region}:{accountId}:event-bus/{_options.EventBusName}",
                RoleArn = _options.SchedulerRoleArn ?? throw new InvalidOperationException("SchedulerRoleArn must be configured in AwsEventBusOptions"),
                EventBridgeParameters = new EventBridgeParameters
                {
                    DetailType = detailType,
                    Source = source
                },
                Input = json
            };

            var createScheduleRequest = new CreateScheduleRequest
            {
                Name = scheduleName,
                GroupName = _options.SchedulerGroupName,
                ScheduleExpression = $"at({scheduledTime:yyyy-MM-ddTHH:mm:ss}Z)",
                Target = target,
                FlexibleTimeWindow = new FlexibleTimeWindow { Mode = FlexibleTimeWindowMode.OFF },
                Description = $"Scheduled event: {detailType} for correlation {correlationId}"
            };

            await _scheduler.CreateScheduleAsync(createScheduleRequest);

            _logger.LogInformation(
                "Scheduled event {EventType} via EventBridge Scheduler. ScheduleName: {ScheduleName}, ScheduledTime: {ScheduledTime}, CorrelationId: {CorrelationId}",
                typeof(T).Name, scheduleName, scheduledTime, correlationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to schedule event {EventType} via EventBridge Scheduler. CorrelationId: {CorrelationId}",
                typeof(T).Name, correlationId);
            throw;
        }
    }

    public async Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay) where T : class
    {
        await ScheduleAsync(eventData, source, detailType, correlationId, delay, null);
    }

    public void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler) where T : class
    {
        lock (_lock)
        {
            if (_consumers.ContainsKey(queueName))
            {
                _logger.LogWarning("Consumer for queue {QueueName} is already running", queueName);
                return;
            }

            var cts = new CancellationTokenSource();
            _consumers[queueName] = cts;

            _ = Task.Run(async () => await ConsumeMessagesAsync<T>(queueName, handler, cts.Token), cts.Token);

            _logger.LogInformation("Started consuming from queue {QueueName} for event type {EventType}", queueName, typeof(T).Name);
        }
    }

    private async Task ConsumeMessagesAsync<T>(string queueName, Func<T, Guid, Task> handler, CancellationToken cancellationToken) where T : class
    {
        var queueUrl = await GetOrCreateQueueUrlAsync(queueName);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var receiveRequest = new ReceiveMessageRequest
                {
                    QueueUrl = queueUrl,
                    MaxNumberOfMessages = 10,
                    WaitTimeSeconds = 20, // Long polling
                    MessageAttributeNames = new List<string> { "All" },
                    MessageSystemAttributeNames = new List<string> { "All" }
                };

                var response = await _sqs.ReceiveMessageAsync(receiveRequest, cancellationToken);

                foreach (var message in response.Messages)
                {
                    try
                    {
                        // Extract correlation ID from message attributes or trace header
                        var correlationId = Guid.NewGuid();
                        if (message.MessageAttributes.TryGetValue("CorrelationId", out var attr))
                        {
                            correlationId = Guid.Parse(attr.StringValue);
                        }
                        else if (message.Attributes.TryGetValue("CorrelationId", out var attrValue))
                        {
                            correlationId = Guid.Parse(attrValue);
                        }

                        // Parse event from message body
                        // EventBridge sends full event envelope when routing directly to SQS
                        // Format: { "version": "0", "detail-type": "...", "source": "...", "detail": {...} }
                        string? detailJson = null;

                        // First, try to parse as full EventBridge event format (detail is an object)
                        if (message.Body.StartsWith("{") && message.Body.Contains("\"detail\""))
                        {
                            try
                            {
                                using var doc = JsonDocument.Parse(message.Body);
                                var root = doc.RootElement;
                                
                                if (root.TryGetProperty("detail", out var detailElement))
                                {
                                    // Extract detail object and serialize it back to JSON string
                                    detailJson = detailElement.GetRawText();
                                    
                                    // Extract correlation ID from trace-header if available
                                    if (root.TryGetProperty("trace-header", out var traceHeader))
                                    {
                                        var traceHeaderValue = traceHeader.GetString();
                                        if (!string.IsNullOrEmpty(traceHeaderValue) && Guid.TryParse(traceHeaderValue, out var traceCorrelationId))
                                        {
                                            correlationId = traceCorrelationId;
                                        }
                                    }
                                }
                            }
                            catch (JsonException)
                            {
                                // Fall through to other parsing methods
                            }
                        }

                        // If not parsed yet, try EventBridgeEventDetail format (detail as string - SNS format)
                        if (string.IsNullOrEmpty(detailJson))
                        {
                            try
                            {
                                var eventBridgeEvent = JsonSerializer.Deserialize<EventBridgeEventDetail>(message.Body, new JsonSerializerOptions
                                {
                                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                                });
                                
                                if (eventBridgeEvent?.Detail != null)
                                {
                                    detailJson = eventBridgeEvent.Detail;
                                }
                            }
                            catch (JsonException)
                            {
                                // Fall through
                            }
                        }

                        // Last resort: assume message body is the event directly
                        if (string.IsNullOrEmpty(detailJson))
                        {
                            detailJson = message.Body;
                        }

                        if (string.IsNullOrEmpty(detailJson))
                        {
                            _logger.LogWarning("Received message with null detail from queue {QueueName}. MessageId: {MessageId}", queueName, message.MessageId);
                            await _sqs.DeleteMessageAsync(queueUrl, message.ReceiptHandle, cancellationToken);
                            continue;
                        }

                        var eventData = JsonSerializer.Deserialize<T>(detailJson, new JsonSerializerOptions
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });

                        if (eventData == null)
                        {
                            _logger.LogWarning("Failed to deserialize event data from queue {QueueName}. MessageId: {MessageId}", queueName, message.MessageId);
                            await _sqs.DeleteMessageAsync(queueUrl, message.ReceiptHandle, cancellationToken);
                            continue;
                        }

                        await handler(eventData, correlationId);

                        await _sqs.DeleteMessageAsync(queueUrl, message.ReceiptHandle, cancellationToken);

                        _logger.LogDebug("Processed message {MessageId} from queue {QueueName}", message.MessageId, queueName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing message {MessageId} from queue {QueueName}", message.MessageId, queueName);
                        // Message will become visible again after visibility timeout
                        // After MaxReceiveCount, it will go to DLQ
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving messages from queue {QueueName}", queueName);
                await Task.Delay(5000, cancellationToken); // Wait before retry
            }
        }
    }

    public void StopConsuming()
    {
        lock (_lock)
        {
            foreach (var consumer in _consumers)
            {
                consumer.Value.Cancel();
            }
            _consumers.Clear();
            _logger.LogInformation("Stopped all consumers");
        }
    }

    private async Task<string> GetOrCreateQueueUrlAsync(string queueName)
    {
        var fullQueueName = $"{_options.ServicePrefix}-{queueName}";
        
        try
        {
            var response = await _sqs.GetQueueUrlAsync(fullQueueName);
            return response.QueueUrl;
        }
        catch (QueueDoesNotExistException)
        {
            // Create queue with DLQ
            var dlqName = $"{fullQueueName}-dlq";
            var dlqRequest = new CreateQueueRequest
            {
                QueueName = dlqName
            };
            var dlqResponse = await _sqs.CreateQueueAsync(dlqRequest);
            var dlqArn = await GetQueueArnAsync(dlqResponse.QueueUrl);

            var queueRequest = new CreateQueueRequest
            {
                QueueName = fullQueueName,
                Attributes = new Dictionary<string, string>
                {
                    { "VisibilityTimeout", _options.VisibilityTimeoutSeconds.ToString() },
                    { "MessageRetentionPeriod", "1209600" }, // 14 days
                    { "RedrivePolicy", $"{{\"deadLetterTargetArn\":\"{dlqArn}\",\"maxReceiveCount\":{_options.MaxReceiveCount}}}" }
                }
            };

            var queueResponse = await _sqs.CreateQueueAsync(queueRequest);
            var queueUrl = queueResponse.QueueUrl;

            _logger.LogInformation("Created SQS queue {QueueName} with DLQ {DlqName}", fullQueueName, dlqName);

            return queueUrl;
        }
    }

    private async Task<string> GetQueueArnAsync(string queueUrl)
    {
        var attributes = await _sqs.GetQueueAttributesAsync(queueUrl, new List<string> { "QueueArn" });
        return attributes.QueueARN;
    }

    private async Task<string> GetAccountIdAsync()
    {
        if (_accountId != null)
            return _accountId;

        try
        {
            // Try to get account ID from STS
            Amazon.SecurityToken.IAmazonSecurityTokenService stsClient;
            if (string.IsNullOrEmpty(_options.AccessKeyId))
            {
                // Use IAM role
                stsClient = new Amazon.SecurityToken.AmazonSecurityTokenServiceClient(
                    new Amazon.SecurityToken.AmazonSecurityTokenServiceConfig 
                    { 
                        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(_options.Region) 
                    });
            }
            else
            {
                // Use explicit credentials
                stsClient = new Amazon.SecurityToken.AmazonSecurityTokenServiceClient(
                    _options.AccessKeyId, _options.SecretAccessKey, _options.SessionToken,
                    new Amazon.SecurityToken.AmazonSecurityTokenServiceConfig 
                    { 
                        RegionEndpoint = Amazon.RegionEndpoint.GetBySystemName(_options.Region) 
                    });
            }
            
            var identity = await stsClient.GetCallerIdentityAsync(new Amazon.SecurityToken.Model.GetCallerIdentityRequest());
            _accountId = identity.Account;
            return _accountId;
        }
        catch
        {
            // Fallback: extract from access key or use placeholder
            // In production, this should be configured
            _logger.LogWarning("Could not determine AWS account ID. Using placeholder. Configure AccountId in options for production.");
            _accountId = "000000000000";
            return _accountId;
        }
    }

    private async Task EnsureSchedulerGroupExistsAsync()
    {
        try
        {
            await _scheduler.GetScheduleGroupAsync(new GetScheduleGroupRequest
            {
                Name = _options.SchedulerGroupName
            });
        }
        catch (Amazon.Scheduler.Model.ResourceNotFoundException)
        {
            await _scheduler.CreateScheduleGroupAsync(new CreateScheduleGroupRequest
            {
                Name = _options.SchedulerGroupName
            });
            _logger.LogInformation("Created EventBridge Scheduler group {GroupName}", _options.SchedulerGroupName);
        }
    }

    public void Dispose()
    {
        StopConsuming();
        _eventBridge?.Dispose();
        _sqs?.Dispose();
        _scheduler?.Dispose();
    }

    private class EventBridgeEventDetail
    {
        public string? Detail { get; set; }
    }

    private class EventBridgeFullEvent
    {
        public JsonElement? Detail { get; set; }
    }
}
