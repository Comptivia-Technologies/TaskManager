namespace SLAManagerService.Domain.Entities;

/// <summary>
/// Reference SLA Configuration entity (from SLAConfiguration database)
/// </summary>
public class SLAConfiguration
{
    public int SLAConfigurationId { get; set; }
    public int WorkflowId { get; set; }
    public string PriorityLevelsJson { get; set; } = "{}"; // JSONB: { "Critical": { "responseTime": 30 }, ... }
}

