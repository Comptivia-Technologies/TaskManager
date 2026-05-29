using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class RoleReadDto
{
    public Guid RoleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> PermissionCodes { get; set; } = new List<string>();
}

public class RoleCreateDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public List<string> PermissionCodes { get; set; } = new List<string>();
}

public class RoleUpdateDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    public List<string> PermissionCodes { get; set; } = new List<string>();
}
