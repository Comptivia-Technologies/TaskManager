using SLAConfiguration.API.DTOs;

namespace SLAConfiguration.API.Services;

public interface ISLAService
{
    System.Threading.Tasks.Task<IEnumerable<SLAConfigurationReadDto>> GetAllSLAConfigurationsAsync();
    System.Threading.Tasks.Task<SLAConfigurationReadDto?> GetSLAConfigurationByWorkflowIdAsync(int workflowId);
    System.Threading.Tasks.Task<SLAConfigurationReadDto> CreateSLAConfigurationAsync(SLAConfigurationCreateDto slaCreateDto);
    System.Threading.Tasks.Task<SLAConfigurationReadDto?> UpdateSLAConfigurationAsync(int workflowId, SLAConfigurationUpdateDto slaUpdateDto);
    System.Threading.Tasks.Task<bool> DeleteSLAConfigurationAsync(int workflowId);
}

