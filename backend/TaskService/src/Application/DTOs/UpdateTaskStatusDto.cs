using TaskService.Domain.Enums;
using DomainTaskStatus = TaskService.Domain.Enums.TaskStatus;
using System.Text.Json.Serialization;

namespace TaskService.Application.DTOs;

/// <summary>
/// DTO for updating task status
/// Accepts string values (e.g., "Completed", "InProgress") or numeric values (0-8) for backward compatibility
/// </summary>
public class UpdateTaskStatusDto
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public DomainTaskStatus Status { get; set; }
}

