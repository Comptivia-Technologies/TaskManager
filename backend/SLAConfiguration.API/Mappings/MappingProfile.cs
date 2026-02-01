using AutoMapper;
using SLAConfiguration.API.DTOs;
using SLAConfiguration.API.Models;

namespace SLAConfiguration.API.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // SLA Configuration mappings
        CreateMap<Models.SLAConfiguration, SLAConfigurationReadDto>()
            .ForMember(dest => dest.WorkflowName, opt => opt.Ignore())
            .ForMember(dest => dest.PriorityLevels, opt => opt.Ignore());
    }
}

