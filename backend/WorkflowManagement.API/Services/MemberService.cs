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

    public async Task<MemberReadDto?> GetMemberByIdAsync(int id)
    {
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null)
            return null;

        var team = await _teamRepository.GetByIdAsync(member.TeamId);
        var memberDto = _mapper.Map<MemberReadDto>(member);
        if (team != null)
            memberDto.TeamName = team.TeamName;

        return memberDto;
    }

    public async Task<MemberReadDto> CreateMemberAsync(MemberCreateDto memberCreateDto)
    {
        if (!await _teamRepository.ExistsAsync(memberCreateDto.TeamId))
            throw new ArgumentException("Team does not exist");

        var member = _mapper.Map<Member>(memberCreateDto);
        member.CreatedAt = DateTime.UtcNow;
        member.UpdatedAt = DateTime.UtcNow;

        var createdMember = await _memberRepository.AddAsync(member);
        var team = await _teamRepository.GetByIdAsync(createdMember.TeamId);
        var memberDto = _mapper.Map<MemberReadDto>(createdMember);
        if (team != null)
            memberDto.TeamName = team.TeamName;

        return memberDto;
    }

    public async Task<MemberReadDto?> UpdateMemberAsync(int id, MemberUpdateDto memberUpdateDto)
    {
        var member = await _memberRepository.GetByIdAsync(id);
        if (member == null)
            return null;

        if (!await _teamRepository.ExistsAsync(memberUpdateDto.TeamId))
            throw new ArgumentException("Team does not exist");

        _mapper.Map(memberUpdateDto, member);
        member.UpdatedAt = DateTime.UtcNow;

        var updatedMember = await _memberRepository.UpdateAsync(member);
        var team = await _teamRepository.GetByIdAsync(updatedMember.TeamId);
        var memberDto = _mapper.Map<MemberReadDto>(updatedMember);
        if (team != null)
            memberDto.TeamName = team.TeamName;

        return memberDto;
    }

    public async Task<bool> DeleteMemberAsync(int id)
    {
        return await _memberRepository.DeleteAsync(id);
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(int memberId)
    {
        var tasks = await _taskRepository.GetTasksByMemberAsync(memberId);
        return _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
    }
}

