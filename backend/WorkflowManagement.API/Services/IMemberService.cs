using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IMemberService
{
    Task<IEnumerable<MemberReadDto>> GetAllMembersAsync();
    Task<MemberReadDto?> GetMemberByIdAsync(int id);
    Task<MemberReadDto> CreateMemberAsync(MemberCreateDto memberCreateDto);
    Task<MemberReadDto?> UpdateMemberAsync(int id, MemberUpdateDto memberUpdateDto);
    Task<bool> DeleteMemberAsync(int id);
    Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(int memberId);
}



