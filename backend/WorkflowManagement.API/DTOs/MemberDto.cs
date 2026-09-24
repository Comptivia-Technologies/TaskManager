using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class MemberReadDto
{
    public Guid MemberId { get; set; }
    public string? UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Guid? TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int SkillLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class MemberCreateDto
{
    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    public string? UserId { get; set; }

    public Guid? TeamId { get; set; }

    [Required]
    [StringLength(100)]
    public string Role { get; set; } = string.Empty;

    [Required]
    [Range(1, 5, ErrorMessage = "Skill level must be between 1 and 5")]
    public int SkillLevel { get; set; }
}

public class MemberUpdateDto
{
    // Blank leaves the existing link untouched; an update can set a UserId but never clear one.
    public string? UserId { get; set; }

    [Required]
    [StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [StringLength(200)]
    public string Email { get; set; } = string.Empty;

    public Guid? TeamId { get; set; }

    [Required]
    [StringLength(100)]
    public string Role { get; set; } = string.Empty;

    [Required]
    [Range(1, 5, ErrorMessage = "Skill level must be between 1 and 5")]
    public int SkillLevel { get; set; }
}


