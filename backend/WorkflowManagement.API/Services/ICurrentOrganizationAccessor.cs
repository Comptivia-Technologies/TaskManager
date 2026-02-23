namespace WorkflowManagement.API.Services;

/// <summary>
/// Provides the current organization ID from the request (X-Organization-Id header set by API Gateway).
/// </summary>
public interface ICurrentOrganizationAccessor
{
    Guid? GetCurrentOrganizationId();
}
