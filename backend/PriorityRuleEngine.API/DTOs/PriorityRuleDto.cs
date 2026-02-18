namespace PriorityRuleEngine.API.DTOs;

public class PriorityRuleDto
{
    public Guid RuleId { get; set; }
    public string RuleName { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int Salience { get; set; }
    public bool IsActive { get; set; }
    public string ConditionsJson { get; set; } = string.Empty;
    public int? MaxWorkloadScore { get; set; }
    public string? TeamName { get; set; }
    public Guid? WorkflowId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class CreatePriorityRuleRequest
{
    public string RuleName { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int Salience { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public string ConditionsJson { get; set; } = string.Empty;
    public int? MaxWorkloadScore { get; set; }
    public string? TeamName { get; set; }
    public Guid? WorkflowId { get; set; }
}

public class UpdatePriorityRuleRequest
{
    public string RuleName { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public int Salience { get; set; }
    public bool IsActive { get; set; }
    public string ConditionsJson { get; set; } = string.Empty;
    public int? MaxWorkloadScore { get; set; }
    public string? TeamName { get; set; }
    public Guid? WorkflowId { get; set; }
}

