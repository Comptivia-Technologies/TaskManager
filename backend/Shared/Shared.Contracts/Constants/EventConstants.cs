namespace Shared.Contracts.Constants;

/// <summary>
/// Event-related constants
/// </summary>
public static class EventConstants
{
    public const int MaxRetryAttempts = 3;
    public const int RetryDelaySeconds = 5;
    public const string CorrelationIdHeader = "X-Correlation-Id";
}

