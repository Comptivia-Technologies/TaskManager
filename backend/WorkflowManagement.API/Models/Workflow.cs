using System.Text.Json;

namespace WorkflowManagement.API.Models;

public class Workflow
{
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // JSONB field for storing complete workflow structure as JSON
    // This allows easy retrieval and can be used for versioning/snapshots
    public string? WorkflowJson { get; set; }

    // Navigation properties
    public Team? Team { get; set; }
    public ICollection<Stage> Stages { get; set; } = new List<Stage>();
    public ICollection<Task> Tasks { get; set; } = new List<Task>();
}


