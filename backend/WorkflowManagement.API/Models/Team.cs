namespace WorkflowManagement.API.Models;

public class Team
{
    public int TeamId { get; set; }
    public string TeamName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public ICollection<Member> Members { get; set; } = new List<Member>();
    public ICollection<Workflow> Workflows { get; set; } = new List<Workflow>();
}


