using Shared.Contracts.EventContracts;

namespace WorkloadService.Application.Interfaces;

/// <summary>
/// Service for evaluating workload and assigning tasks
/// </summary>
public interface IWorkloadEvaluationService
{
    System.Threading.Tasks.Task AssignTaskToBestMemberAsync(SLAConfiguredEvent slaConfiguredEvent);
}

