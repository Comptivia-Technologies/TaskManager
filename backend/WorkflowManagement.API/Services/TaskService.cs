using AutoMapper;
using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Repositories;

namespace WorkflowManagement.API.Services;

public class TaskService : ITaskService
{
    private readonly ITaskRepository _taskRepository;
    private readonly IWorkflowRepository _workflowRepository;
    private readonly IStageRepository _stageRepository;
    private readonly IMemberRepository _memberRepository;
    private readonly IWorkflowService _workflowService;
    private readonly IMapper _mapper;
    private readonly ILogger<TaskService> _logger;

    public TaskService(
        ITaskRepository taskRepository,
        IWorkflowRepository workflowRepository,
        IStageRepository stageRepository,
        IMemberRepository memberRepository,
        IWorkflowService workflowService,
        IMapper mapper,
        ILogger<TaskService> logger)
    {
        _taskRepository = taskRepository;
        _workflowRepository = workflowRepository;
        _stageRepository = stageRepository;
        _memberRepository = memberRepository;
        _workflowService = workflowService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<TaskReadDto> CreateTaskAsync(TaskCreateDto taskCreateDto)
    {
        var workflow = await _workflowRepository.GetByIdAsync(taskCreateDto.WorkflowId);
        if (workflow == null)
            throw new ArgumentException("Workflow does not exist.");
        if (taskCreateDto.StageId.HasValue)
        {
            var stage = await _stageRepository.GetByIdAsync(taskCreateDto.StageId.Value);
            if (stage == null)
                throw new ArgumentException("Stage does not exist.");
        }
        if (taskCreateDto.AssignedToMemberId.HasValue)
        {
            var member = await _memberRepository.GetByIdAsync(taskCreateDto.AssignedToMemberId.Value);
            if (member == null)
                throw new ArgumentException("Member does not exist.");
        }

        var task = _mapper.Map<Models.Task>(taskCreateDto);
        if (taskCreateDto.TaskId.HasValue)
            task.TaskId = taskCreateDto.TaskId.Value;

        if (task.DueDate.HasValue)
        {
            var dueDate = task.DueDate.Value;
            task.DueDate = dueDate.Kind switch
            {
                DateTimeKind.Unspecified => DateTime.SpecifyKind(dueDate, DateTimeKind.Utc),
                DateTimeKind.Utc => dueDate,
                _ => dueDate.ToUniversalTime()
            };
        }

        task.CreatedAt = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;

        var createdTask = await _taskRepository.AddAsync(task);
        try { await _workflowService.UpdateWorkflowJsonAsync(createdTask.WorkflowId); } catch { }

        return await MapTaskWithDetailsAsync(createdTask.TaskId) ?? _mapper.Map<TaskReadDto>(createdTask);
    }

    public async Task<IEnumerable<TaskReadDto>> GetAllTasksAsync()
    {
        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        return MapTaskList(tasks.ToList());
    }

    public async Task<PaginatedTasksResponseDto> GetTasksPaginatedAsync(string? priority, int page, int limit)
    {
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100;

        var (tasks, totalCount) = await _taskRepository.GetTasksWithDetailsPaginatedAsync(priority, page, limit);
        var tasksDto = MapTaskList(tasks.ToList());
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)limit);

