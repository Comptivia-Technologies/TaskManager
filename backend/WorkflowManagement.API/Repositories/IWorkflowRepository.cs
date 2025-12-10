using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface IWorkflowRepository : IRepository<Workflow>
{
    Task<Workflow?> GetWorkflowWithStagesAsync(int workflowId);
    Task<Workflow?> GetWorkflowWithTasksAsync(int workflowId);
    Task<Workflow?> GetWorkflowWithStagesAndTasksAsync(int workflowId);
    Task<IEnumerable<Workflow>> GetWorkflowsByTeamAsync(int teamId);
}



