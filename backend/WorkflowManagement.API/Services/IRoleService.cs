using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Services;

public interface IRoleService
{
    Task<IEnumerable<RoleReadDto>> GetAllAsync();
    Task<RoleReadDto?> GetByIdAsync(Guid roleId);
    Task<RoleReadDto> CreateAsync(RoleCreateDto dto);
    Task<RoleReadDto?> UpdateAsync(Guid roleId, RoleUpdateDto dto);
    Task<bool> DeleteAsync(Guid roleId);
}
