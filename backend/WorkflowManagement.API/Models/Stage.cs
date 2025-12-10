namespace WorkflowManagement.API.Models;

public class Stage
{
    public int StageId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public int StageOrder { get; set; }
    public int WorkflowId { get; set; }
    public int TeamId { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Workflow Workflow { get; set; } = null!;
    public Team Team { get; set; } = null!;
    public ICollection<Task> Tasks { get; set; } = new List<Task>();
}

