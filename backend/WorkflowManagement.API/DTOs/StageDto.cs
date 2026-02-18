using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class StageReadDto
{
    public Guid StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public Guid WorkflowId { get; set; }
    public Guid TeamId { get; set; }
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
    public Guid WorkflowId { get; set; }

    [Required]
    public Guid TeamId { get; set; }
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
    public Guid TeamId { get; set; }
}

