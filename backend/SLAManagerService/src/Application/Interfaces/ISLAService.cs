using Shared.Contracts.EventContracts;

namespace SLAManagerService.Application.Interfaces;

/// <summary>
/// Service for managing SLA assignments
/// </summary>
public interface ISLAService
{
    Task ConfigureSLAForTaskAsync(PriorityAssignedEvent priorityAssignedEvent);
}

