namespace APIGateway.Application.DTOs;

/// <summary>
/// DTO for updating task status via API Gateway
/// Status values: "Created", "WorkflowSelected", "SLAConfigured", "Assigned", "InProgress", "Completed", "Overdue", "Cancelled", "Escalated"
/// Also accepts numeric values (0-8) for backward compatibility
/// </summary>
public class UpdateTaskStatusRequestDto
{
    public string Status { get; set; } = string.Empty;
}
