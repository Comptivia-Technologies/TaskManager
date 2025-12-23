using TaskManager.API.DTOs;
using TaskManager.API.External;

namespace TaskManager.API.Services;

public interface ITaskAssignmentService
{
    Task<(ExternalWorkflowReadDto workflow, ExternalSlaConfigurationReadDto? slaConfig, string slaPriorityKey)> AssignWorkflowAndSlaAsync(TaskManagerTaskCreateDto taskDto, CancellationToken cancellationToken = default);
}


