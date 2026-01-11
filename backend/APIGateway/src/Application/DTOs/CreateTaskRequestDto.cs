namespace APIGateway.Application.DTOs;

/// <summary>
/// DTO for creating a task via API Gateway
/// </summary>
public class CreateTaskRequestDto
{
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string TaskType { get; set; } = string.Empty;
}

