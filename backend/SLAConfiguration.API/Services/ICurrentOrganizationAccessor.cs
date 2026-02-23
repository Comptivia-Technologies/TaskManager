namespace SLAConfiguration.API.Services;

public interface ICurrentOrganizationAccessor
{
    Guid? GetCurrentOrganizationId();
}
