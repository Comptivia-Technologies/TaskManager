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
    private readonly ICurrentOrganizationAccessor _orgAccessor;
    private readonly IMapper _mapper;
    private readonly ILogger<TaskService> _logger;

    public TaskService(
        ITaskRepository taskRepository,
        IWorkflowRepository workflowRepository,
        IStageRepository stageRepository,
        IMemberRepository memberRepository,
        IWorkflowService workflowService,
        ICurrentOrganizationAccessor orgAccessor,
        IMapper mapper,
        ILogger<TaskService> logger)
    {
        _taskRepository = taskRepository;
        _workflowRepository = workflowRepository;
        _stageRepository = stageRepository;
        _memberRepository = memberRepository;
        _workflowService = workflowService;
        _orgAccessor = orgAccessor;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<TaskReadDto> CreateTaskAsync(TaskCreateDto taskCreateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var workflow = await _workflowRepository.GetByIdAsync(taskCreateDto.WorkflowId);
        if (workflow == null || workflow.OrganizationId != orgId.Value)
            throw new ArgumentException("Workflow does not exist or does not belong to your organization.");
        if (taskCreateDto.StageId.HasValue)
        {
            var stage = await _stageRepository.GetByIdAsync(taskCreateDto.StageId.Value);
            if (stage == null || stage.OrganizationId != orgId.Value)
                throw new ArgumentException("Stage does not exist or does not belong to your organization.");
        }
        if (taskCreateDto.AssignedToMemberId.HasValue)
        {
            var member = await _memberRepository.GetByIdAsync(taskCreateDto.AssignedToMemberId.Value);
            if (member == null || member.OrganizationId != orgId.Value)
                throw new ArgumentException("Member does not exist or does not belong to your organization.");
        }

        var task = _mapper.Map<Models.Task>(taskCreateDto);
        task.OrganizationId = orgId.Value;
        
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

        try
        {
            await _workflowService.UpdateWorkflowJsonAsync(createdTask.WorkflowId);
        }
        catch { }

        var tasks = await _taskRepository.GetTasksWithDetailsByOrganizationAsync(orgId.Value);
        var taskWithDetails = tasks.FirstOrDefault(t => t.TaskId == createdTask.TaskId);
        
        if (taskWithDetails == null)
            return _mapper.Map<TaskReadDto>(createdTask);

        var taskDto = _mapper.Map<TaskReadDto>(taskWithDetails);
        if (taskWithDetails.Stage != null)
            taskDto.StageName = taskWithDetails.Stage.StageName;
        if (taskWithDetails.Workflow != null)
            taskDto.WorkflowName = taskWithDetails.Workflow.WorkflowName;
        if (taskWithDetails.AssignedToMember != null)
            taskDto.AssignedToMemberName = $"{taskWithDetails.AssignedToMember.FirstName} {taskWithDetails.AssignedToMember.LastName}";

        return taskDto;
    }

    public async Task<IEnumerable<TaskReadDto>> GetAllTasksAsync()
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var tasks = await _taskRepository.GetTasksWithDetailsByOrganizationAsync(orgId.Value);
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.Workflow != null)
                    taskDto.WorkflowName = task.Workflow.WorkflowName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }

    public async Task<PaginatedTasksResponseDto> GetTasksPaginatedAsync(string? priority, int page, int limit)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");

        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        if (limit > 100) limit = 100;

        var (tasks, totalCount) = await _taskRepository.GetTasksWithDetailsByOrganizationPaginatedAsync(orgId.Value, priority, page, limit);
        var tasksList = tasks.ToList();
        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(tasksList).ToList();

        foreach (var taskDto in tasksDto)
        {
            var task = tasksList.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null)
                    taskDto.StageName = task.Stage.StageName;
                if (task.Workflow != null)
                    taskDto.WorkflowName = task.Workflow.WorkflowName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

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
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null || task.OrganizationId != orgId.Value)
            return null;

        var tasks = await _taskRepository.GetTasksWithDetailsByOrganizationAsync(orgId.Value);
        var taskWithDetails = tasks.FirstOrDefault(t => t.TaskId == id);
        if (taskWithDetails == null)
            return null;

        var taskDto = _mapper.Map<TaskReadDto>(taskWithDetails);
        if (taskWithDetails.Stage != null)
            taskDto.StageName = taskWithDetails.Stage.StageName;
        if (taskWithDetails.Workflow != null)
            taskDto.WorkflowName = taskWithDetails.Workflow.WorkflowName;
        if (taskWithDetails.AssignedToMember != null)
            taskDto.AssignedToMemberName = $"{taskWithDetails.AssignedToMember.FirstName} {taskWithDetails.AssignedToMember.LastName}";

        return taskDto;
    }

    public async Task<TaskReadDto?> UpdateTaskAsync(Guid id, TaskUpdateDto taskUpdateDto)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null || task.OrganizationId != orgId.Value)
            return null;
        if (taskUpdateDto.StageId.HasValue)
        {
            var stage = await _stageRepository.GetByIdAsync(taskUpdateDto.StageId.Value);
            if (stage == null || stage.OrganizationId != orgId.Value)
                throw new ArgumentException("Stage does not exist or does not belong to your organization.");
        }
        if (taskUpdateDto.AssignedToMemberId.HasValue)
        {
            var member = await _memberRepository.GetByIdAsync(taskUpdateDto.AssignedToMemberId.Value);
            if (member == null || member.OrganizationId != orgId.Value)
                throw new ArgumentException("Member does not exist or does not belong to your organization.");
        }

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
        if (taskWithDetails.Workflow != null)
            taskDto.WorkflowName = taskWithDetails.Workflow.WorkflowName;
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
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");
        var task = await _taskRepository.GetByIdAsync(id);
        if (task == null || task.OrganizationId != orgId.Value)
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
                if (task.Workflow != null)
                    taskDto.WorkflowName = task.Workflow.WorkflowName;
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
                if (task.Workflow != null)
                    taskDto.WorkflowName = task.Workflow.WorkflowName;
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
                if (task.Workflow != null)
                    taskDto.WorkflowName = task.Workflow.WorkflowName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return tasksList;
    }

    public async Task<IEnumerable<TaskReadDto>?> GetTasksAssignedToUserIdAsync(string userId)
    {
        var orgId = _orgAccessor.GetCurrentOrganizationId();
        if (!orgId.HasValue)
            throw new UnauthorizedAccessException("Organization context required.");

        var member = await _memberRepository.GetByUserIdAsync(userId, orgId.Value);
        if (member == null)
        {
            _logger.LogWarning(
                "GetTasksAssignedToUserId: no Member row for UserId {UserId} in OrganizationId {OrganizationId}; API will return 404.",
                userId,
                orgId.Value);
            return null;
        }

        return await GetTasksByMemberAsync(member.MemberId);
    }

    public async Task<MemberTaskSummaryDto> GetMemberTaskSummaryAsync(Guid memberId)
    {
        var assigned = await GetTasksByMemberAsync(memberId);
        var completedTasks = await _taskRepository.GetTasksCompletedByMemberAsync(memberId);
        var escalatedTasks = await _taskRepository.GetTasksEscalatedByMemberAsync(memberId);

        var completedDto = _mapper.Map<IEnumerable<TaskReadDto>>(completedTasks).ToList();
        foreach (var taskDto in completedDto)
        {
            var task = completedTasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null) taskDto.StageName = task.Stage.StageName;
                if (task.Workflow != null) taskDto.WorkflowName = task.Workflow.WorkflowName;
                if (task.AssignedToMember != null) taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        var escalatedDto = _mapper.Map<IEnumerable<TaskReadDto>>(escalatedTasks).ToList();
        foreach (var taskDto in escalatedDto)
        {
            var task = escalatedTasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null) taskDto.StageName = task.Stage.StageName;
                if (task.Workflow != null) taskDto.WorkflowName = task.Workflow.WorkflowName;
                if (task.AssignedToMember != null) taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }

        return new MemberTaskSummaryDto
        {
            AssignedToMe = assigned,
            CompletedByMe = completedDto,
            EscalatedByMe = escalatedDto
        };
    }
}

