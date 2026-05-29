namespace SLAManagerService.Domain.Entities;

/// <summary>
/// Reference SLA Configuration entity (from SLAConfiguration database)
/// </summary>
public class SLAConfiguration
{
    public Guid SLAConfigurationId { get; set; }
    public Guid WorkflowId { get; set; }
    public string PriorityLevelsJson { get; set; } = "{}"; // JSONB: { "Critical": { "responseTime": 30 }, ... }
}

