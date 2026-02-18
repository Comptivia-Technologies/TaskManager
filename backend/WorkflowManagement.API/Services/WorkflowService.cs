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
        // Load workflows with stages included
        var workflows = await _context.Workflows
            .Include(w => w.Stages)
            .Include(w => w.Team)
            .ToListAsync();
        
        var workflowsDto = new List<WorkflowReadDto>();

        foreach (var workflow in workflows)
        {
            var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
            if (workflow.Team != null)
            {
                workflowDto.TeamName = workflow.Team.TeamName;
            }
            else if (workflow.TeamId.HasValue)
            {
                var team = await _teamRepository.GetByIdAsync(workflow.TeamId.Value);
                if (team != null)
                    workflowDto.TeamName = team.TeamName;
            }
            
            // Populate team names for stages
            foreach (var stageDto in workflowDto.Stages)
            {
                if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId > 0)
                {
                    var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                    if (team != null)
                        stageDto.TeamName = team.TeamName;
                }
            }
            
            workflowsDto.Add(workflowDto);
        }

        return workflowsDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto?> GetWorkflowByIdAsync(Guid id)
    {
        var workflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(id);
        if (workflow == null)
            return null;

        var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
        if (workflow.Team != null)
            workflowDto.TeamName = workflow.Team.TeamName;

        // Ensure all stages have team names populated
        foreach (var stageDto in workflowDto.Stages)
        {
            if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId > 0)
            {
                var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                if (team != null)
                    stageDto.TeamName = team.TeamName;
            }
        }

        return workflowDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto> CreateWorkflowAsync(WorkflowCreateDto workflowCreateDto)
    {
        // Treat teamId 0 as null (workflows don't need teams, stages have teams)
        if (workflowCreateDto.TeamId.HasValue && workflowCreateDto.TeamId.Value == 0)
        {
            workflowCreateDto.TeamId = null;
        }

        if (workflowCreateDto.TeamId.HasValue && !await _teamRepository.ExistsAsync(workflowCreateDto.TeamId.Value))
            throw new ArgumentException("Team does not exist");

        var workflow = _mapper.Map<Workflow>(workflowCreateDto);
        workflow.CreatedAt = DateTime.UtcNow;
        workflow.UpdatedAt = DateTime.UtcNow;

        var createdWorkflow = await _workflowRepository.AddAsync(workflow);
        
        // After creation, load the full workflow with stages and tasks to generate JSON
        var fullWorkflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(createdWorkflow.WorkflowId);
        if (fullWorkflow != null)
        {
            // Generate and save workflow JSON
            var workflowJson = await GenerateWorkflowJsonAsync(fullWorkflow);
            fullWorkflow.WorkflowJson = workflowJson;
            await _workflowRepository.UpdateAsync(fullWorkflow);
        }
        
        var workflowDto = _mapper.Map<WorkflowReadDto>(createdWorkflow);
        if (createdWorkflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(createdWorkflow.TeamId.Value);
            if (team != null)
                workflowDto.TeamName = team.TeamName;
        }

        return workflowDto;
    }

    public async System.Threading.Tasks.Task<WorkflowReadDto?> UpdateWorkflowAsync(Guid id, WorkflowUpdateDto workflowUpdateDto)
    {
        var workflow = await _workflowRepository.GetByIdAsync(id);
        if (workflow == null)
            return null;

        _mapper.Map(workflowUpdateDto, workflow);
        workflow.UpdatedAt = DateTime.UtcNow;

        var updatedWorkflow = await _workflowRepository.UpdateAsync(workflow);
        var workflowDto = _mapper.Map<WorkflowReadDto>(updatedWorkflow);
        if (updatedWorkflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(updatedWorkflow.TeamId.Value);
            if (team != null)
                workflowDto.TeamName = team.TeamName;
        }

        return workflowDto;
    }

    public async System.Threading.Tasks.Task<bool> DeleteWorkflowAsync(Guid id)
    {
        return await _workflowRepository.DeleteAsync(id);
    }

    public async System.Threading.Tasks.Task<IEnumerable<StageReadDto>> GetWorkflowStagesAsync(Guid workflowId)
    {
        var stages = await _workflowRepository.GetWorkflowWithStagesAsync(workflowId);
        if (stages == null)
            return Enumerable.Empty<StageReadDto>();

        return _mapper.Map<IEnumerable<StageReadDto>>(stages.Stages);
    }

    public async System.Threading.Tasks.Task<IEnumerable<TaskReadDto>> GetWorkflowTasksAsync(Guid workflowId)
    {
        var workflow = await _workflowRepository.GetWorkflowWithTasksAsync(workflowId);
        if (workflow == null)
            return Enumerable.Empty<TaskReadDto>();

        var tasksDto = _mapper.Map<IEnumerable<TaskReadDto>>(workflow.Tasks);
        var tasksList = tasksDto.ToList();

        foreach (var taskDto in tasksList)
        {
            var task = workflow.Tasks.FirstOrDefault(t => t.TaskId == taskDto.TaskId);
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

    /// <summary>
    /// Generates a complete JSON representation of the workflow including all relationships
    /// </summary>
    private async System.Threading.Tasks.Task<string> GenerateWorkflowJsonAsync(Workflow workflow)
    {
        var workflowDto = _mapper.Map<WorkflowReadDto>(workflow);
        
        // Populate team name
        if (workflow.Team != null)
            workflowDto.TeamName = workflow.Team.TeamName;
        else if (workflow.TeamId.HasValue)
        {
            var team = await _teamRepository.GetByIdAsync(workflow.TeamId.Value);
            if (team != null)
                workflowDto.TeamName = team.TeamName;
        }

        // Ensure all stages have team names
        foreach (var stageDto in workflowDto.Stages)
        {
            if (string.IsNullOrEmpty(stageDto.TeamName) && stageDto.TeamId > 0)
            {
                var team = await _teamRepository.GetByIdAsync(stageDto.TeamId);
                if (team != null)
                    stageDto.TeamName = team.TeamName;
            }
        }

        var options = new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        return JsonSerializer.Serialize(workflowDto, options);
    }

    /// <summary>
    /// Updates the workflow JSON in the JSONB field
    /// </summary>
    public async System.Threading.Tasks.Task UpdateWorkflowJsonAsync(Guid workflowId)
    {
        var workflow = await _workflowRepository.GetWorkflowWithStagesAndTasksAsync(workflowId);
        if (workflow == null)
            return;

        var workflowJson = await GenerateWorkflowJsonAsync(workflow);
        workflow.WorkflowJson = workflowJson;
        workflow.UpdatedAt = DateTime.UtcNow;
        await _workflowRepository.UpdateAsync(workflow);
    }
}



