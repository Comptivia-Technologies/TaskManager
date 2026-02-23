namespace PriorityRuleEngine.API.Services;

public interface ICurrentOrganizationAccessor
{
    Guid? GetCurrentOrganizationId();
}
