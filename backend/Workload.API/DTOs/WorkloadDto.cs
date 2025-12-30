namespace Workload.API.DTOs;

/// <summary>
/// Response DTO for workload calculation
/// </summary>
public class WorkloadResponseDto
{
    public int MemberId { get; set; }
    public string MemberName { get; set; } = string.Empty;
    public string MemberEmail { get; set; } = string.Empty;
    public double WorkloadScore { get; set; }
    public string WorkloadStatus { get; set; } = string.Empty;
    public WorkloadMetricsDto Metrics { get; set; } = new WorkloadMetricsDto();
    public WorkloadBreakdownDto Breakdown { get; set; } = new WorkloadBreakdownDto();
    public DateTime CalculatedAt { get; set; }
}

/// <summary>
/// Detailed metrics used in workload calculation
/// </summary>
public class WorkloadMetricsDto
{
    public double Efficiency { get; set; }
    public int SkillLevel { get; set; }
    public double TaskCompletionRate { get; set; }
    public int ActiveTaskCount { get; set; }
    public int PendingTaskCount { get; set; }
    public int TotalTaskCount { get; set; }
    public bool IsAvailable { get; set; }
}

/// <summary>
/// Breakdown of workload score by component
/// </summary>
public class WorkloadBreakdownDto
{
    public double EfficiencyScore { get; set; }
    public double SkillLevelScore { get; set; }
    public double TaskCompletionScore { get; set; }
    public double ActiveTaskLoadScore { get; set; }
    public double AvailabilityScore { get; set; }
}

