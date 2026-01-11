namespace TaskService.Application.DTOs;

/// <summary>
/// DTO for creating a new task
/// </summary>
public class TaskCreateDto
{
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = "Medium";
    public string TaskType { get; set; } = string.Empty;
}

