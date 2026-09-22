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
    System.Threading.Tasks.Task<IEnumerable<Member>> GetMembersByTeamIdAsync(Guid teamId);
    System.Threading.Tasks.Task<IEnumerable<DomainTask>> GetTasksByMemberIdAsync(Guid memberId);
    System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByTaskIdAsync(Guid taskId);
    System.Threading.Tasks.Task<TaskAssignment?> GetAssignmentByCorrelationIdAsync(Guid correlationId);
    System.Threading.Tasks.Task<TaskAssignment> CreateAssignmentAsync(TaskAssignment assignment);
    System.Threading.Tasks.Task<TaskAssignment> UpdateAssignmentAsync(TaskAssignment assignment);
    System.Threading.Tasks.Task<Workflow?> GetWorkflowByIdAsync(Guid workflowId);
    System.Threading.Tasks.Task<IEnumerable<DomainStage>> GetStagesByWorkflowIdAsync(Guid workflowId);
}

