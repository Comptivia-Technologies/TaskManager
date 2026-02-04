namespace Shared.Messaging;

/// <summary>
/// Factory interface for creating event bus instances based on provider configuration
/// </summary>
public interface IEventBusFactory
{
    /// <summary>
    /// Creates an event bus instance based on configured provider
    /// </summary>
    IEventBus CreateEventBus();
}
