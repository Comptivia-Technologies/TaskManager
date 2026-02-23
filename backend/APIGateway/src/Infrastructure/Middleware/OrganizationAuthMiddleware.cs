using Microsoft.AspNetCore.Http;

namespace APIGateway.Infrastructure.Middleware;

/// <summary>
/// Runs after JWT authentication. For non-excluded paths, requires authentication
/// and sets OrganizationId from token claims into HttpContext.Items for downstream use.
/// </summary>
public class OrganizationAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly string[] _excludedPathPrefixes;

    public const string OrganizationIdItemKey = "OrganizationId";

    public OrganizationAuthMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _excludedPathPrefixes = configuration.GetSection("Auth:ExcludedPathPrefixes").Get<string[]>()
            ?? new[] { "/health", "/api/auth", "/swagger" };
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        if (_excludedPathPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(context);
            return;
        }

        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            context.Response.StatusCode = 401;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "Unauthorized. Valid Bearer token required." });
            return;
        }

        var orgIdClaim = context.User.FindFirst("organizationId")?.Value;

        if (!string.IsNullOrEmpty(orgIdClaim))
            context.Items[OrganizationIdItemKey] = orgIdClaim;

        await _next(context);
    }
}
