using Shared.Contracts.EventContracts;

namespace WorkflowService.Application.Interfaces;

/// <summary>
/// Service for selecting workflows for tasks
/// </summary>
public interface IWorkflowSelectionService
{
    Task SelectWorkflowForTaskAsync(TaskCreatedEvent taskCreatedEvent);
}

