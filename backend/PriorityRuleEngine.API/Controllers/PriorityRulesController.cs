using Microsoft.AspNetCore.Mvc;
using PriorityRuleEngine.API.DTOs;
using PriorityRuleEngine.API.Models;
using PriorityRuleEngine.API.Repositories;

namespace PriorityRuleEngine.API.Controllers;

[ApiController]
[Route("api/priority-rules")]
public class PriorityRulesController : ControllerBase
{
    private readonly IPriorityRuleRepository _repository;
    private readonly ILogger<PriorityRulesController> _logger;

    public PriorityRulesController(
        IPriorityRuleRepository repository,
        ILogger<PriorityRulesController> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<PriorityRuleDto>>> GetRules([FromQuery] bool activeOnly = false)
    {
        var rules = activeOnly
            ? await _repository.GetActiveRulesAsync()
            : await _repository.GetAllRulesAsync();

        var dtos = rules.Select(r => new PriorityRuleDto
        {
            RuleId = r.RuleId,
            RuleName = r.RuleName,
            Priority = r.Priority,
            Salience = r.Salience,
            IsActive = r.IsActive,
            ConditionsJson = r.ConditionsJson,
            MaxWorkloadScore = r.MaxWorkloadScore,
            TeamName = r.TeamName,
            WorkflowId = r.WorkflowId,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt
        }).ToList();

        return Ok(dtos);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PriorityRuleDto>> GetRule(Guid id)
    {
        var rule = await _repository.GetByIdAsync(id);
        if (rule == null) return NotFound();

        var dto = new PriorityRuleDto
        {
            RuleId = rule.RuleId,
            RuleName = rule.RuleName,
            Priority = rule.Priority,
            Salience = rule.Salience,
            IsActive = rule.IsActive,
            ConditionsJson = rule.ConditionsJson,
            MaxWorkloadScore = rule.MaxWorkloadScore,
            TeamName = rule.TeamName,
            WorkflowId = rule.WorkflowId,
            CreatedAt = rule.CreatedAt,
            UpdatedAt = rule.UpdatedAt
        };

        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<PriorityRuleDto>> CreateRule([FromBody] CreatePriorityRuleRequest request)
    {
        _logger.LogInformation(
            "Creating rule. RuleName: {RuleName}, Priority: {Priority}, WorkflowId from request: {WorkflowId}",
            request.RuleName, request.Priority, request.WorkflowId);
        
        var rule = new PriorityRule
        {
            RuleName = request.RuleName,
            Priority = request.Priority,
            Salience = request.Salience,
            IsActive = request.IsActive,
            ConditionsJson = request.ConditionsJson,
            MaxWorkloadScore = request.MaxWorkloadScore,
            TeamName = request.TeamName,
            WorkflowId = request.WorkflowId
        };
        
        _logger.LogInformation(
            "Rule object created. WorkflowId before save: {WorkflowId}",
            rule.WorkflowId);

        var created = await _repository.CreateAsync(rule);
        
        _logger.LogInformation(
            "Rule saved. RuleId: {RuleId}, WorkflowId after save: {WorkflowId}",
            created.RuleId, created.WorkflowId);

        var dto = new PriorityRuleDto
        {
            RuleId = created.RuleId,
            RuleName = created.RuleName,
            Priority = created.Priority,
            Salience = created.Salience,
            IsActive = created.IsActive,
            ConditionsJson = created.ConditionsJson,
            MaxWorkloadScore = created.MaxWorkloadScore,
            TeamName = created.TeamName,
            WorkflowId = created.WorkflowId,
            CreatedAt = created.CreatedAt,
            UpdatedAt = created.UpdatedAt
        };

        return CreatedAtAction(nameof(GetRule), new { id = created.RuleId }, dto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PriorityRuleDto>> UpdateRule(Guid id, [FromBody] UpdatePriorityRuleRequest request)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound();
        var rule = new PriorityRule
        {
            RuleName = request.RuleName,
            Priority = request.Priority,
            Salience = request.Salience,
            IsActive = request.IsActive,
            ConditionsJson = request.ConditionsJson,
            MaxWorkloadScore = request.MaxWorkloadScore,
            TeamName = request.TeamName,
            WorkflowId = request.WorkflowId
        };

        var updated = await _repository.UpdateAsync(id, rule);
        if (updated == null) return NotFound();

        var dto = new PriorityRuleDto
        {
            RuleId = updated.RuleId,
            RuleName = updated.RuleName,
            Priority = updated.Priority,
            Salience = updated.Salience,
            IsActive = updated.IsActive,
            ConditionsJson = updated.ConditionsJson,
            MaxWorkloadScore = updated.MaxWorkloadScore,
            TeamName = updated.TeamName,
            WorkflowId = updated.WorkflowId,
            CreatedAt = updated.CreatedAt,
            UpdatedAt = updated.UpdatedAt
        };

        return Ok(dto);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRule(Guid id)
    {
        var existing = await _repository.GetByIdAsync(id);
        if (existing == null)
            return NotFound();
        var deleted = await _repository.DeleteAsync(id);
        if (!deleted) return NotFound();

        return NoContent();
    }
}
