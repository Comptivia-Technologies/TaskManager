using AutoMapper;

namespace TaskManager.API.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Currently TaskManagerService constructs read DTOs manually.
        // This profile is reserved for future mappings if needed to stay consistent with other APIs.
    }
}


