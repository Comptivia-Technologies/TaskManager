using System.Text.Json;

namespace SLAConfiguration.API.Models;

public class SLAConfiguration
{
    public int SLAConfigurationId { get; set; }
    public int WorkflowId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    // JSONB field for storing priority levels with response times in minutes
    // Structure: { "Critical": { "responseTime": 30 }, "High": { "responseTime": 60 }, ... }
    public string PriorityLevelsJson { get; set; } = "{}";
}

// Minimal Workflow model for reference (since we're querying the same database)
public class Workflow
{
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
}

