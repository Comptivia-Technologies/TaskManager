using Shared.Contracts.Constants;
using Shared.Contracts.EventContracts;

namespace Shared.Messaging;

internal static class EventDetailTypeMapper
{
    public static string GetDetailType(Type eventType)
    {
        var typeName = eventType.Name;
        return typeName switch
        {
            nameof(TaskCreatedEvent) => EventBusConstants.TaskCreated,
            nameof(WorkflowSelectedEvent) => EventBusConstants.WorkflowSelected,
            nameof(PriorityAssignedEvent) => EventBusConstants.PriorityAssigned,
            nameof(SLAConfiguredEvent) => EventBusConstants.SLAConfigured,
            nameof(TaskAssignedEvent) => EventBusConstants.TaskAssigned,
            nameof(TaskOverdueEvent) => EventBusConstants.TaskOverdue,
            nameof(TaskStageStartedEvent) => EventBusConstants.TaskStageStarted,
            nameof(TaskStageCompletedEvent) => EventBusConstants.TaskStageCompleted,
            nameof(TaskStageEscalatedEvent) => EventBusConstants.TaskStageEscalated,
            nameof(TaskStageEscalationTriggeredEvent) => EventBusConstants.TaskStageEscalationTriggered,
            nameof(TaskCompletedEvent) => EventBusConstants.TaskCompleted,
            nameof(TaskStatusUpdatedEvent) => EventBusConstants.TaskStatusUpdated,
            nameof(TaskStageReassignmentNeededEvent) => EventBusConstants.TaskStageReassignmentNeeded,
            _ => typeName.Replace("Event", "")
        };
    }
}
