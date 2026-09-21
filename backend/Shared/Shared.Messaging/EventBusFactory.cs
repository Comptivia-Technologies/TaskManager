using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Shared.Messaging;

/// <summary>
/// Factory implementation for creating event bus instances based on provider configuration
/// </summary>
public class EventBusFactory : IEventBusFactory
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EventBusFactory> _logger;

    public EventBusFactory(
        IConfiguration configuration,
        IServiceProvider serviceProvider,
        ILogger<EventBusFactory> logger)
    {
        _configuration = configuration;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public IEventBus CreateEventBus()
    {
        var provider = Environment.GetEnvironmentVariable("EVENTBUS_PROVIDER")
            ?? _configuration["EventBus:Provider"]
            ?? "AWS";
        
        _logger.LogInformation("Creating EventBus with provider: {Provider}", provider);

        return provider.ToUpperInvariant() switch
        {
            "AWS" => _serviceProvider.GetRequiredService<AwsEventBus>(),
            "AZURE" => _serviceProvider.GetRequiredService<AzureEventBus>(),
            "GCP" => _serviceProvider.GetRequiredService<GcpEventBus>(),
            "RABBITMQ" => _serviceProvider.GetRequiredService<RabbitMQEventBus>(),
            _ => throw new NotSupportedException($"Event bus provider '{provider}' is not supported. Supported providers: AWS, Azure, GCP, RabbitMQ")
        };
    }
}
