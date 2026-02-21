using AutoMapper;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Team mappings
        CreateMap<Team, TeamReadDto>();
        CreateMap<TeamCreateDto, Team>();
        CreateMap<TeamUpdateDto, Team>();

        // Member mappings
        CreateMap<Member, MemberReadDto>()
            .ForMember(dest => dest.TeamName, opt => opt.Ignore());
        CreateMap<MemberCreateDto, Member>();
        CreateMap<MemberUpdateDto, Member>();

        // Workflow mappings
        CreateMap<Workflow, WorkflowReadDto>()
            .ForMember(dest => dest.TeamName, opt => opt.Ignore());
        CreateMap<WorkflowCreateDto, Workflow>();
        CreateMap<WorkflowUpdateDto, Workflow>();

        // Stage mappings
        CreateMap<Stage, StageReadDto>()
            .ForMember(dest => dest.TeamName, opt => opt.Ignore());
        CreateMap<StageCreateDto, Stage>();
        CreateMap<StageUpdateDto, Stage>();

        // Task mappings
        CreateMap<Models.Task, TaskReadDto>()
            .ForMember(dest => dest.StageName, opt => opt.Ignore())
            .ForMember(dest => dest.AssignedToMemberName, opt => opt.Ignore());
        CreateMap<TaskCreateDto, Models.Task>()
            .ForMember(dest => dest.TaskId, opt => opt.MapFrom(src => src.TaskId ?? Guid.NewGuid()));
        CreateMap<TaskUpdateDto, Models.Task>()
            .ForMember(dest => dest.WorkflowId, opt => opt.Ignore())  // Preserve WorkflowId - not in update DTO
            .ForMember(dest => dest.TaskId, opt => opt.Ignore())      // Preserve TaskId - not in update DTO
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore());   // Preserve CreatedAt - not updatable
    }
}

