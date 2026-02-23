using APIGateway.Infrastructure.Middleware;
using Yarp.ReverseProxy.Transforms;

namespace APIGateway.Infrastructure.Transforms;

/// <summary>
/// Adds X-Organization-Id header to the proxied request from HttpContext.Items.
/// </summary>
public class ForwardOrganizationIdTransform : RequestTransform
{
    public override ValueTask ApplyAsync(RequestTransformContext context)
    {
        var orgId = context.HttpContext.Items[OrganizationAuthMiddleware.OrganizationIdItemKey]?.ToString();
        if (!string.IsNullOrEmpty(orgId))
            AddHeader(context, "X-Organization-Id", orgId);
        return default;
    }
}
