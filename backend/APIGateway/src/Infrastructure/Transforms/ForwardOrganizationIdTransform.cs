using APIGateway.Infrastructure.Middleware;
using Yarp.ReverseProxy.Transforms;

namespace APIGateway.Infrastructure.Transforms;

/// <summary>
/// Sets the identity headers on the proxied request from values the auth middleware
/// derived from the token. The middleware has already stripped any the client sent,
/// and these are set rather than added so a single value always reaches the service.
/// </summary>
public class ForwardOrganizationIdTransform : RequestTransform
{
    public override ValueTask ApplyAsync(RequestTransformContext context)
    {
        var orgId = context.HttpContext.Items[OrganizationAuthMiddleware.OrganizationIdItemKey]?.ToString();
        context.ProxyRequest.Headers.Remove("X-Organization-Id");
        if (!string.IsNullOrEmpty(orgId))
            context.ProxyRequest.Headers.TryAddWithoutValidation("X-Organization-Id", orgId);

        var permissions = context.HttpContext.Items[OrganizationAuthMiddleware.PermissionsItemKey]?.ToString();
        context.ProxyRequest.Headers.Remove("X-Permissions");
        if (permissions != null)
            context.ProxyRequest.Headers.TryAddWithoutValidation("X-Permissions", permissions);

        var userId = context.HttpContext.Items[OrganizationAuthMiddleware.UserIdItemKey]?.ToString();
        context.ProxyRequest.Headers.Remove("X-User-Id");
        if (!string.IsNullOrEmpty(userId))
            context.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Id", userId);

        return default;
    }
}
