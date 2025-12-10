using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class StageReadDto
{
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int WorkflowId { get; set; }
    public int TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class StageCreateDto
{
    [Required]
    [StringLength(200)]
    public string StageName { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue)]
    public int StageOrder { get; set; }

    [Required]
    public int WorkflowId { get; set; }

    [Required]
    public int TeamId { get; set; }
}

public class StageUpdateDto
{
    [Required]
    [StringLength(200)]
    public string StageName { get; set; } = string.Empty;

    [Required]
    [Range(1, int.MaxValue)]
    public int StageOrder { get; set; }

    [Required]
    public int TeamId { get; set; }
}

