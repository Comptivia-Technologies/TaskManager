using Microsoft.EntityFrameworkCore;
using WorkflowService.Application.Interfaces;
using WorkflowService.Domain.Entities;
using WorkflowService.Infrastructure.Persistence;

namespace WorkflowService.Infrastructure.Repositories;

/// <summary>
/// Repository implementation for workflow operations
/// </summary>
public class WorkflowRepository : IWorkflowRepository
{
    private readonly WorkflowDbContext _context;

    public WorkflowRepository(WorkflowDbContext context)
    {
        _context = context;
    }

    public async Task<WorkflowSelection?> GetByTaskIdAsync(Guid taskId)
    {
        var selection = await _context.WorkflowSelections
            .FirstOrDefaultAsync(ws => ws.TaskId == taskId);
        
        // Normalize DateTime values on read to ensure UTC kind
        if (selection != null)
        {
            NormalizeDateTimeToUtc(selection);
        }
        
        return selection;
    }

    public async Task<WorkflowSelection> CreateAsync(WorkflowSelection selection)
    {
        // Normalize DateTime values to UTC for PostgreSQL compatibility
        NormalizeDateTimeToUtc(selection);
        
        _context.WorkflowSelections.Add(selection);
        await _context.SaveChangesAsync();
        return selection;
    }

    public async Task<WorkflowSelection> UpdateAsync(WorkflowSelection selection)
    {
        // Normalize DateTime values to UTC for PostgreSQL compatibility
        // PostgreSQL 'timestamp with time zone' requires Kind=Utc, not Unspecified
        NormalizeDateTimeToUtc(selection);
        
        _context.WorkflowSelections.Update(selection);
        await _context.SaveChangesAsync();
        return selection;
    }

    /// <summary>
    /// Normalizes DateTime values to UTC kind for PostgreSQL compatibility
    /// PostgreSQL's timestamptz columns require DateTime.Kind = Utc
    /// </summary>
    private void NormalizeDateTimeToUtc(WorkflowSelection selection)
    {
        if (selection.SelectedAt.Kind == DateTimeKind.Unspecified)
        {
            selection.SelectedAt = DateTime.SpecifyKind(selection.SelectedAt, DateTimeKind.Utc);
        }
        else if (selection.SelectedAt.Kind == DateTimeKind.Local)
        {
            selection.SelectedAt = selection.SelectedAt.ToUniversalTime();
        }

        if (selection.StageOrchestrationStartedAt.HasValue)
        {
            var startedAt = selection.StageOrchestrationStartedAt.Value;
            if (startedAt.Kind == DateTimeKind.Unspecified)
            {
                selection.StageOrchestrationStartedAt = DateTime.SpecifyKind(startedAt, DateTimeKind.Utc);
            }
            else if (startedAt.Kind == DateTimeKind.Local)
            {
                selection.StageOrchestrationStartedAt = startedAt.ToUniversalTime();
            }
        }
    }

    public async Task<IEnumerable<Workflow>> GetAllWorkflowsAsync()
    {
        return await _context.Workflows.ToListAsync();
    }

    public async Task<Workflow?> GetWorkflowByIdAsync(int workflowId)
    {
        return await _context.Workflows
            .FirstOrDefaultAsync(w => w.WorkflowId == workflowId);
    }

    public async Task<IEnumerable<Stage>> GetStagesByWorkflowIdAsync(int workflowId)
    {
        // Read from database using StageDbEntity (which has int properties)
        var stagesFromDb = await _context.Stages
            .Where(s => s.WorkflowId == workflowId)
            .OrderBy(s => s.StageOrder)
            .ToListAsync();

        // Convert to Stage DTOs with string properties
        return stagesFromDb.Select(s => new Stage
        {
            StageId = s.StageId,
            StageName = s.StageName,
            StageOrder = s.StageOrder,
            WorkflowId = s.WorkflowId,
            TeamId = s.TeamId,
            StageType = s.StageType == 0 ? "Process" : "Escalation",
            TransitionPolicy = s.TransitionPolicy == 0 ? "OnComplete" : s.TransitionPolicy == 1 ? "OnTimeout" : "Manual",
            TimeoutMinutes = s.TimeoutMinutes
        });
    }
}

