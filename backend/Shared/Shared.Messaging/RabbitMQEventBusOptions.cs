namespace Shared.Messaging;

public sealed class RabbitMQEventBusOptions
{
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";

    /// <summary>
    /// Prefix used to namespace queues/exchange per environment (matches AWS ServicePrefix behavior).
    /// </summary>
    public string ServicePrefix { get; set; } = "task-manager-local";

    /// <summary>
    /// Exchange used to route events. Declared as an x-delayed-message exchange.
    /// </summary>
    public string ExchangeName { get; set; } = "task-manager-events";

    public ushort PrefetchCount { get; set; } = 10;
}

