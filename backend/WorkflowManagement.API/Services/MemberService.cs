using AutoMapper;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Mappings;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class MemberService : IMemberService
{
    private readonly IMemberRepository _memberRepository;
    private readonly ITeamRepository _teamRepository;
    private readonly ITaskRepository _taskRepository;
    private readonly IMapper _mapper;

    public MemberService(IMemberRepository memberRepository, ITeamRepository teamRepository, ITaskRepository taskRepository, IMapper mapper)
    {
        _memberRepository = memberRepository;
        _teamRepository = teamRepository;
        _taskRepository = taskRepository;
        _mapper = mapper;
    }

    public async Task<IEnumerable<MemberReadDto>> GetAllMembersAsync()
    {
        var members = await _memberRepository.GetMembersWithTeamAsync();
        var memberDtos = _mapper.Map<IEnumerable<MemberReadDto>>(members).ToList();

        foreach (var memberDto in memberDtos)
        {
            var member = members.FirstOrDefault(m => m.MemberId == memberDto.MemberId);
            if (member?.Team != null)
                memberDto.TeamName = member.Team.TeamName;
        }

        return memberDtos;
    }

    public async Task<MemberReadDto?> GetMemberByIdAsync(Guid id)
    {
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null) return null;

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
        if (memberCreateDto.TeamId.HasValue && memberCreateDto.TeamId.Value != Guid.Empty)
        {
            var team = await _teamRepository.GetByIdAsync(memberCreateDto.TeamId.Value);
            if (team == null)
                throw new ArgumentException("Team does not exist.");
        }

        var member = _mapper.Map<Member>(memberCreateDto);
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
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null) return null;

        if (memberUpdateDto.TeamId.HasValue && memberUpdateDto.TeamId.Value != Guid.Empty)
        {
            var team = await _teamRepository.GetByIdAsync(memberUpdateDto.TeamId.Value);
            if (team == null)
                throw new ArgumentException("Team does not exist.");
        }

        _mapper.Map(memberUpdateDto, member);
        if (member.TeamId.HasValue && member.TeamId.Value == Guid.Empty)
            member.TeamId = null;
        if (member.CreatedAt.Kind == DateTimeKind.Unspecified)
            member.CreatedAt = DateTime.SpecifyKind(member.CreatedAt, DateTimeKind.Utc);
        else if (member.CreatedAt.Kind != DateTimeKind.Utc)
            member.CreatedAt = member.CreatedAt.ToUniversalTime();
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
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null) return false;
        return await _memberRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId)
    {
        var tasks = (await _taskRepository.GetTasksByMemberAsync(memberId)).ToList();
        return TaskReadDtoEnricher.MapList(_mapper, tasks);
    }
}
