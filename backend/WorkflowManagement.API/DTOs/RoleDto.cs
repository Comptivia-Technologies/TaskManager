using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace WorkflowManagement.API.DTOs;

public class RolesListResponse
{
    public string Success { get; set; } = "SUCCESS";
    public RolesListData Data { get; set; } = new();
}

public class RolesListData
{
    public List<RoleReadDto> Roles { get; set; } = new();
}

public class RoleReadDto
{
    [JsonPropertyName("id")]
    public Guid RoleId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? OrganizationId { get; set; }
    [JsonPropertyName("permissions")]
    public List<string> PermissionCodes { get; set; } = new List<string>();
}

public class RoleCreateDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required]
    public Guid OrganizationId { get; set; }

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
