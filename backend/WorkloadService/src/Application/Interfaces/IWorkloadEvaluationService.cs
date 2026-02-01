using Shared.Contracts.EventContracts;

namespace WorkloadService.Application.Interfaces;

/// <summary>
/// Service for evaluating workload and assigning tasks
/// </summary>
public interface IWorkloadEvaluationService
{
    System.Threading.Tasks.Task AssignTaskToBestMemberAsync(SLAConfiguredEvent slaConfiguredEvent);
    System.Threading.Tasks.Task ReassignTaskToTeamMemberAsync(TaskStageReassignmentNeededEvent reassignmentEvent);
}

