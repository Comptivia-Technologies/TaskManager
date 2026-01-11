using TaskService.Domain.Enums;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;

namespace TaskService.Application.DTOs;

/// <summary>
/// DTO for updating task status
/// </summary>
public class UpdateTaskStatusDto
{
    public DomainTaskStatus Status { get; set; }
}

