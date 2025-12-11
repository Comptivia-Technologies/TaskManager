using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace SLAConfiguration.API.DTOs;

public class SLAConfigurationReadDto
{
    [JsonPropertyName("slaConfigurationId")]
    public int SLAConfigurationId { get; set; }
    
    [JsonPropertyName("workflowId")]
    public int WorkflowId { get; set; }
    
    [JsonPropertyName("workflowName")]
    public string WorkflowName { get; set; } = string.Empty;
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; }
    
    [JsonPropertyName("updatedAt")]
    public DateTime UpdatedAt { get; set; }
    
    [JsonPropertyName("priorityLevels")]
    public Dictionary<string, PriorityLevelDto> PriorityLevels { get; set; } = new();
}

public class PriorityLevelDto
{
    [JsonPropertyName("responseTime")]
    public int ResponseTime { get; set; } // in minutes
}

public class SLAConfigurationCreateDto
{
    [Required]
    [JsonPropertyName("workflowId")]
    public int WorkflowId { get; set; }

    [Required]
    [JsonPropertyName("priorityLevels")]
    public Dictionary<string, PriorityLevelDto> PriorityLevels { get; set; } = new();
}

public class SLAConfigurationUpdateDto
{
    [Required]
    [JsonPropertyName("priorityLevels")]
    public Dictionary<string, PriorityLevelDto> PriorityLevels { get; set; } = new();
}

