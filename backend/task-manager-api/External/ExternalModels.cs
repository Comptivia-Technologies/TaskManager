using System.Text.Json.Serialization;

namespace TaskManager.API.External;

public class ExternalWorkflowReadDto
{
    [JsonPropertyName("workflowId")]
    public int WorkflowId { get; set; }

    [JsonPropertyName("workflowName")]
    public string WorkflowName { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("teamId")]
    public int? TeamId { get; set; }
}

public class ExternalSlaConfigurationReadDto
{
    [JsonPropertyName("slaConfigurationId")]
    public int SlaConfigurationId { get; set; }

    [JsonPropertyName("workflowId")]
    public int WorkflowId { get; set; }

    [JsonPropertyName("workflowName")]
    public string WorkflowName { get; set; } = string.Empty;

    [JsonPropertyName("priorityLevels")]
    public Dictionary<string, ExternalPriorityLevelDto> PriorityLevels { get; set; } = new();
}

public class ExternalPriorityLevelDto
{
    [JsonPropertyName("responseTime")]
    public int ResponseTime { get; set; }
}


