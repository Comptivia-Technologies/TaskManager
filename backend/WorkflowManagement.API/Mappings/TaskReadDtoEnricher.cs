using AutoMapper;
using WorkflowManagement.API.DTOs;

namespace WorkflowManagement.API.Mappings;

public static class TaskReadDtoEnricher
{
    public static void Enrich(TaskReadDto dto, Models.Task task)
    {
        if (task.Stage != null) dto.StageName = task.Stage.StageName;
        if (task.Workflow != null) dto.WorkflowName = task.Workflow.WorkflowName;
        if (task.AssignedToMember != null)
            dto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
    }

    public static List<TaskReadDto> MapList(IMapper mapper, List<Models.Task> tasks)
    {
        var dtos = mapper.Map<List<TaskReadDto>>(tasks);
        for (var i = 0; i < dtos.Count; i++)
            Enrich(dtos[i], tasks[i]);
        return dtos;
    }
}
