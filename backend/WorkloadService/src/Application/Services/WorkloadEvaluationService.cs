using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;
using WorkloadService.Application.Interfaces;
using WorkloadService.Domain.Entities;
using Microsoft.Extensions.Logging;
using DomainTask = WorkloadService.Domain.Entities.Task;

namespace WorkloadService.Application.Services;

/// <summary>
/// Service for evaluating workload and assigning tasks to best available members
/// </summary>
public class WorkloadEvaluationService : IWorkloadEvaluationService
{
    private readonly IWorkloadRepository _repository;
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<WorkloadEvaluationService> _logger;

    // Weight configuration for workload calculation
    private const double EfficiencyWeight = 0.30;
    private const double SkillLevelWeight = 0.20;
    private const double TaskCompletionWeight = 0.20;
    private const double ActiveTaskLoadWeight = 0.20;
    private const double AvailabilityWeight = 0.10;

    public WorkloadEvaluationService(
        IWorkloadRepository repository,
        IRabbitMQPublisher publisher,
        ILogger<WorkloadEvaluationService> logger)
    {
        _repository = repository;
        _publisher = publisher;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task AssignTaskToBestMemberAsync(SLAConfiguredEvent slaConfiguredEvent)
    {
        try
        {
            // Idempotency check
            var existingAssignment = await _repository.GetAssignmentByTaskIdAsync(slaConfiguredEvent.TaskId);
            if (existingAssignment != null)
            {
                _logger.LogWarning(
                    "Task already assigned. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                return;
            }

            // Get workflow to find its team
            var workflow = await _repository.GetWorkflowByIdAsync(slaConfiguredEvent.WorkflowId);
            
            if (workflow == null)
            {
                _logger.LogError(
                    "Workflow not found. WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    slaConfiguredEvent.WorkflowId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                // Throw exception so RabbitMQ can retry - workflow might be created later
                throw new InvalidOperationException($"Workflow not found: {slaConfiguredEvent.WorkflowId}");
            }
            
            _logger.LogInformation(
                "Found workflow. WorkflowId: {WorkflowId}, WorkflowName: {WorkflowName}, TeamId: {TeamId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                workflow.WorkflowId, workflow.WorkflowName, workflow.TeamId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
            
            // Get members - filter by workflow's team if team is specified
            // If workflow doesn't have TeamId, get teams from workflow's stages
            IEnumerable<Member> members;
            if (workflow.TeamId != null)
            {
                members = await _repository.GetMembersByTeamIdAsync(workflow.TeamId.Value);
                _logger.LogInformation(
                    "Filtering members by workflow team. Found {MemberCount} members. WorkflowId: {WorkflowId}, TeamId: {TeamId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    members.Count(), workflow.WorkflowId, workflow.TeamId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
            }
            else
            {
                // Workflow doesn't have TeamId, but stages do - get team from stages
                var stages = await _repository.GetStagesByWorkflowIdAsync(workflow.WorkflowId);
                var stagesList = stages.ToList();
                
                if (stagesList.Any())
                {
                    // Get unique team IDs from all stages
                    var teamIds = stagesList.Select(s => s.TeamId).Distinct().ToList();
                    
                    // Get members from all teams that have stages in this workflow
                    var allMembers = new List<Member>();
                    foreach (var teamId in teamIds)
                    {
                        var teamMembers = await _repository.GetMembersByTeamIdAsync(teamId);
                        allMembers.AddRange(teamMembers);
                    }
                    members = allMembers.DistinctBy(m => m.MemberId);
                    
                    _logger.LogInformation(
                        "Filtering members by workflow stages' teams. Found {MemberCount} members from {TeamCount} teams. WorkflowId: {WorkflowId}, TeamIds: {TeamIds}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        members.Count(), teamIds.Count, workflow.WorkflowId, string.Join(", ", teamIds), slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                }
                else
                {
                    // Fallback to all members if workflow has no stages
                    members = await _repository.GetAllMembersAsync();
                    _logger.LogWarning(
                        "Workflow has no team and no stages, using all members. Found {MemberCount} members. WorkflowId: {WorkflowId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        members.Count(), workflow.WorkflowId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                }
            }
            
            var membersList = members.ToList();

            if (!membersList.Any())
            {
                _logger.LogError(
                    "No members available for task assignment. WorkflowId: {WorkflowId}, TeamId: {TeamId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    slaConfiguredEvent.WorkflowId, workflow.TeamId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                // Throw exception so RabbitMQ can retry - members might be added later
                throw new InvalidOperationException($"No members available for workflow: {slaConfiguredEvent.WorkflowId}");
            }
            
            _logger.LogInformation(
                "Evaluating workload for {MemberCount} members. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                membersList.Count, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);

            // Evaluate workload for each member
            var memberScores = new List<(Member Member, double WorkloadScore, string Reason)>();

            foreach (var member in membersList)
            {
                try
                {
                    var tasks = await _repository.GetTasksByMemberIdAsync(member.MemberId);
                    var tasksList = tasks.ToList();
                    var workloadScore = CalculateWorkloadScore(member, tasksList);
                    var reason = GenerateAssignmentReason(member, tasksList, workloadScore);
                    memberScores.Add((member, workloadScore, reason));
                    
                    _logger.LogInformation(
                        "Evaluated member. MemberId: {MemberId}, MemberName: {MemberName}, TaskCount: {TaskCount}, WorkloadScore: {WorkloadScore}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        member.MemberId, $"{member.FirstName} {member.LastName}", tasksList.Count, workloadScore, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error evaluating workload for member. MemberId: {MemberId}, MemberName: {MemberName}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        member.MemberId, $"{member.FirstName} {member.LastName}", slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                    // Continue with other members even if one fails
                }
            }

            if (!memberScores.Any())
            {
                _logger.LogError(
                    "No member scores calculated. All members failed evaluation. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
                // Throw exception so RabbitMQ can retry - might be a temporary issue
                throw new InvalidOperationException($"All members failed evaluation for task: {slaConfiguredEvent.TaskId}");
            }

            // Select member with lowest workload score (most available)
            // Prefer members who don't have active/pending tasks with the same priority
            var taskPriority = slaConfiguredEvent.Priority;

            // Separate members into two groups: those with/without same priority tasks
            var membersWithoutConflict = new List<(Member Member, double WorkloadScore, string Reason)>();
            var membersWithConflict = new List<(Member Member, double WorkloadScore, string Reason)>();

            foreach (var ms in memberScores)
            {
                var memberTasks = await _repository.GetTasksByMemberIdAsync(ms.Member.MemberId);
                var tasksList = memberTasks.ToList();
                var hasSamePriorityTask = tasksList.Any(t =>
                    (t.Status == "In Progress" || 
                     t.Status == "Active" || 
                     t.Status == "Assigned" || 
                     t.Status == "Pending" ||
                     t.Status == "To Do") &&
                    string.Equals(t.Priority, taskPriority, StringComparison.OrdinalIgnoreCase));
                
                if (hasSamePriorityTask)
                {
                    membersWithConflict.Add(ms);
                }
                else
                {
                    membersWithoutConflict.Add(ms);
                }
            }

            // Prefer members without conflicts, but fallback to members with conflicts if needed
            var bestMember = membersWithoutConflict.Any()
                ? membersWithoutConflict.OrderBy(ms => ms.WorkloadScore).First()
                : membersWithConflict.OrderBy(ms => ms.WorkloadScore).First(); // Fallback if all have conflicts

            if (membersWithoutConflict.Any())
            {
                _logger.LogInformation(
                    "Selected best member (no same priority conflict). MemberId: {MemberId}, MemberName: {MemberName}, WorkloadScore: {WorkloadScore}, Reason: {Reason}, TaskId: {TaskId}, Priority: {Priority}, CorrelationId: {CorrelationId}",
                    bestMember.Member.MemberId, $"{bestMember.Member.FirstName} {bestMember.Member.LastName}", bestMember.WorkloadScore, bestMember.Reason, slaConfiguredEvent.TaskId, taskPriority, slaConfiguredEvent.CorrelationId);
            }
            else
            {
                _logger.LogWarning(
                    "All members have tasks with priority '{Priority}'. Assigning to best member anyway (task will be pending in their queue). MemberId: {MemberId}, MemberName: {MemberName}, WorkloadScore: {WorkloadScore}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    taskPriority, bestMember.Member.MemberId, $"{bestMember.Member.FirstName} {bestMember.Member.LastName}", bestMember.WorkloadScore, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
            }

            // Create assignment record
            var assignment = new TaskAssignment
            {
                TaskId = slaConfiguredEvent.TaskId,
                MemberId = bestMember.Member.MemberId,
                WorkloadScore = bestMember.WorkloadScore,
                AssignmentReason = bestMember.Reason,
                AssignedAt = DateTime.UtcNow,
                SLAConfiguredEventId = slaConfiguredEvent.SLAAssignmentId // Use SLAAssignmentId for idempotency
            };

            await _repository.CreateAssignmentAsync(assignment);

            // Publish TaskAssignedEvent
            var taskAssignedEvent = new TaskAssignedEvent
            {
                AssignmentId = assignment.AssignmentId, // Include AssignmentId for idempotency
                TaskId = slaConfiguredEvent.TaskId,
                MemberId = bestMember.Member.MemberId,
                MemberName = $"{bestMember.Member.FirstName} {bestMember.Member.LastName}",
                MemberEmail = bestMember.Member.Email,
                WorkloadScore = bestMember.WorkloadScore,
                AssignedAt = DateTime.UtcNow,
                CorrelationId = slaConfiguredEvent.CorrelationId
            };

            await _publisher.PublishAsync(
                taskAssignedEvent,
                RabbitMQConstants.WorkloadExchange,
                RabbitMQConstants.TaskAssigned,
                slaConfiguredEvent.CorrelationId);

            _logger.LogInformation(
                "Task assigned to member. TaskId: {TaskId}, MemberId: {MemberId}, WorkloadScore: {WorkloadScore}, CorrelationId: {CorrelationId}",
                slaConfiguredEvent.TaskId, bestMember.Member.MemberId, bestMember.WorkloadScore, slaConfiguredEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error assigning task to member. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
            throw;
        }
    }

    /// <summary>
    /// Calculates workload score for a member (0-100, lower is better)
    /// </summary>
    private double CalculateWorkloadScore(Member member, List<DomainTask> tasks)
    {
        var totalTasks = tasks.Count;
        var completedTasks = tasks.Count(t => 
            t.Status == "Completed" || 
            t.Status == "Done");
        // Active tasks = tasks currently being worked on
        var activeTasks = tasks.Count(t => t.Status == "In Progress" || t.Status == "Active");
        // Pending tasks = tasks assigned but not yet started (not included in active count)

        // Efficiency (30%)
        var efficiency = totalTasks > 0 ? Math.Min(1.0, (double)completedTasks / totalTasks) : 1.0;
        var efficiencyScore = (1.0 - efficiency) * 100 * EfficiencyWeight;

        // Skill Level (20%) - Lower skill = higher workload
        var skillLevelScore = (6 - member.SkillLevel) * 20 * SkillLevelWeight;

        // Task Completion Rate (20%)
        var completionRate = totalTasks > 0 ? (double)completedTasks / totalTasks * 100 : 100.0;
        var completionScore = (100 - completionRate) * TaskCompletionWeight;

        // Active Task Load (20%)
        var activeTaskLoadScore = Math.Min(100, activeTasks * 10) * ActiveTaskLoadWeight;

        // Availability (10%) - Available if active tasks < 5
        var isAvailable = activeTasks < 5;
        var availabilityScore = isAvailable ? 0 : 100 * AvailabilityWeight;

        return efficiencyScore + skillLevelScore + completionScore + activeTaskLoadScore + availabilityScore;
    }

    private string GenerateAssignmentReason(Member member, List<DomainTask> tasks, double workloadScore)
    {
        var activeTasks = tasks.Count(t => t.Status == "In Progress" || t.Status == "Active");
        return $"WorkloadScore: {workloadScore:F2}, ActiveTasks: {activeTasks}, SkillLevel: {member.SkillLevel}";
    }
}

