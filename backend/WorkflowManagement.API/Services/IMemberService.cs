using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IMemberService
{
    Task<IEnumerable<MemberReadDto>> GetAllMembersAsync();
    Task<MemberReadDto?> GetMemberByIdAsync(Guid id);
    Task<MemberReadDto> CreateMemberAsync(MemberCreateDto memberCreateDto);
    Task<MemberReadDto?> UpdateMemberAsync(Guid id, MemberUpdateDto memberUpdateDto);
    Task<bool> DeleteMemberAsync(Guid id);
    Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId);
}



