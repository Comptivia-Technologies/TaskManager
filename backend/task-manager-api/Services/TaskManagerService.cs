using System.Text.Json;
using AutoMapper;
using TaskManager.API.DTOs;
using TaskManager.API.Models;
using TaskManager.API.Repositories;

namespace TaskManager.API.Services;

public class TaskManagerService : ITaskManagerService
{
    private readonly ITaskManagerTaskRepository _taskRepository;
    private readonly ITaskAssignmentService _assignmentService;
    private readonly IMapper _mapper;
    private readonly ILogger<TaskManagerService> _logger;

    public TaskManagerService(
        ITaskManagerTaskRepository taskRepository,
        ITaskAssignmentService assignmentService,
        IMapper mapper,
        ILogger<TaskManagerService> logger)
    {
        _taskRepository = taskRepository;
        _assignmentService = assignmentService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<IEnumerable<TaskManagerTaskReadDto>> GetAllTasksAsync()
    {
        var tasks = await _taskRepository.GetAllAsync();
        return tasks.Select(MapToReadDto);
    }

    public async Task<TaskManagerTaskReadDto?> GetTaskByIdAsync(int id)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null)
        {
            return null;
        }

        return MapToReadDto(task);
    }

    public async Task<TaskManagerTaskReadDto> CreateTaskAsync(TaskManagerTaskCreateDto createDto)
    {
        // 1. Evaluate workflow and SLA using rule-based engine
        var (workflow, slaConfig, slaPriorityKey) = await _assignmentService.AssignWorkflowAndSlaAsync(createDto);

        // 2. Prepare entity
        var entity = new TaskManagerTask
        {
            Title = createDto.Title,
            Description = createDto.Description,
            Priority = createDto.Priority,
            Status = "Open",
            ExternalTaskId = createDto.ExternalTaskId,
            PayloadJson = createDto.Payload != null
                ? JsonSerializer.Serialize(createDto.Payload)
                : "{}",
            WorkflowId = workflow.WorkflowId,
            WorkflowName = workflow.WorkflowName,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        if (slaConfig != null && slaConfig.PriorityLevels.TryGetValue(slaPriorityKey, out var level))
        {
            entity.SlaConfigurationId = slaConfig.SlaConfigurationId;
            entity.SlaPriority = slaPriorityKey;
            entity.SlaResponseTimeMinutes = level.ResponseTime;
            // Simple derivation for resolution time: 2x response time (can be refined later)
            entity.SlaResolutionTimeMinutes = level.ResponseTime * 2;
        }

        // 3. Persist
        var saved = await _taskRepository.AddAsync(entity);

        _logger.LogInformation(
            "Created managed task {TaskId} for workflow {WorkflowId} ({WorkflowName}) with priority {Priority}",
            saved.TaskId,
            saved.WorkflowId,
            saved.WorkflowName,
            saved.Priority);

        // 4. Map to read DTO
        return MapToReadDto(saved);
    }

    private static TaskManagerTaskReadDto MapToReadDto(TaskManagerTask task)
    {
        object? payload = null;
        try
        {
            if (!string.IsNullOrWhiteSpace(task.PayloadJson))
            {
                payload = JsonSerializer.Deserialize<object>(task.PayloadJson);
            }
        }
        catch
        {
            // In case of invalid JSON, expose raw string
            payload = task.PayloadJson;
        }

        return new TaskManagerTaskReadDto
        {
            TaskId = task.TaskId,
            Title = task.Title,
            Description = task.Description,
            Status = task.Status,
            Priority = task.Priority,
            ExternalTaskId = task.ExternalTaskId,
            Payload = payload,
            WorkflowId = task.WorkflowId,
            WorkflowName = task.WorkflowName,
            SlaConfigurationId = task.SlaConfigurationId,
            SlaPriority = task.SlaPriority,
            SlaResponseTimeMinutes = task.SlaResponseTimeMinutes,
            SlaResolutionTimeMinutes = task.SlaResolutionTimeMinutes,
            CreatedAt = task.CreatedAt,
            UpdatedAt = task.UpdatedAt
        };
    }
}


