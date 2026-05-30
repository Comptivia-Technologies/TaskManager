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
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";

        _logger.LogInformation(
            "Creating EventBus with provider: {Provider} (Environment: {Environment})",
            provider,
            environment);

        return provider.ToUpperInvariant() switch
        {
            "AWS" => _serviceProvider.GetRequiredService<AwsEventBus>(),
            "RABBITMQ" => _serviceProvider.GetRequiredService<RabbitMQEventBus>(),
            "AZURE" => _serviceProvider.GetRequiredService<AzureEventBus>(),
            "GCP" => _serviceProvider.GetRequiredService<GcpEventBus>(),
            _ => throw new NotSupportedException($"Event bus provider '{provider}' is not supported. Supported providers: AWS, RabbitMQ, Azure, GCP")
        };
    }
}
