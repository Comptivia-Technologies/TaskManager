using Workload.API.DTOs;

namespace Workload.API.Services;

/// <summary>
/// Service interface for workload calculation and management
/// </summary>
public interface IWorkloadService
{
    System.Threading.Tasks.Task<WorkloadResponseDto> GetWorkloadByMemberIdAsync(int memberId);
}

