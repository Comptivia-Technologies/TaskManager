namespace TaskService.Domain.Enums;

/// <summary>
/// Task status enumeration
/// </summary>
public enum TaskStatus
{
    Created = 0,
    WorkflowSelected = 1,
    SLAConfigured = 2,
    Assigned = 3,
    InProgress = 4,
    Completed = 5,
    Overdue = 6,
    Cancelled = 7,
    Escalated = 8
}

