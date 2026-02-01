using TaskService.Domain.Enums;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.DTOs;

/// <summary>
/// DTO for reading task information
/// </summary>
public class TaskReadDto
{
    public Guid TaskId { get; set; }
    public string TaskName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Priority { get; set; } = string.Empty;
    public string TaskType { get; set; } = string.Empty;
    public DomainTaskStatus Status { get; set; }
    public int? WorkflowId { get; set; }
    public int? MemberId { get; set; }
    public DateTime? SLADeadline { get; set; }
    public bool IsOverdue { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

