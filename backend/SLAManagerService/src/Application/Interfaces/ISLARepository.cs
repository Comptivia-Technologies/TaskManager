using SLAManagerService.Domain.Entities;

namespace SLAManagerService.Application.Interfaces;

/// <summary>
/// Repository for SLA operations (this is the repository for the SLA operations)
/// </summary>
public interface ISLARepository
{
    Task<SLAAssignment?> GetByTaskIdAsync(Guid taskId);
    Task<SLAAssignment> CreateAsync(SLAAssignment assignment);
    Task<SLAAssignment> UpdateAsync(SLAAssignment assignment);
    Task<SLAConfiguration?> GetSLAConfigurationByWorkflowIdAsync(Guid workflowId);
    Task<IEnumerable<SLAAssignment>> GetActiveSLAAssignmentsAsync();
}

