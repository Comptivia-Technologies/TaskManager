namespace APIGateway.Application.DTOs;

/// <summary>
/// DTO for updating task status via API Gateway
/// Status values: 0=Created, 1=WorkflowSelected, 2=SLAConfigured, 3=Assigned, 4=InProgress, 5=Completed, 6=Overdue, 7=Cancelled
/// </summary>
public class UpdateTaskStatusRequestDto
{
    public int Status { get; set; }  // Enum value (0-7)
}
