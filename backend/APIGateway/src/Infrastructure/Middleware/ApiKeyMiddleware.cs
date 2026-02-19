using System.Text.Json;

namespace APIGateway.Infrastructure.Middleware;

public class ApiKeyMiddleware
{
    private readonly RequestDelegate _next;
    private const string ApiKeyHeaderName = "X-API-Key";

    public ApiKeyMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, IConfiguration configuration)
    {
        // Get excluded paths from configuration
        var excludedPaths = configuration.GetSection("ApiKeys:ExcludedPaths").Get<string[]>() 
            ?? new[] { "/health", "/api/auth" };

        var path = context.Request.Path.Value?.ToLower() ?? "";

        // Skip API key validation for excluded paths
        if (excludedPaths.Any(excluded => path.StartsWith(excluded.ToLower())))
        {
            await _next(context);
            return;
        }

        // Check for API key header
        if (!context.Request.Headers.TryGetValue(ApiKeyHeaderName, out var extractedApiKey))
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            var errorResponse = JsonSerializer.Serialize(new { error = "API Key is required. Please provide X-API-Key header." });
            await context.Response.WriteAsync(errorResponse);
            return;
        }

        // Validate API key
        var validApiKeys = configuration.GetSection("ApiKeys:ValidKeys").Get<string[]>() 
            ?? Array.Empty<string>();

        if (!validApiKeys.Contains(extractedApiKey.ToString()))
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            var errorResponse = JsonSerializer.Serialize(new { error = "Invalid API Key." });
            await context.Response.WriteAsync(errorResponse);
            return;
        }

        // API key is valid, continue to next middleware
        await _next(context);
    }
}
