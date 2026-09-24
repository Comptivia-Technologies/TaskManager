using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Configuration;

namespace WorkflowManagement.API.Middleware;

/// <summary>
/// Refuses the request unless the caller holds the named permission.
///
/// The gateway resolves the caller's permissions from their Product Hub role
/// assignment and forwards them as X-Permissions; it strips any the client sent, so
/// the header can only have come from there. A request with no header at all is
/// refused rather than allowed — an endpoint carrying this attribute is one where
/// guessing wrong grants someone else's authority.
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequiresPermissionAttribute : Attribute, IAuthorizationFilter
{
    public const string HeaderName = "X-Permissions";

    /// <summary>
    /// Break-glass header. Permissions are themselves edited through a permission,
    /// so a role saved with none locks everybody out of undoing it. A shared key
    /// read from configuration gives a way back in that does not depend on any role.
    /// Same mechanism as the existing ApiKeys:GetAllRoles endpoint.
    /// </summary>
    public const string ApiKeyHeaderName = "X-Api-Key";

    private readonly string _permissionCode;

    public RequiresPermissionAttribute(string permissionCode)
    {
        _permissionCode = permissionCode;
    }

    private static bool UsesValidBreakGlassKey(AuthorizationFilterContext context)
    {
        var configuration = context.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var expected = configuration["ApiKeys:RoleAdmin"];
        if (string.IsNullOrWhiteSpace(expected))
            return false;

        var supplied = context.HttpContext.Request.Headers[ApiKeyHeaderName].FirstOrDefault();
        return !string.IsNullOrEmpty(supplied) && string.Equals(supplied, expected, StringComparison.Ordinal);
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (UsesValidBreakGlassKey(context))
        {
            context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger<RequiresPermissionAttribute>()
                .LogWarning(
                    "Break-glass key used for {Method} {Path}",
                    context.HttpContext.Request.Method, context.HttpContext.Request.Path);
            return;
        }

        var header = context.HttpContext.Request.Headers[HeaderName].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(header))
        {
            context.Result = new ObjectResult(new
            {
                error = "Your permissions could not be determined, so this was refused. " +
                        "If this is unexpected, check that the gateway has AuthService:ProductId configured."
            })
            { StatusCode = StatusCodes.Status403Forbidden };
            return;
        }

        var held = header.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (!held.Contains(_permissionCode, StringComparer.OrdinalIgnoreCase))
        {
            context.Result = new ObjectResult(new { error = $"This needs the '{_permissionCode}' permission." })
            { StatusCode = StatusCodes.Status403Forbidden };
        }
    }
}
