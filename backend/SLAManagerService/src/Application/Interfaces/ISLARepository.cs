using SLAManagerService.Domain.Entities;

namespace SLAManagerService.Application.Interfaces;

/// <summary>
/// Repository for SLA operations
/// </summary>
public interface ISLARepository
{
    Task<SLAAssignment?> GetByTaskIdAsync(Guid taskId);
    Task<SLAAssignment> CreateAsync(SLAAssignment assignment);
    Task<SLAAssignment> UpdateAsync(SLAAssignment assignment);
    Task<SLAConfiguration?> GetSLAConfigurationByWorkflowIdAsync(int workflowId);
    Task<IEnumerable<SLAAssignment>> GetActiveSLAAssignmentsAsync();
}

