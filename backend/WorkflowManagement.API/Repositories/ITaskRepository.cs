using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface ITaskRepository : IRepository<Models.Task>
{
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByWorkflowAsync(int workflowId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByStageAsync(int stageId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByMemberAsync(int memberId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsAsync();
}

