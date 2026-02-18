namespace Workload.API.Models;

/// <summary>
/// Reference model for Member from WorkflowManagement database
/// </summary>
public class Member
{
    public Guid MemberId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Guid TeamId { get; set; }
    public string Role { get; set; } = string.Empty;
    public int SkillLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

