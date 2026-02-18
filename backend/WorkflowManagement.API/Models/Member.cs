namespace WorkflowManagement.API.Models;

public class Member
{
    public Guid MemberId { get; set; } = Guid.NewGuid();
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public Guid? TeamId { get; set; }
    public string Role { get; set; } = string.Empty;
    public int SkillLevel { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Team? Team { get; set; }
    public ICollection<Task> AssignedTasks { get; set; } = new List<Task>();
}


