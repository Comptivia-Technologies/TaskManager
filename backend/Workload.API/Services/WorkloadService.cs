using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;
using Workload.API.Data;
using Workload.API.DTOs;
using Workload.API.Models;
using Workload.API.Repositories;

namespace Workload.API.Services;

/// <summary>
/// Service for calculating and managing workload
/// </summary>
public class WorkloadService : IWorkloadService
{
    private readonly WorkloadDbContext _context;
    private readonly IWorkloadRepository _workloadRepository;
    private readonly ILogger<WorkloadService> _logger;

    // Weight configuration for workload calculation
    private const double EfficiencyWeight = 0.30;      // 30%
    private const double SkillLevelWeight = 0.20;     // 20%
    private const double TaskCompletionWeight = 0.20;  // 20%
    private const double ActiveTaskLoadWeight = 0.20;  // 20%
    private const double AvailabilityWeight = 0.10;   // 10%

    // Thresholds for workload status
    private const double AvailableThreshold = 30.0;
    private const double PartiallyLoadedThreshold = 60.0;
    private const double FullyLoadedThreshold = 85.0;

    public WorkloadService(
        WorkloadDbContext context,
        IWorkloadRepository workloadRepository,
        ILogger<WorkloadService> logger)
    {
        _context = context;
        _workloadRepository = workloadRepository;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task<WorkloadResponseDto> GetWorkloadByMemberIdAsync(int memberId)
    {
        try
        {
            // Get member information
            var member = await _context.Members
                .FirstOrDefaultAsync(m => m.MemberId == memberId);

            if (member == null)
                throw new KeyNotFoundException($"Member with ID {memberId} not found");

            // Get all tasks assigned to this member
            var tasks = await _context.Tasks
                .Where(t => t.AssignedToMemberId == memberId)
                .ToListAsync();

        // Calculate metrics
        var metrics = CalculateMetrics(member, tasks);
        var breakdown = CalculateBreakdown(metrics);
        var workloadScore = CalculateWorkloadScore(breakdown);
        var workloadStatus = DetermineWorkloadStatus(workloadScore);

        // Create response DTO
        var response = new WorkloadResponseDto
        {
            MemberId = member.MemberId,
            MemberName = $"{member.FirstName} {member.LastName}",
            MemberEmail = member.Email,
            WorkloadScore = Math.Round(workloadScore, 2),
            WorkloadStatus = workloadStatus,
            Metrics = metrics,
            Breakdown = breakdown,
            CalculatedAt = DateTime.UtcNow
        };

            // Optionally save workload snapshot for history
            await SaveWorkloadSnapshotAsync(memberId, workloadScore, workloadStatus, metrics, breakdown);

            return response;
        }
        catch (KeyNotFoundException)
        {
            throw; // Re-throw KeyNotFoundException as-is
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating workload for member {MemberId}. Exception: {ExceptionMessage}", 
                memberId, ex.Message);
            throw new Exception($"Failed to calculate workload: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// Calculates workload metrics from member and task data
    /// </summary>
    private WorkloadMetricsDto CalculateMetrics(Member member, List<Models.Task> tasks)
    {
        // Active tasks = tasks currently being worked on
        var activeTasks = tasks.Where(t => 
            t.Status == "In Progress" || 
            t.Status == "Active").ToList();
        
        // Pending tasks = tasks assigned but not yet started
        var pendingTasks = tasks.Where(t => 
            t.Status == "Assigned" ||
            t.Status == "Pending" || 
            t.Status == "To Do").ToList();

        var completedTasks = tasks.Where(t => 
            t.Status == "Completed" || 
            t.Status == "Done").ToList();

        // Overdue tasks = tasks with "Overdue" status
        var overdueTasks = tasks.Where(t => 
            t.Status == "Overdue").ToList();

        var totalTasks = tasks.Count;
        var completedCount = completedTasks.Count;
        var overdueCount = overdueTasks.Count;

        // If member has no tasks, they should be considered available (low workload)
        if (totalTasks == 0)
        {
            return new WorkloadMetricsDto
            {
                Efficiency = 1.0, // Perfect efficiency when no tasks (not penalized)
                SkillLevel = member.SkillLevel >= 1 && member.SkillLevel <= 5 
                    ? member.SkillLevel 
                    : MapRoleToSkillLevel(member.Role),
                TaskCompletionRate = 100.0, // 100% completion when no tasks (not penalized)
                ActiveTaskCount = 0,
                PendingTaskCount = 0,
                CompletedTaskCount = 0,
                OverdueTaskCount = 0,
                TotalTaskCount = 0,
                IsAvailable = true
            };
        }

        // Calculate efficiency (0-1): Based on completion rate
        var efficiency = Math.Min(1.0, (double)completedCount / totalTasks);

        // Skill level (1-5): Use the skill level from member profile
        var skillLevel = member.SkillLevel;
        
        // Validate skill level is in valid range (1-5), fallback to role mapping if invalid
        if (skillLevel < 1 || skillLevel > 5)
        {
            _logger.LogWarning("Member {MemberId} has invalid SkillLevel {SkillLevel}, falling back to role mapping", 
                member.MemberId, skillLevel);
            skillLevel = MapRoleToSkillLevel(member.Role);
        }

        // Task completion rate (0-100%): Percentage of completed tasks
        var taskCompletionRate = (double)completedCount / totalTasks * 100;

        // Availability: Check if member has too many active tasks
        // Consider available if active tasks < 5, otherwise busy
        var isAvailable = activeTasks.Count < 5;

        return new WorkloadMetricsDto
        {
            Efficiency = Math.Round(efficiency, 2),
            SkillLevel = skillLevel,
            TaskCompletionRate = Math.Round(taskCompletionRate, 2),
            ActiveTaskCount = activeTasks.Count,
            PendingTaskCount = pendingTasks.Count,
            CompletedTaskCount = completedCount,
            OverdueTaskCount = overdueCount,
            TotalTaskCount = totalTasks,
            IsAvailable = isAvailable
        };
    }

    /// <summary>
    /// Maps member role to skill level (1-5)
    /// </summary>
    private int MapRoleToSkillLevel(string role)
    {
        return role.ToLower() switch
        {
            "senior" or "lead" or "architect" => 5,
            "mid-level" or "experienced" => 4,
            "junior" or "associate" => 2,
            "intern" or "trainee" => 1,
            _ => 3 // Default to medium skill level
        };
    }

    /// <summary>
    /// Calculates workload breakdown scores for each component
    /// </summary>
    private WorkloadBreakdownDto CalculateBreakdown(WorkloadMetricsDto metrics)
    {
        // If member has no tasks, they should have minimal workload score
        if (metrics.TotalTaskCount == 0)
        {
            // For members with no tasks, only skill level contributes (and minimally)
            // Lower skill = slightly higher workload (but still very low overall)
            var noTaskSkillScore = (1.0 - (metrics.SkillLevel - 1) / 4.0) * 100;
            
            // Return minimal scores - member is essentially available
            return new WorkloadBreakdownDto
            {
                EfficiencyScore = 0.0, // Perfect efficiency when no tasks
                SkillLevelScore = noTaskSkillScore * 0.1, // Only 10% of skill score contributes
                TaskCompletionScore = 0.0, // Perfect completion when no tasks
                ActiveTaskLoadScore = 0.0, // No active tasks
                AvailabilityScore = 0.0 // Available
            };
        }

        // Efficiency score (0-100): Lower efficiency = higher workload
        var efficiencyScore = (1.0 - metrics.Efficiency) * 100;

        // Skill level score (0-100): Lower skill = higher workload
        // Normalize skill level (1-5) to (0-100) and invert
        var skillLevelScore = (1.0 - (metrics.SkillLevel - 1) / 4.0) * 100;

        // Task completion score (0-100): Lower completion rate = higher workload
        var taskCompletionScore = (1.0 - metrics.TaskCompletionRate / 100.0) * 100;

        // Active task load score (0-100): More active tasks = higher workload
        // Normalize: 0 tasks = 0, 10+ tasks = 100
        var activeTaskLoadScore = Math.Min(100.0, metrics.ActiveTaskCount * 10.0);

        // Availability score (0-100): Not available = higher workload
        var availabilityScore = metrics.IsAvailable ? 0.0 : 100.0;

        return new WorkloadBreakdownDto
        {
            EfficiencyScore = Math.Round(efficiencyScore, 2),
            SkillLevelScore = Math.Round(skillLevelScore, 2),
            TaskCompletionScore = Math.Round(taskCompletionScore, 2),
            ActiveTaskLoadScore = Math.Round(activeTaskLoadScore, 2),
            AvailabilityScore = Math.Round(availabilityScore, 2)
        };
    }

    /// <summary>
    /// Calculates total workload score (0-100) using weighted components
    /// </summary>
    private double CalculateWorkloadScore(WorkloadBreakdownDto breakdown)
    {
        var score = 
            (breakdown.EfficiencyScore * EfficiencyWeight) +
            (breakdown.SkillLevelScore * SkillLevelWeight) +
            (breakdown.TaskCompletionScore * TaskCompletionWeight) +
            (breakdown.ActiveTaskLoadScore * ActiveTaskLoadWeight) +
            (breakdown.AvailabilityScore * AvailabilityWeight);

        return Math.Min(100.0, Math.Max(0.0, score));
    }

    /// <summary>
    /// Determines workload status based on score
    /// </summary>
    private string DetermineWorkloadStatus(double workloadScore)
    {
        if (workloadScore < AvailableThreshold)
            return "Available";
        else if (workloadScore < PartiallyLoadedThreshold)
            return "PartiallyLoaded";
        else if (workloadScore < FullyLoadedThreshold)
            return "FullyLoaded";
        else
            return "Overloaded";
    }

    /// <summary>
    /// Saves workload snapshot to database for history tracking
    /// </summary>
    private async System.Threading.Tasks.Task SaveWorkloadSnapshotAsync(
        int memberId,
        double workloadScore,
        string workloadStatus,
        WorkloadMetricsDto metrics,
        WorkloadBreakdownDto breakdown)
    {
        try
        {
            var workload = new Models.Workload
            {
                MemberId = memberId,
                WorkloadScore = workloadScore,
                WorkloadStatus = workloadStatus,
                Efficiency = metrics.Efficiency,
                SkillLevel = metrics.SkillLevel,
                TaskCompletionRate = metrics.TaskCompletionRate,
                ActiveTaskCount = metrics.ActiveTaskCount,
                PendingTaskCount = metrics.PendingTaskCount,
                IsAvailable = metrics.IsAvailable,
                CalculatedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            await _workloadRepository.AddAsync(workload);
        }
        catch (Exception ex)
        {
            // Log but don't fail the request if snapshot save fails
            _logger.LogWarning(ex, "Failed to save workload snapshot for member {MemberId}", memberId);
        }
    }
}

