using WorkflowService.Domain.Entities;

namespace WorkflowService.Application.Interfaces;

/// <summary>
/// Repository for workflow selection operations
/// </summary>
public interface IWorkflowRepository
{
    Task<WorkflowSelection?> GetByTaskIdAsync(Guid taskId);
    Task<WorkflowSelection> CreateAsync(WorkflowSelection selection);
    Task<WorkflowSelection> UpdateAsync(WorkflowSelection selection);
    Task<IEnumerable<Workflow>> GetAllWorkflowsAsync();
    Task<Workflow?> GetWorkflowByIdAsync(int workflowId);
    Task<IEnumerable<Stage>> GetStagesByWorkflowIdAsync(int workflowId);
}

/// <summary>
/// Reference workflow entity (from WorkflowManagement database)
/// </summary>
public class Workflow
{
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? TeamId { get; set; }
}

