using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class TeamReadDto
{
    public int TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class TeamCreateDto
{
    [Required]
    [StringLength(200)]
    public string TeamName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }
}

public class TeamUpdateDto
{
    [Required]
    [StringLength(200)]
    public string TeamName { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }
}


