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
    InProgress = 4,  // Task is in a stage
    InStage = 5,  // Explicitly in a stage (for clarity)
    Completed = 6,
    Overdue = 7,
    Cancelled = 8
}

