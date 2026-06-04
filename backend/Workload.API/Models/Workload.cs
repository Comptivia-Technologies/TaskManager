namespace Workload.API.Models;

/// <summary>
/// Entity for storing workload history and snapshots
/// </summary>
public class Workload
{
    public Guid WorkloadId { get; set; } = Guid.NewGuid();
    public Guid MemberId { get; set; }
    public double WorkloadScore { get; set; }
    public string WorkloadStatus { get; set; } = string.Empty; // Available, PartiallyLoaded, FullyLoaded, Overloaded
    public double Efficiency { get; set; }
    public int SkillLevel { get; set; }
    public double TaskCompletionRate { get; set; }
    public int ActiveTaskCount { get; set; }
    public int PendingTaskCount { get; set; }
    public bool IsAvailable { get; set; }
    public DateTime CalculatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

