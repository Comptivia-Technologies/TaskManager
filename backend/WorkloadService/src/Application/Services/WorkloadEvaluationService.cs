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
    private readonly IEventBus _eventBus;
    private readonly ILogger<WorkloadEvaluationService> _logger;

    // Weight configuration for workload calculation
    private const double EfficiencyWeight = 0.30;
    private const double SkillLevelWeight = 0.20;
    private const double TaskCompletionWeight = 0.20;
    private const double ActiveTaskLoadWeight = 0.20;
    private const double AvailabilityWeight = 0.10;

    public WorkloadEvaluationService(
        IWorkloadRepository repository,
        IEventBus eventBus,
        ILogger<WorkloadEvaluationService> logger)
    {
        _repository = repository;
        _eventBus = eventBus;
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
                // Throw exception so EventBus can retry - workflow might be created later
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
                // Workflow doesn't have TeamId, but stages do - get team from FIRST stage (Stage 1)
                // New tasks should be assigned to Stage 1 team members for initial assignment
                var stages = await _repository.GetStagesByWorkflowIdAsync(workflow.WorkflowId);
                var stagesList = stages.OrderBy(s => s.StageOrder).ToList();
                
                if (stagesList.Any())
                {
                    // Get Stage 1's team (first stage) for initial assignment
                    var firstStage = stagesList.First();
                    var firstStageTeamId = firstStage.TeamId;
                    
                    members = await _repository.GetMembersByTeamIdAsync(firstStageTeamId);
                    
                    _logger.LogInformation(
                        "Filtering members by first stage's team for initial assignment. Found {MemberCount} members. WorkflowId: {WorkflowId}, StageId: {StageId}, StageName: {StageName}, TeamId: {TeamId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        members.Count(), workflow.WorkflowId, firstStage.StageId, firstStage.StageName, firstStageTeamId, slaConfiguredEvent.TaskId, slaConfiguredEvent.CorrelationId);
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
                // Throw exception so EventBus can retry - members might be added later
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
                // Throw exception so EventBus can retry - might be a temporary issue
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

            await _eventBus.PublishAsync(
                taskAssignedEvent,
                EventBusConstants.WorkloadSource,
                EventBusConstants.TaskAssigned,
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

    /// <summary>
    /// Reassigns a task to the best available member in a specific team (used when stage changes)
    /// </summary>
    public async System.Threading.Tasks.Task ReassignTaskToTeamMemberAsync(TaskStageReassignmentNeededEvent reassignmentEvent)
    {
        try
        {
            _logger.LogInformation(
                "Processing task reassignment. TaskId: {TaskId}, NewTeamId: {NewTeamId}, StageName: {StageName}, PreferredMemberId: {PreferredMemberId}, CorrelationId: {CorrelationId}",
                reassignmentEvent.TaskId, reassignmentEvent.NewTeamId, reassignmentEvent.StageName, reassignmentEvent.PreferredMemberId, reassignmentEvent.CorrelationId);

            var alreadyRecorded = await _repository.GetAssignmentByCorrelationIdAsync(reassignmentEvent.CorrelationId);
            if (alreadyRecorded != null)
            {
                _logger.LogInformation(
                    "Reassignment already recorded. Republishing assignment. TaskId: {TaskId}, AssignmentId: {AssignmentId}, CorrelationId: {CorrelationId}",
                    reassignmentEvent.TaskId, alreadyRecorded.AssignmentId, reassignmentEvent.CorrelationId);

                var recordedMember = (await _repository.GetMembersByTeamIdAsync(reassignmentEvent.NewTeamId))
                    .FirstOrDefault(m => m.MemberId == alreadyRecorded.MemberId);
                await PublishTaskAssignedAsync(
                    alreadyRecorded,
                    reassignmentEvent,
                    recordedMember?.FirstName,
                    recordedMember?.LastName,
                    recordedMember?.Email);
                return;
            }

            // Get members from the new team
            var members = await _repository.GetMembersByTeamIdAsync(reassignmentEvent.NewTeamId);
            var membersList = members.ToList();

            if (!membersList.Any())
            {
                _logger.LogError(
                    "No members available in team for reassignment. TaskId: {TaskId}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                    reassignmentEvent.TaskId, reassignmentEvent.NewTeamId, reassignmentEvent.CorrelationId);
                throw new InvalidOperationException($"No members available in team {reassignmentEvent.NewTeamId} for reassignment");
            }

            _logger.LogInformation(
                "Evaluating workload for {MemberCount} team members. TaskId: {TaskId}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                membersList.Count, reassignmentEvent.TaskId, reassignmentEvent.NewTeamId, reassignmentEvent.CorrelationId);

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
                        "Evaluated member for reassignment. MemberId: {MemberId}, MemberName: {MemberName}, TaskCount: {TaskCount}, WorkloadScore: {WorkloadScore}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        member.MemberId, $"{member.FirstName} {member.LastName}", tasksList.Count, workloadScore, reassignmentEvent.TaskId, reassignmentEvent.CorrelationId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex,
                        "Error evaluating workload for member during reassignment. MemberId: {MemberId}, TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                        member.MemberId, reassignmentEvent.TaskId, reassignmentEvent.CorrelationId);
                }
            }

            if (!memberScores.Any())
            {
                _logger.LogError(
                    "No member scores calculated for reassignment. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                    reassignmentEvent.TaskId, reassignmentEvent.CorrelationId);
                throw new InvalidOperationException($"All members failed evaluation for task reassignment: {reassignmentEvent.TaskId}");
            }

            // Select member with lowest workload score (most available)
            var taskPriority = reassignmentEvent.TaskPriority ?? "Medium";

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

            // Prefer the previous holder of this stage. Otherwise the least-loaded member.
            var restoredMember = reassignmentEvent.PreferredMemberId.HasValue
                ? memberScores.FirstOrDefault(ms => ms.Member.MemberId == reassignmentEvent.PreferredMemberId.Value)
                : default;
            var bestMember = restoredMember.Member != null
                ? restoredMember
                : membersWithoutConflict.Any()
                    ? membersWithoutConflict.OrderBy(ms => ms.WorkloadScore).First()
                    : membersWithConflict.OrderBy(ms => ms.WorkloadScore).First();

            if (reassignmentEvent.PreferredMemberId.HasValue && restoredMember.Member == null)
            {
                _logger.LogWarning(
                    "Preferred member is not on the stage team. Using workload selection. TaskId: {TaskId}, PreferredMemberId: {PreferredMemberId}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                    reassignmentEvent.TaskId, reassignmentEvent.PreferredMemberId, reassignmentEvent.NewTeamId, reassignmentEvent.CorrelationId);
            }

            _logger.LogInformation(
                "Selected member for reassignment. MemberId: {MemberId}, MemberName: {MemberName}, WorkloadScore: {WorkloadScore}, RestoredPreviousAssignee: {Restored}, TaskId: {TaskId}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                bestMember.Member.MemberId, $"{bestMember.Member.FirstName} {bestMember.Member.LastName}", bestMember.WorkloadScore, restoredMember.Member != null, reassignmentEvent.TaskId, reassignmentEvent.NewTeamId, reassignmentEvent.CorrelationId);

            var existingAssignment = await _repository.GetAssignmentByTaskIdAsync(reassignmentEvent.TaskId);
            if (existingAssignment != null)
            {
                existingAssignment.EndedAt = DateTime.UtcNow;
                await _repository.UpdateAssignmentAsync(existingAssignment);
            }

            var assignmentReason = restoredMember.Member != null
                ? $"Restored previous assignee on {reassignmentEvent.StageName}"
                : $"Stage reassignment to {reassignmentEvent.StageName}: {bestMember.Reason}";
            if (assignmentReason.Length > 500)
                assignmentReason = assignmentReason[..500];

            var assignment = await _repository.CreateAssignmentAsync(new TaskAssignment
            {
                TaskId = reassignmentEvent.TaskId,
                MemberId = bestMember.Member.MemberId,
                WorkloadScore = bestMember.WorkloadScore,
                AssignmentReason = assignmentReason,
                AssignedAt = DateTime.UtcNow,
                SLAConfiguredEventId = Guid.NewGuid(),
                CorrelationId = reassignmentEvent.CorrelationId
            });

            // Publish TaskAssignedEvent so TaskService updates the task
            var taskAssignedEvent = new TaskAssignedEvent
            {
                AssignmentId = assignment.AssignmentId,
                TaskId = reassignmentEvent.TaskId,
                MemberId = bestMember.Member.MemberId,
                MemberName = $"{bestMember.Member.FirstName} {bestMember.Member.LastName}",
                MemberEmail = bestMember.Member.Email,
                WorkloadScore = bestMember.WorkloadScore,
                AssignedAt = DateTime.UtcNow,
                StageId = reassignmentEvent.StageId,
                StageName = reassignmentEvent.StageName,
                StageOrder = reassignmentEvent.StageOrder,
                CorrelationId = reassignmentEvent.CorrelationId
            };

            await _eventBus.PublishAsync(
                taskAssignedEvent,
                EventBusConstants.WorkloadSource,
                EventBusConstants.TaskAssigned,
                reassignmentEvent.CorrelationId);

            _logger.LogInformation(
                "Task reassigned to new team member. TaskId: {TaskId}, NewMemberId: {NewMemberId}, PreviousMemberId: {PreviousMemberId}, NewTeamId: {TeamId}, StageName: {StageName}, CorrelationId: {CorrelationId}",
                reassignmentEvent.TaskId, bestMember.Member.MemberId, reassignmentEvent.PreviousMemberId, reassignmentEvent.NewTeamId, reassignmentEvent.StageName, reassignmentEvent.CorrelationId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Error reassigning task. TaskId: {TaskId}, TeamId: {TeamId}, CorrelationId: {CorrelationId}",
                reassignmentEvent.TaskId, reassignmentEvent.NewTeamId, reassignmentEvent.CorrelationId);
            throw;
        }
    }

    private async System.Threading.Tasks.Task PublishTaskAssignedAsync(
        TaskAssignment assignment,
        TaskStageReassignmentNeededEvent reassignmentEvent,
        string? firstName,
        string? lastName,
        string? email)
    {
        var memberName = $"{firstName} {lastName}".Trim();
        if (string.IsNullOrEmpty(memberName))
            memberName = assignment.MemberId.ToString();

        var taskAssignedEvent = new TaskAssignedEvent
        {
            AssignmentId = assignment.AssignmentId,
            TaskId = reassignmentEvent.TaskId,
            MemberId = assignment.MemberId,
            MemberName = memberName,
            MemberEmail = email ?? string.Empty,
            WorkloadScore = assignment.WorkloadScore,
            AssignedAt = DateTime.UtcNow,
            StageId = reassignmentEvent.StageId,
            StageName = reassignmentEvent.StageName,
            StageOrder = reassignmentEvent.StageOrder,
            CorrelationId = reassignmentEvent.CorrelationId
        };

        await _eventBus.PublishAsync(
            taskAssignedEvent,
            EventBusConstants.WorkloadSource,
            EventBusConstants.TaskAssigned,
            reassignmentEvent.CorrelationId);
    }
}

