namespace Shared.Messaging;

public class RabbitMQEventBusOptions : EventBusOptions
{
    public string HostName { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public string ExchangeName { get; set; } = "task-manager";
    public int MaxReceiveCount { get; set; } = 3;

    public RabbitMQEventBusOptions()
    {
        Provider = EventBusProvider.RabbitMQ;
    }
}
