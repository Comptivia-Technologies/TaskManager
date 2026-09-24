using System.Text.Json;
using APIGateway.Infrastructure.Services;
using Microsoft.AspNetCore.Http;

namespace APIGateway.Infrastructure.Middleware;

/// <summary>
/// Runs after JWT authentication. For non-excluded paths, requires authentication
/// and sets OrganizationId from token claims into HttpContext.Items for downstream use.
/// </summary>
public class OrganizationAuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly CallerPermissionResolver _permissionResolver;
    private readonly string[] _excludedPathPrefixes;

    public const string OrganizationIdItemKey = "OrganizationId";
    public const string TenantIdItemKey = "TenantId";
    public const string UserIdItemKey = "UserId";
    public const string PermissionsItemKey = "Permissions";

    // Headers the gateway derives from the token. A client must never be able to
    // supply them: YARP copies request headers to the proxied request, so anything
    // left here would travel downstream alongside the value we add.
    private static readonly string[] DerivedHeaders =
    {
        "X-Organization-Id",
        "X-User-Id",
        "X-Permissions"
    };

    public OrganizationAuthMiddleware(
        RequestDelegate next,
        CallerPermissionResolver permissionResolver,
        IConfiguration configuration)
    {
        _next = next;
        _permissionResolver = permissionResolver;
        _excludedPathPrefixes = configuration.GetSection("Auth:ExcludedPathPrefixes").Get<string[]>()
            ?? new[] { "/health", "/api/auth/tenant", "/api/roles/all", "/swagger" };
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value ?? "";

        // Stripped before anything else, including on excluded paths, so a forged
        // header cannot reach a downstream service by any route.
        foreach (var header in DerivedHeaders)
            context.Request.Headers.Remove(header);

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

        // Every downstream service reads its tenant from this one value. A token
        // without it cannot be scoped to anything, so the request is refused rather
        // than forwarded unscoped.
        if (string.IsNullOrEmpty(orgIdClaim))
        {
            context.Response.StatusCode = 403;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "Token carries no organization. Sign in again." });
            return;
        }

        context.Items[OrganizationIdItemKey] = orgIdClaim;

        // Needed downstream to decide what the caller is allowed to do.
        var userIdClaim = context.User.FindFirst("user_id")?.Value
            ?? context.User.FindFirst("sub")?.Value
            ?? context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!string.IsNullOrEmpty(userIdClaim))
        {
            context.Items[UserIdItemKey] = userIdClaim;

            // Resolved here so each service can enforce a permission by reading one
            // header, rather than every service learning how roles are assigned.
            var permissions = await _permissionResolver.ResolveAsync(
                userIdClaim, orgIdClaim, context.Request.Headers["Authorization"].FirstOrDefault());
            if (permissions != null)
                context.Items[PermissionsItemKey] = string.Join(',', permissions);
        }

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
