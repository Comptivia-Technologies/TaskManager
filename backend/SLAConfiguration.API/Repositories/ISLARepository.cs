using SLAConfiguration.API.Models;

namespace SLAConfiguration.API.Repositories;

public interface ISLARepository : IRepository<Models.SLAConfiguration>
{
    Task<Models.SLAConfiguration?> GetByWorkflowIdAsync(int workflowId);
    Task<bool> ExistsForWorkflowAsync(int workflowId);
}

