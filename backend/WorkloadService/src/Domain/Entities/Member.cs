namespace WorkloadService.Domain.Entities;

/// <summary>
/// Reference Member entity (from WorkflowManagement database)
/// </summary>
public class Member
{
    public int MemberId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int TeamId { get; set; }
    public string Role { get; set; } = string.Empty;
    public int SkillLevel { get; set; }
}

