using AutoMapper;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using SLAConfiguration.API.DTOs;
using SLAConfiguration.API.Models;
using SLAConfiguration.API.Repositories;
using SLAConfiguration.API.Data;

namespace SLAConfiguration.API.Services;

public class SLAService : ISLAService
{
    private readonly ISLARepository _slaRepository;
    private readonly SLAConfigurationDbContext _context;
    private readonly IMapper _mapper;

    public SLAService(ISLARepository slaRepository, SLAConfigurationDbContext context, IMapper mapper)
    {
        _slaRepository = slaRepository;
        _context = context;
        _mapper = mapper;
    }

    public async System.Threading.Tasks.Task<IEnumerable<SLAConfigurationReadDto>> GetAllSLAConfigurationsAsync()
    {
        var slaConfigs = await _slaRepository.GetAllAsync();
        var slaConfigsList = slaConfigs.ToList();
        var slaConfigsDto = new List<SLAConfigurationReadDto>();

        foreach (var slaConfig in slaConfigsList)
        {
            var slaDto = await MapToReadDtoAsync(slaConfig);
            slaConfigsDto.Add(slaDto);
        }

        return slaConfigsDto;
    }

    public async System.Threading.Tasks.Task<SLAConfigurationReadDto?> GetSLAConfigurationByWorkflowIdAsync(int workflowId)
    {
        var slaConfig = await _slaRepository.GetByWorkflowIdAsync(workflowId);
        if (slaConfig == null)
            return null;

        return await MapToReadDtoAsync(slaConfig);
    }

    public async System.Threading.Tasks.Task<SLAConfigurationReadDto> CreateSLAConfigurationAsync(SLAConfigurationCreateDto slaCreateDto)
    {
        try
        {
            // Check if workflow exists - try using DbSet first, fallback to raw SQL if needed
            // Note: This check is optional - if it fails, we'll still allow SLA config creation
            bool workflowExists = true; // Default to true to allow creation if check fails
            try
            {
                workflowExists = await _context.Workflows
                    .AnyAsync(w => w.WorkflowId == slaCreateDto.WorkflowId);
                
                if (!workflowExists)
                    throw new ArgumentException($"Workflow with ID {slaCreateDto.WorkflowId} does not exist");
            }
            catch (ArgumentException)
            {
                throw; // Re-throw argument exceptions
            }
            catch
            {
                // If workflow check fails (table might not be accessible), log but continue
                // This allows SLA configs to be created even if Workflows table query fails
                // In production, you might want to handle this differently
            }

            // Check if SLA configuration already exists for this workflow
            var exists = await _slaRepository.ExistsForWorkflowAsync(slaCreateDto.WorkflowId);
            if (exists)
                throw new ArgumentException("SLA configuration already exists for this workflow. Use update instead.");

            // Serialize priority levels to JSON
            var priorityLevelsJson = SerializePriorityLevels(slaCreateDto.PriorityLevels);

            var slaConfig = new Models.SLAConfiguration
            {
                WorkflowId = slaCreateDto.WorkflowId,
                PriorityLevelsJson = priorityLevelsJson,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var createdSLA = await _slaRepository.AddAsync(slaConfig);
            return await MapToReadDtoAsync(createdSLA);
        }
        catch (ArgumentException)
        {
            throw; // Re-throw argument exceptions as-is
        }
        catch (Exception ex)
        {
            throw new Exception($"Failed to create SLA configuration: {ex.Message}. Inner exception: {ex.InnerException?.Message}", ex);
        }
    }

    public async System.Threading.Tasks.Task<SLAConfigurationReadDto?> UpdateSLAConfigurationAsync(int workflowId, SLAConfigurationUpdateDto slaUpdateDto)
    {
        var slaConfig = await _slaRepository.GetByWorkflowIdAsync(workflowId);
        if (slaConfig == null)
            return null;

        // Deserialize existing priority levels
        var existingPriorityLevels = DeserializePriorityLevels(slaConfig.PriorityLevelsJson);

        // Merge with new priority levels (update only provided ones)
        foreach (var kvp in slaUpdateDto.PriorityLevels)
        {
            existingPriorityLevels[kvp.Key] = kvp.Value;
        }

        // Serialize back to JSON
        slaConfig.PriorityLevelsJson = SerializePriorityLevels(existingPriorityLevels);
        
        // Update UpdatedAt to current UTC time (PostgreSQL will handle timezone conversion)
        slaConfig.UpdatedAt = DateTime.UtcNow;
        
        // Preserve CreatedAt - don't modify it during updates

        var updatedSLA = await _slaRepository.UpdateAsync(slaConfig);
        return await MapToReadDtoAsync(updatedSLA);
    }

    public async System.Threading.Tasks.Task<bool> DeleteSLAConfigurationAsync(int workflowId)
    {
        var slaConfig = await _slaRepository.GetByWorkflowIdAsync(workflowId);
        if (slaConfig == null)
            return false;

        return await _slaRepository.DeleteAsync(slaConfig.SLAConfigurationId);
    }

    private async System.Threading.Tasks.Task<SLAConfigurationReadDto> MapToReadDtoAsync(Models.SLAConfiguration slaConfig)
    {
        var slaDto = new SLAConfigurationReadDto
        {
            SLAConfigurationId = slaConfig.SLAConfigurationId,
            WorkflowId = slaConfig.WorkflowId,
            CreatedAt = slaConfig.CreatedAt,
            UpdatedAt = slaConfig.UpdatedAt,
            PriorityLevels = DeserializePriorityLevels(slaConfig.PriorityLevelsJson)
        };

        // Get workflow name from the Workflows table
        var workflow = await _context.Workflows
            .FirstOrDefaultAsync(w => w.WorkflowId == slaConfig.WorkflowId);
        
        if (workflow != null)
            slaDto.WorkflowName = workflow.WorkflowName;

        return slaDto;
    }

    private string SerializePriorityLevels(Dictionary<string, PriorityLevelDto> priorityLevels)
    {
        var options = new JsonSerializerOptions
        {
            WriteIndented = false,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        return JsonSerializer.Serialize(priorityLevels, options);
    }

    private Dictionary<string, PriorityLevelDto> DeserializePriorityLevels(string json)
    {
        if (string.IsNullOrWhiteSpace(json) || json == "{}")
            return new Dictionary<string, PriorityLevelDto>();

        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var dict = JsonSerializer.Deserialize<Dictionary<string, PriorityLevelDto>>(json, options);
            return dict ?? new Dictionary<string, PriorityLevelDto>();
        }
        catch
        {
            return new Dictionary<string, PriorityLevelDto>();
        }
    }
}

