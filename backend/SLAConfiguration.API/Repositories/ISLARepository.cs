using SLAConfiguration.API.Models;

namespace SLAConfiguration.API.Repositories;

public interface ISLARepository : IRepository<Models.SLAConfiguration>
{
    Task<Models.SLAConfiguration?> GetByWorkflowIdAsync(Guid workflowId);
    Task<bool> ExistsForWorkflowAsync(Guid workflowId);
}

