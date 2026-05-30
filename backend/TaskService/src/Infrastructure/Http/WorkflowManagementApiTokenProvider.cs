using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace TaskService.Infrastructure.Http;

public class WorkflowManagementApiTokenProvider : IWorkflowManagementApiTokenProvider
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly WorkflowManagementApiOptions _options;
    private readonly ILogger<WorkflowManagementApiTokenProvider> _logger;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private string? _cachedToken;
    private DateTime _expiresAtUtc = DateTime.MinValue;

    public WorkflowManagementApiTokenProvider(
        IHttpClientFactory httpClientFactory,
        IOptions<WorkflowManagementApiOptions> options,
        ILogger<WorkflowManagementApiTokenProvider> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async Task<string> GetTokenAsync(CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _expiresAtUtc.AddMinutes(-1))
        {
            return _cachedToken;
        }

        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (!string.IsNullOrEmpty(_cachedToken) && DateTime.UtcNow < _expiresAtUtc.AddMinutes(-1))
            {
                return _cachedToken;
            }

            return await LoginAsync(cancellationToken);
        }
        finally
        {
            _lock.Release();
        }
    }

    public Task InvalidateAsync()
    {
        _cachedToken = null;
        _expiresAtUtc = DateTime.MinValue;
        return Task.CompletedTask;
    }

    private async Task<string> LoginAsync(CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            throw new InvalidOperationException("WorkflowManagementApi:BaseUrl is not configured.");
        }

        if (string.IsNullOrWhiteSpace(_options.ServiceEmail) || string.IsNullOrWhiteSpace(_options.ServicePassword))
        {
            throw new InvalidOperationException("WorkflowManagementApi service credentials are not configured.");
        }

        var loginUrl = $"{_options.BaseUrl.TrimEnd('/')}/auth/login";
        var client = _httpClientFactory.CreateClient();

        _logger.LogInformation("Authenticating TaskService with WorkflowManagement.API at {LoginUrl}", loginUrl);

        var response = await client.PostAsJsonAsync(
            loginUrl,
            new { email = _options.ServiceEmail, password = _options.ServicePassword },
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            _logger.LogError(
                "WorkflowManagement.API login failed. Status: {StatusCode}, Response: {Response}",
                response.StatusCode,
                body);
            throw new InvalidOperationException($"WorkflowManagement.API login failed with status {response.StatusCode}.");
        }

        var loginResponse = await response.Content.ReadFromJsonAsync<LoginResponse>(cancellationToken: cancellationToken)
            ?? throw new InvalidOperationException("WorkflowManagement.API login returned an empty response.");

        if (string.IsNullOrWhiteSpace(loginResponse.Token))
        {
            throw new InvalidOperationException("WorkflowManagement.API login returned an empty token.");
        }

        _cachedToken = loginResponse.Token;
        _expiresAtUtc = loginResponse.ExpiresAt.Kind == DateTimeKind.Utc
            ? loginResponse.ExpiresAt
            : loginResponse.ExpiresAt.ToUniversalTime();

        _logger.LogInformation("TaskService authenticated with WorkflowManagement.API. Token expires at {ExpiresAtUtc}", _expiresAtUtc);

        return _cachedToken;
    }

    private sealed class LoginResponse
    {
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
    }
}