        return new PaginatedTasksResponseDto
        {
            Data = tasksDto,
            TotalCount = totalCount,
            Page = page,
            Limit = limit,
            TotalPages = totalPages
        };
    }

    public async Task<TaskReadDto?> GetTaskByIdAsync(Guid id)
    {
        return await MapTaskWithDetailsAsync(id);
    }

    public async Task<TaskReadDto?> UpdateTaskAsync(Guid id, TaskUpdateDto taskUpdateDto)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null) return null;

        if (taskUpdateDto.StageId.HasValue)
        {
            var stage = await _stageRepository.GetByIdAsync(taskUpdateDto.StageId.Value);
            if (stage == null)
                throw new ArgumentException("Stage does not exist.");
        }
        if (taskUpdateDto.AssignedToMemberId.HasValue)
        {
            var member = await _memberRepository.GetByIdAsync(taskUpdateDto.AssignedToMemberId.Value);
            if (member == null)
                throw new ArgumentException("Member does not exist.");
        }

        if (taskUpdateDto.DueDate.HasValue)
        {
            var dueDate = taskUpdateDto.DueDate.Value;
            taskUpdateDto.DueDate = dueDate.Kind switch
            {
                DateTimeKind.Unspecified => DateTime.SpecifyKind(dueDate, DateTimeKind.Utc),
                DateTimeKind.Utc => dueDate,
                _ => dueDate.ToUniversalTime()
            };
        }

        _mapper.Map(taskUpdateDto, task);
        task.UpdatedAt = DateTime.UtcNow;
        if (task.CreatedAt.Kind != DateTimeKind.Utc)
            task.CreatedAt = task.CreatedAt.ToUniversalTime();

        var updatedTask = await _taskRepository.UpdateAsync(task);
        try { await _workflowService.UpdateWorkflowJsonAsync(updatedTask.WorkflowId); } catch { }

        return await MapTaskWithDetailsAsync(updatedTask.TaskId);
    }

    public async Task<bool> DeleteTaskAsync(Guid id)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null) return false;

        var workflowId = task.WorkflowId;
        var deleted = await _taskRepository.DeleteAsync(id);
        if (deleted)
        {
            try { await _workflowService.UpdateWorkflowJsonAsync(workflowId); } catch { }
        }
        return deleted;
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByWorkflowAsync(Guid workflowId) =>
        MapTaskList((await _taskRepository.GetTasksByWorkflowAsync(workflowId)).ToList());

    public async Task<IEnumerable<TaskReadDto>> GetTasksByStageAsync(Guid stageId) =>
        MapTaskList((await _taskRepository.GetTasksByStageAsync(stageId)).ToList());

    public async Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId) =>
        MapTaskList((await _taskRepository.GetTasksByMemberAsync(memberId)).ToList());

    public async Task<IEnumerable<TaskReadDto>?> GetTasksAssignedToEmailAsync(string email)
    {
        var member = await _memberRepository.GetByEmailAsync(email);
        if (member == null)
        {
            _logger.LogWarning("No member found for email {Email}", email);
            return null;
        }
        return await GetTasksByMemberAsync(member.MemberId);
    }

    public async Task<MemberTaskSummaryDto> GetMemberTaskSummaryAsync(Guid memberId)
    {
        var assigned = await GetTasksByMemberAsync(memberId);
        var completedTasks = await _taskRepository.GetTasksCompletedByMemberAsync(memberId);
        var escalatedTasks = await _taskRepository.GetTasksEscalatedByMemberAsync(memberId);

        return new MemberTaskSummaryDto
        {
            AssignedToMe = assigned,
            CompletedByMe = MapTaskList(completedTasks.ToList()),
            EscalatedByMe = MapTaskList(escalatedTasks.ToList())
        };
    }

    private async Task<TaskReadDto?> MapTaskWithDetailsAsync(Guid taskId)
    {
        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        var task = tasks.FirstOrDefault(t => t.TaskId == taskId);
        if (task == null) return null;
        return MapSingle(task);
    }

    private List<TaskReadDto> MapTaskList(List<Models.Task> tasks)
    {
        var dtos = _mapper.Map<List<TaskReadDto>>(tasks);
        for (var i = 0; i < dtos.Count; i++)
            EnrichDto(dtos[i], tasks[i]);
        return dtos;
    }

    private TaskReadDto MapSingle(Models.Task task)
    {
        var dto = _mapper.Map<TaskReadDto>(task);
        EnrichDto(dto, task);
        return dto;
    }

    private static void EnrichDto(TaskReadDto dto, Models.Task task)
    {
        if (task.Stage != null) dto.StageName = task.Stage.StageName;
        if (task.Workflow != null) dto.WorkflowName = task.Workflow.WorkflowName;
        if (task.AssignedToMember != null)
            dto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
    }
}
