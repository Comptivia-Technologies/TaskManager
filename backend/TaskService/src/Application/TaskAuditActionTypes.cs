namespace TaskService.Application;

public static class TaskAuditActionTypes
{
    public const string Assigned = "Assigned";
    public const string Reassigned = "Reassigned";
    public const string StageCompleted = "StageCompleted";
    public const string StageEscalated = "StageEscalated";
    public const string TaskCompleted = "TaskCompleted";
}
