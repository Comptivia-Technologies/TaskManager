using AutoMapper;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
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

    public TaskService(
        ITaskRepository taskRepository,
        IWorkflowRepository workflowRepository,
        IStageRepository stageRepository,
        IMemberRepository memberRepository,
        IWorkflowService workflowService,
        IMapper mapper)
    {
        _taskRepository = taskRepository;
        _workflowRepository = workflowRepository;
        _stageRepository = stageRepository;
        _memberRepository = memberRepository;
        _workflowService = workflowService;
        _mapper = mapper;
    }

    public async Task<TaskReadDto> CreateTaskAsync(TaskCreateDto taskCreateDto)
    {
        if (!await _workflowRepository.ExistsAsync(taskCreateDto.WorkflowId))
            throw new ArgumentException("Workflow does not exist");

        if (taskCreateDto.StageId.HasValue && !await _stageRepository.ExistsAsync(taskCreateDto.StageId.Value))
            throw new ArgumentException("Stage does not exist");

        if (taskCreateDto.AssignedToMemberId.HasValue && !await _memberRepository.ExistsAsync(taskCreateDto.AssignedToMemberId.Value))
            throw new ArgumentException("Member does not exist");

        var task = _mapper.Map<Models.Task>(taskCreateDto);
        
        // Use provided TaskId if available (for sync from TaskService), otherwise generate new one
        if (taskCreateDto.TaskId.HasValue)
        {
            task.TaskId = taskCreateDto.TaskId.Value;
        }

        // Ensure DueDate is UTC
        if (task.DueDate.HasValue)
        {
            var dueDate = task.DueDate.Value;
            if (dueDate.Kind == DateTimeKind.Unspecified)
            {
                task.DueDate = DateTime.SpecifyKind(dueDate, DateTimeKind.Utc);
            }
            else if (dueDate.Kind != DateTimeKind.Utc)
            {
                task.DueDate = dueDate.ToUniversalTime();
            }
        }

        task.CreatedAt = DateTime.UtcNow;
        task.UpdatedAt = DateTime.UtcNow;

        var createdTask = await _taskRepository.AddAsync(task);
        
        // Update workflow JSON after task creation
        try
        {
            await _workflowService.UpdateWorkflowJsonAsync(createdTask.WorkflowId);
        }
        catch
        {
            // Log but don't fail task creation if JSON update fails
        }

        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        var taskWithDetails = tasks.FirstOrDefault(t => t.TaskId == createdTask.TaskId);
        
        if (taskWithDetails == null)
            return _mapper.Map<TaskReadDto>(createdTask);

        var taskDto = _mapper.Map<TaskReadDto>(taskWithDetails);
        if (taskWithDetails.Stage != null)
            taskDto.StageName = taskWithDetails.Stage.StageName;
        if (taskWithDetails.AssignedToMember != null)
            taskDto.AssignedToMemberName = $"{taskWithDetails.AssignedToMember.FirstName} {taskWithDetails.AssignedToMember.LastName}";

        return taskDto;
    }

    public async Task<IEnumerable<TaskReadDto>> GetAllTasksAsync()
    {
        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }

    public async Task<TaskReadDto?> GetTaskByIdAsync(Guid id)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null)
            return null;

        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        var taskWithDetails = tasks.FirstOrDefault(t => t.TaskId == id);
        if (taskWithDetails == null)
            return null;

        var taskDto = _mapper.Map<TaskReadDto>(taskWithDetails);
        if (taskWithDetails.Stage != null)
            taskDto.StageName = taskWithDetails.Stage.StageName;
        if (taskWithDetails.AssignedToMember != null)
            taskDto.AssignedToMemberName = $"{taskWithDetails.AssignedToMember.FirstName} {taskWithDetails.AssignedToMember.LastName}";

        return taskDto;
    }

    public async Task<TaskReadDto?> UpdateTaskAsync(Guid id, TaskUpdateDto taskUpdateDto)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null)
            return null;

        if (taskUpdateDto.StageId.HasValue && !await _stageRepository.ExistsAsync(taskUpdateDto.StageId.Value))
            throw new ArgumentException("Stage does not exist");

        if (taskUpdateDto.AssignedToMemberId.HasValue && !await _memberRepository.ExistsAsync(taskUpdateDto.AssignedToMemberId.Value))
            throw new ArgumentException("Member does not exist");

        // Ensure DueDate is UTC before mapping
        if (taskUpdateDto.DueDate.HasValue)
        {
            var dueDate = taskUpdateDto.DueDate.Value;
            if (dueDate.Kind == DateTimeKind.Unspecified)
            {
                taskUpdateDto.DueDate = DateTime.SpecifyKind(dueDate, DateTimeKind.Utc);
            }
            else if (dueDate.Kind != DateTimeKind.Utc)
            {
                taskUpdateDto.DueDate = dueDate.ToUniversalTime();
            }
        }

        _mapper.Map(taskUpdateDto, task);
        
        // Ensure UpdatedAt is UTC (PostgreSQL requires UTC for timestamp with time zone)
        task.UpdatedAt = DateTime.UtcNow;
        
        // Ensure CreatedAt is UTC if it was loaded with Unspecified kind
        if (task.CreatedAt.Kind == DateTimeKind.Unspecified)
        {
            task.CreatedAt = DateTime.SpecifyKind(task.CreatedAt, DateTimeKind.Utc);
        }
        else if (task.CreatedAt.Kind != DateTimeKind.Utc)
        {
            task.CreatedAt = task.CreatedAt.ToUniversalTime();
        }

        var updatedTask = await _taskRepository.UpdateAsync(task);
        var tasks = await _taskRepository.GetTasksWithDetailsAsync();
        var taskWithDetails = tasks.FirstOrDefault(t => t.TaskId == updatedTask.TaskId);
        
        if (taskWithDetails == null)
            return _mapper.Map<TaskReadDto>(updatedTask);

        var taskDto = _mapper.Map<TaskReadDto>(taskWithDetails);
        if (taskWithDetails.Stage != null)
            taskDto.StageName = taskWithDetails.Stage.StageName;
        if (taskWithDetails.AssignedToMember != null)
            taskDto.AssignedToMemberName = $"{taskWithDetails.AssignedToMember.FirstName} {taskWithDetails.AssignedToMember.LastName}";

        // Update workflow JSON after task update
        try
        {
            await _workflowService.UpdateWorkflowJsonAsync(updatedTask.WorkflowId);
        }
        catch
        {
            // Log but don't fail task update if JSON update fails
        }

        return taskDto;
    }

    public async Task<bool> DeleteTaskAsync(Guid id)
    {
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null)
            return false;

        var workflowId = task.WorkflowId;
        var deleted = await _taskRepository.DeleteAsync(id);
        
        // Update workflow JSON after task deletion
        if (deleted)
        {
            try
            {
                await _workflowService.UpdateWorkflowJsonAsync(workflowId);
            }
            catch
            {
                // Log but don't fail task deletion if JSON update fails
            }
        }

        return deleted;
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByWorkflowAsync(Guid workflowId)
    {
        var tasks = await _taskRepository.GetTasksByWorkflowAsync(workflowId);
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByStageAsync(Guid stageId)
    {
        var tasks = await _taskRepository.GetTasksByStageAsync(stageId);
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }

    public async Task<IEnumerable<TaskReadDto>> GetTasksByMemberAsync(Guid memberId)
    {
        var tasks = await _taskRepository.GetTasksByMemberAsync(memberId);
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }
}

