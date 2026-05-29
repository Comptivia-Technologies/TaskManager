using AutoMapper;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WorkflowManagement.API.DTOs;
using WorkflowManagement.API.Models;
using WorkflowManagement.API.Repositories;
using WorkflowManagement.API.Data;

namespace WorkflowManagement.API.Services;

public class WorkflowService : IWorkflowService
{
    private readonly IWorkflowRepository _workflowRepository;
    private readonly ITeamRepository _teamRepository;
    private readonly ApplicationDbContext _context;
    private readonly IMapper _mapper;

    public WorkflowService(IWorkflowRepository workflowRepository, ITeamRepository teamRepository, ApplicationDbContext context, IMapper mapper)
    {
        _workflowRepository = workflowRepository;
        _teamRepository = teamRepository;
        _context = context;
        _mapper = mapper;
    }

    public async System.Threading.Tasks.Task<IEnumerable<WorkflowReadDto>> GetAllWorkflowsAsync()
    {
        var workflows = await _workflowRepository.GetAllWithTeamAndStagesAsync();
        var workflowsDto = new List<WorkflowReadDto>();

        foreach (var workflow in workflows)
        {
            var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
            if (workflow.Team != null)
                workflowDto.TeamName = workflow.Team.TeamName;
            else if (workflow.TeamId.HasValue)
            {
                var team = await _teamRepository.GetByIdAsync(workflow.TeamId.Value);
                if (team != null) workflowDto.TeamName = team.TeamName;
            }

            foreach (var stageDto in workflowDto.Stages)
            {
                if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId != Guid.Empty)
                {
                    var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                    if (team != null) stageDto.TeamName = team.TeamName;
                }
            }
            workflowsDto.Add(workflowDto);
        }

        return workflowsDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto?> GetWorkflowByIdAsync(Guid id)
    {
        var workflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(id);
        if (workflow == null) return null;

        var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
        if (workflow.Team != null)
            workflowDto.TeamName = workflow.Team.TeamName;

        foreach (var stageDto in workflowDto.Stages)
        {
            if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId != Guid.Empty)
            {
                var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                if (team != null) stageDto.TeamName = team.TeamName;
            }
        }

        return workflowDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto> CreateWorkflowAsync(WorkflowCreateDto workflowCreateDto)
    {
        if (workflowCreateDto.TeamId.HasValue && workflowCreateDto.TeamId.Value == Guid.Empty)
            workflowCreateDto.TeamId = null;
        if (workflowCreateDto.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(workflowCreateDto.TeamId.Value);
            if (team == null)
                throw new ArgumentException("Team does not exist.");
        }

        var workflow = _mapper.Map<Workflow>(workflowCreateDto);
        workflow.CreatedAt = DateTime.UtcNow;
        workflow.UpdatedAt = DateTime.UtcNow;

        var createdWorkflow = await _workflowRepository.AddAsync(workflow);
        var fullWorkflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(createdWorkflow.WorkflowId);
        if (fullWorkflow != null)
        {
            fullWorkflow.WorkflowJson = await GenerateWorkflowJsonAsync(fullWorkflow);
            await _workflowRepository.UpdateAsync(fullWorkflow);
        }

        var workflowDto = _mapper.Map<WorkflowReadDto>(createdWorkflow);
        if (createdWorkflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(createdWorkflow.TeamId.Value);
            if (team != null) workflowDto.TeamName = team.TeamName;
        }
        return workflowDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto?> UpdateWorkflowAsync(Guid id, WorkflowUpdateDto workflowUpdateDto)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow == null) return null;

        _mapper.Map(workflowUpdateDto, workflow);
        workflow.UpdatedAt = DateTime.UtcNow;
        var updatedWorkflow = await _workflowRepository.UpdateAsync(workflow);
        var workflowDto = _mapper.Map<WorkflowReadDto>(updatedWorkflow);
        if (updatedWorkflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(updatedWorkflow.TeamId.Value);
            if (team != null) workflowDto.TeamName = team.TeamName;
        }
        return workflowDto;
    }

    public async System.Threading.Tasks.Task<bool> DeleteWorkflowAsync(Guid id)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow == null) return false;
        return await _workflowRepository.DeleteAsync(id);
    }

    public async System.Threading.Tasks.Task<IEnumerable<StageReadDto>> GetWorkflowStagesAsync(Guid workflowId)
    {
        var stages = await _workflowRepository.GetWorkflowWithStagesAsync(workflowId);
        if (stages == null) return Enumerable.Empty<StageReadDto>();
        return _mapper.Map<IEnumerable<StageReadDto>>(stages.Stages);
    }

    public async System.Threading.Tasks.Task<IEnumerable<TaskReadDto>> GetWorkflowTasksAsync(Guid workflowId)
    {
        var workflow = await _workflowRepository.GetWorkflowWithTasksAsync(workflowId);
        if (workflow == null) return Enumerable.Empty<TaskReadDto>();

        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(workflow.Tasks).ToList();
        foreach (var taskDto in tasksDto)
        {
            var task = workflow.Tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
            if (task != null)
            {
                if (task.Stage != null) taskDto.StageName = task.Stage.StageName;
                taskDto.WorkflowName = workflow.WorkflowName;
                if (task.AssignedToMember != null)
                    taskDto.AssignedToMemberName = $"{task.AssignedToMember.FirstName} {task.AssignedToMember.LastName}";
            }
        }
        return tasksDto;
    }

    private async System.Threading.Tasks.Task<string> GenerateWorkflowJsonAsync(Workflow workflow)
    {
        var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
        if (workflow.Team != null)
            workflowDto.TeamName = workflow.Team.TeamName;
        else if (workflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(workflow.TeamId.Value);
            if (team != null) workflowDto.TeamName = team.TeamName;
        }

        foreach (var stageDto in workflowDto.Stages)
        {
            if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId != Guid.Empty)
            {
                var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                if (team != null) stageDto.TeamName = team.TeamName;
            }
        }

        return JsonSerializer.Serialize(workflowDto, new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
    }

    public async System.Threading.Tasks.Task UpdateWorkflowJsonAsync(Guid workflowId)
    {
        var workflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(workflowId);
        if (workflow == null) return;
        workflow.WorkflowJson = await GenerateWorkflowJsonAsync(workflow);
        workflow.UpdatedAt = DateTime.UtcNow;
        await _workflowRepository.UpdateAsync(workflow);
    }
}
