using System.Text.Json;
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
    public const string TenantIdItemKey = "TenantId";

    public OrganizationAuthMiddleware(RequestDelegate next, IConfiguration configuration)
    {
        _next = next;
        _excludedPathPrefixes = configuration.GetSection("Auth:ExcludedPathPrefixes").Get<string[]>()
            ?? new[] { "/health", "/api/auth/tenant", "/api/roles/all", "/swagger" };
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

        var tenantIdClaim = context.User.FindFirst("tenant_id")?.Value
            ?? context.User.FindFirst("firebase.tenant")?.Value;
        if (string.IsNullOrEmpty(tenantIdClaim))
        {
            var firebaseClaim = context.User.FindFirst("firebase")?.Value;
            if (!string.IsNullOrEmpty(firebaseClaim))
            {
                try
                {
                    using var doc = JsonDocument.Parse(firebaseClaim);
                    if (doc.RootElement.TryGetProperty("tenant", out var tenantProp))
                        tenantIdClaim = tenantProp.GetString();
                }
                catch { /* ignore */ }
            }
        }
        if (!string.IsNullOrEmpty(tenantIdClaim))
            context.Items[TenantIdItemKey] = tenantIdClaim;

        await _next(context);
    }
}
