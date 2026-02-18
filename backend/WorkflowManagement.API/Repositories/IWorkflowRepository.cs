using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IWorkflowRepository : IRepository<Workflow>
{
    Task<Workflow?> GetWorkflowWithStagesAsync(Guid workflowId);
    Task<Workflow?> GetWorkflowWithTasksAsync(Guid workflowId);
    Task<Workflow?> GetWorkflowWithStagesAndTasksAsync(Guid workflowId);
    Task<IEnumerable<Workflow>> GetWorkflowsByTeamAsync(Guid teamId);
}



