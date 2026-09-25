using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Repositories;

public interface ITaskRepository : IRepository<Models.Task>
{
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByWorkflowAsync(Guid workflowId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByStageAsync(Guid stageId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksByMemberAsync(Guid memberId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksCompletedByMemberAsync(Guid memberId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksEscalatedByMemberAsync(Guid memberId);
    /// <summary>One task with its workflow, stage and assignee, scoped to an organization.</summary>
    System.Threading.Tasks.Task<Models.Task?> GetTaskWithDetailsAsync(Guid taskId, Guid organizationId);
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsAsync();
    System.Threading.Tasks.Task<IEnumerable<Models.Task>> GetTasksWithDetailsByOrganizationAsync(Guid organizationId);
    System.Threading.Tasks.Task<(IEnumerable<Models.Task> Items, int TotalCount)> GetTasksWithDetailsByOrganizationPaginatedAsync(Guid organizationId, string? priority, int page, int limit);
}

