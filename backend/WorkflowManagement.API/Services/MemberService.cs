using AutoMapper;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class MemberService : IMemberService
{
    private readonly IMemberRepository _memberRepository;
    private readonly ITeamRepository _teamRepository;
    private readonly ITaskRepository _taskRepository;
    private readonly ICurrentOrganizationAccessor _orgAccessor;
    private readonly IMapper _mapper;

    public MemberService(IMemberRepository memberRepository, ITeamRepository teamRepository, ITaskRepository taskRepository, ICurrentOrganizationAccessor orgAccessor, IMapper mapper)
    {
        _memberRepository = memberRepository;
        _teamRepository = teamRepository;
        _taskRepository = taskRepository;
        _orgAccessor = orgAccessor;
        _mapper = mapper;
    }

    public async Task<IEnumerable<MemberReadDto>> GetAllMembersAsync()
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var members = await _memberRepository.GetMembersWithTeamByOrganizationAsync(orgId.Value);
        var memberDtos = _mapper.Map<IEnumerable<MemberReadDto>>(members).ToList();
        
        // Populate team names from the included Team navigation property
        foreach (var memberDto in memberDtos)
        {
            var member = members.FirstOrDefault(m => m.MemberId == memberDto.MemberId);
            if (member?.Team != null)
            {
                memberDto.TeamName = member.Team.TeamName;
            }
        }
        
        return memberDtos;
    }

    public async Task<MemberReadDto?> GetMemberByIdAsync(Guid id)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null || member.OrganizationId != orgId.Value)
            return null;

        var team = member.TeamId.HasValue 
            ? await _teamRepository.GetByIdAsync(member.TeamId.Value) 
            : null;
        var memberDto = _mapper.Map<MemberReadDto>(member);
        if (team != null)
            memberDto.TeamName = team.TeamName;

        return memberDto;
    }

    // Two members sharing a UserId would make the login-to-member lookup ambiguous.
    private async System.Threading.Tasks.Task EnsureUserIdIsUnclaimedAsync(string? userId, Guid orgId, Guid? excludingMemberId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return;

        var existing = await _memberRepository.GetByUserIdAsync(userId, orgId);
        if (existing != null && existing.MemberId != excludingMemberId)
            throw new ArgumentException("That login is already linked to another member.");
    }

    public async Task<MemberReadDto?> GetMemberByUserIdAsync(string userId)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");

        var member = await _memberRepository.GetByUserIdAsync(userId, orgId.Value);
        if (member == null)
            return null;

        var team = member.TeamId.HasValue
            ? await _teamRepository.GetByIdAsync(member.TeamId.Value)
            : null;
        var memberDto = _mapper.Map<MemberReadDto>(member);
        if (team != null)
            memberDto.TeamName = team.TeamName;

        return memberDto;
    }

    public async Task<MemberReadDto> CreateMemberAsync(MemberCreateDto memberCreateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        if (memberCreateDto.TeamId.HasValue && memberCreateDto.TeamId.Value != Guid.Empty)
        {
            var team = await _teamRepository.GetByIdAsync(memberCreateDto.TeamId.Value);
            if (team == null || team.OrganizationId != orgId.Value)
                throw new ArgumentException("Team does not exist or does not belong to your organization.");
        }

        await EnsureUserIdIsUnclaimedAsync(memberCreateDto.UserId, orgId.Value, null);

        var member = _mapper.Map<Member>(memberCreateDto);
        member.OrganizationId = orgId.Value;
        if (member.TeamId.HasValue && member.TeamId.Value == Guid.Empty)
            member.TeamId = null;
        member.CreatedAt = DateTime.UtcNow;
        member.UpdatedAt = DateTime.UtcNow;

        var createdMember = await _memberRepository.AddAsync(member);
        var createdTeam = createdMember.TeamId.HasValue 
            ? await _teamRepository.GetByIdAsync(createdMember.TeamId.Value) 
            : null;
        var memberDto = _mapper.Map<MemberReadDto>(createdMember);
        if (createdTeam != null)
            memberDto.TeamName = createdTeam.TeamName;

        return memberDto;
    }

    public async Task<MemberReadDto?> UpdateMemberAsync(Guid id, MemberUpdateDto memberUpdateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null || member.OrganizationId != orgId.Value)
            return null;
        if (memberUpdateDto.TeamId.HasValue && memberUpdateDto.TeamId.Value != Guid.Empty)
        {
            var team = await _teamRepository.GetByIdAsync(memberUpdateDto.TeamId.Value);
            if (team == null || team.OrganizationId != orgId.Value)
                throw new ArgumentException("Team does not exist or does not belong to your organization.");
        }

        await EnsureUserIdIsUnclaimedAsync(memberUpdateDto.UserId, orgId.Value, id);

        // A member belongs to exactly one team. Moving straight from one team to
        // another would quietly take them off the first, so the current team must be
        // cleared first and the move made deliberately in two steps.
        var incomingTeamId = memberUpdateDto.TeamId == Guid.Empty ? null : memberUpdateDto.TeamId;
        if (incomingTeamId.HasValue &&
            member.TeamId.HasValue &&
            member.TeamId.Value != incomingTeamId.Value)
        {
            throw new ArgumentException(
                "That member is already on another team. Remove them from it before adding them here.");
        }

        var existingUserId = member.UserId;
        _mapper.Map(memberUpdateDto, member);
        if (string.IsNullOrWhiteSpace(memberUpdateDto.UserId))
        {
            member.UserId = existingUserId;
        }
        // Ensure TeamId is null if it's empty
        if (member.TeamId.HasValue && member.TeamId.Value == Guid.Empty)
        {
            member.TeamId = null;
        }
        // Ensure CreatedAt is UTC (PostgreSQL requires UTC for timestamp with time zone)
        if (member.CreatedAt.Kind == DateTimeKind.Unspecified)
        {
            member.CreatedAt = DateTime.SpecifyKind(member.CreatedAt, DateTimeKind.Utc);
        }
        else if (member.CreatedAt.Kind != DateTimeKind.Utc)
        {
            member.CreatedAt = member.CreatedAt.ToUniversalTime();
        }
        member.UpdatedAt = DateTime.UtcNow;

        var updatedMember = await _memberRepository.UpdateAsync(member);
        var updatedTeam = updatedMember.TeamId.HasValue 
            ? await _teamRepository.GetByIdAsync(updatedMember.TeamId.Value) 
            : null;
        var memberDto = _mapper.Map<MemberReadDto>(updatedMember);
        if (updatedTeam != null)
            memberDto.TeamName = updatedTeam.TeamName;

        return memberDto;
    }

    public async Task<bool> DeleteMemberAsync(Guid id)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null || member.OrganizationId != orgId.Value)
            return false;
        return await _memberRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId)
    {
        var tasks = await _taskRepository.GetTasksByMemberAsync(memberId);
        return _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
    }
}

