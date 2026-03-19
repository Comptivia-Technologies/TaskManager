namespace APIGateway.Application.DTOs;

/// <summary>
/// DTO for creating a task via API Gateway
/// Priority will be automatically assigned by rule engine based on taskData (this is the DTO for creating a task via the API Gateway)
/// </summary>
public class CreateTaskRequestDto
{
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string TaskType { get; set; } = string.Empty;
    public Dictionary<string, object>? TaskData { get; set; }  // Generic task-specific data for rule evaluation
}

