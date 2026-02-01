namespace PriorityRuleEngine.API.Models;

/// <summary>
/// Priority rule for automatically assigning task priority based on conditions
/// </summary>
public class PriorityRule
{
    public int RuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;  // "Critical", "High", "Medium", "Low"
    public int Salience { get; set; } = 0;  // Rule priority (higher = evaluated first)
    public bool IsActive { get; set; } = true;
    
    // Generic conditions - JSON structure for rule evaluation
    // Example: { "all": [{ "path": "$.taskType", "op": "equals", "value": "Bug" }] }
    public string ConditionsJson { get; set; } = string.Empty;
    
    // Optional: Workload-based conditions
    public int? MaxWorkloadScore { get; set; }  // Only apply if member workload < this
    public string? TeamName { get; set; }      // Only for specific team
    
    // Workflow-specific rules
    public int? WorkflowId { get; set; }  // NULL = global rule, specific ID = workflow-specific rule
    
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

