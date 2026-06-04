using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class TaskAuditService : ITaskAuditService
{
    private readonly ITaskAuditRepository _auditRepository;
    private readonly ITaskRepository _taskRepository;
    private readonly IMemberRepository _memberRepository;

    public TaskAuditService(
        ITaskAuditRepository auditRepository,
        ITaskRepository taskRepository,
        IMemberRepository memberRepository)
    {
        _auditRepository = auditRepository;
        _taskRepository = taskRepository;
        _memberRepository = memberRepository;
    }

    public async Task<IEnumerable<TaskAuditEntryReadDto>> GetAuditByTaskIdAsync(Guid taskId)
    {
        var entries = await _auditRepository.GetByTaskIdAsync(taskId);
        var list = entries.ToList();
        if (list.Count == 0)
            return Enumerable.Empty<TaskAuditEntryReadDto>();

        var memberIds = list
            .SelectMany(e => new[] { e.MemberId, e.FromMemberId, e.ToMemberId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var members = await _memberRepository.GetAllAsync();
        var memberNames = members
            .Where(m => memberIds.Contains(m.MemberId))
            .ToDictionary(m => m.MemberId, m => $"{m.FirstName} {m.LastName}".Trim());

        return list.Select(e => MapToReadDto(e, memberNames));
    }

    public async Task<TaskAuditEntryReadDto?> RecordAuditEntryAsync(Guid taskId, TaskAuditEntryCreateDto dto)
    {
        var task = await _taskRepository.GetByIdAsync(taskId);
        if (task == null)
            return null;

        var existing = await _auditRepository.GetByEventIdAsync(dto.EventId);
        if (existing != null)
            return await MapExistingAsync(existing);

        var occurredAt = dto.OccurredAt ?? DateTime.UtcNow;
        if (occurredAt.Kind == DateTimeKind.Unspecified)
            occurredAt = DateTime.SpecifyKind(occurredAt, DateTimeKind.Utc);
        else if (occurredAt.Kind != DateTimeKind.Utc)
            occurredAt = occurredAt.ToUniversalTime();

        var entry = new TaskAuditEntry
        {
            TaskId = taskId,
            EventId = dto.EventId,
            ActionType = dto.ActionType,
            MemberId = dto.MemberId,
            FromMemberId = dto.FromMemberId,
            ToMemberId = dto.ToMemberId,
            StageId = dto.StageId,
            StageName = dto.StageName,
            NextStageId = dto.NextStageId,
            NextStageName = dto.NextStageName,
            Reason = dto.Reason,
            CorrelationId = dto.CorrelationId,
            OccurredAt = occurredAt
        };

        var created = await _auditRepository.AddAsync(entry);
        return await MapExistingAsync(created);
    }

    private async Task<TaskAuditEntryReadDto> MapExistingAsync(TaskAuditEntry entry)
    {
        var memberIds = new[] { entry.MemberId, entry.FromMemberId, entry.ToMemberId }
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var members = await _memberRepository.GetAllAsync();
        var memberNames = members
            .Where(m => memberIds.Contains(m.MemberId))
            .ToDictionary(m => m.MemberId, m => $"{m.FirstName} {m.LastName}".Trim());

        return MapToReadDto(entry, memberNames);
    }

    private static TaskAuditEntryReadDto MapToReadDto(
        TaskAuditEntry entry,
        IReadOnlyDictionary<Guid, string> memberNames)
    {
        return new TaskAuditEntryReadDto
        {
            AuditId = entry.AuditId,
            TaskId = entry.TaskId,
            ActionType = entry.ActionType,
            MemberId = entry.MemberId,
            MemberName = ResolveName(entry.MemberId, memberNames),
            FromMemberId = entry.FromMemberId,
            FromMemberName = ResolveName(entry.FromMemberId, memberNames),
            ToMemberId = entry.ToMemberId,
            ToMemberName = ResolveName(entry.ToMemberId, memberNames),
            StageId = entry.StageId,
            StageName = entry.StageName,
            NextStageId = entry.NextStageId,
            NextStageName = entry.NextStageName,
            Reason = entry.Reason,
            CorrelationId = entry.CorrelationId,
            OccurredAt = entry.OccurredAt
        };
    }

    private static string? ResolveName(Guid? memberId, IReadOnlyDictionary<Guid, string> memberNames)
    {
        if (!memberId.HasValue) return null;
        return memberNames.TryGetValue(memberId.Value, out var name) ? name : null;
    }
}
