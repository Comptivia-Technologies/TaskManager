using WorkloadService.Domain.Entities;
using DomainTask = WorkloadService.Domain.Entities.Task;
using DomainStage = WorkloadService.Domain.Entities.Stage;

namespace WorkloadService.Application.Interfaces;

/// <summary>
/// Repository for workload and assignment operations
/// </summary>
public interface IWorkloadRepository
{
    System.Threading.Tasks.Task<IEnumerable<Member>> GetAllMembersAsync();
    System.Threading.Tasks.Task<IEnumerable<Member>> GetMembersByTeamIdAsync(int teamId);
    System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetTasksByMemberIdAsync(int memberId);
    System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByTaskIdAsync(Guid taskId);
    System.Threading.Tasks.Task<TaskAssignment> CreateAssignmentAsync(TaskAssignment assignment);
    System.Threading.Tasks.Task<TaskAssignment> UpdateAssignmentAsync(TaskAssignment assignment);
    System.Threading.Tasks.Task<Workflow?> GetWorkflowByIdAsync(int workflowId);
    System.Threading.Tasks.Task<IEnumerable<DomainStage>> GetStagesByWorkflowIdAsync(int workflowId);
}

