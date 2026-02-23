using Microsoft.AspNetCore.Http;

namespace SLAConfiguration.API.Services;

public class CurrentOrganizationAccessor : ICurrentOrganizationAccessor
{
    private const string HeaderName = "X-Organization-Id";
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentOrganizationAccessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Guid? GetCurrentOrganizationId()
    {
        var header = _httpContextAccessor.HttpContext?.Request.Headers[HeaderName].FirstOrDefault();
        return Guid.TryParse(header, out var orgId) ? orgId : null;
    }
}
