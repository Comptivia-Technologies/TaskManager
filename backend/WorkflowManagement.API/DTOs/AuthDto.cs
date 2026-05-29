using System.ComponentModel.DataAnnotations;

namespace WorkflowManagement.API.DTOs;

public class LoginRequestDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public AppUserReadDto User { get; set; } = null!;
}

public class AppUserReadDto
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public List<string> Permissions { get; set; } = new();
}

public class AppUserCreateDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required, StringLength(200)]
    public string FullName { get; set; } = string.Empty;

    [Required]
    public Guid RoleId { get; set; }

    public bool IsActive { get; set; } = true;
}

public class AppUserUpdateDto
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [StringLength(200)]
    public string? FullName { get; set; }

    public Guid? RoleId { get; set; }

    public bool? IsActive { get; set; }

    [MinLength(6)]
    public string? Password { get; set; }
}
