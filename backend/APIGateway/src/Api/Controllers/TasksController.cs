using Microsoft.AspNetCore.Mvc;
using APIGateway.Application.DTOs;
using Shared.Contracts.EventContracts;
using Shared.Contracts.Constants;
using Shared.Messaging;

namespace APIGateway.Api.Controllers;

/// <summary>
/// API Gateway - Entry point for task creation
/// Orchestrates the flow by publishing events (no business logic)
/// </summary>
[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private readonly IRabbitMQPublisher _publisher;
    private readonly ILogger<TasksController> _logger;

    public TasksController(
        IRabbitMQPublisher publisher,
        ILogger<TasksController> logger)
    {
        _publisher = publisher;
        _logger = logger;
    }

    /// <summary>
    /// Create a new task - Entry point for orchestration flow
    /// Publishes TaskCreatedEvent to start the workflow
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateTask([FromBody] CreateTaskRequestDto request)
    {
        try
        {
            var correlationId = Guid.NewGuid();
            var taskId = Guid.NewGuid();

            // Create TaskCreatedEvent
            var taskCreatedEvent = new TaskCreatedEvent
            {
                TaskId = taskId,
                TaskName = request.TaskName,
                Description = request.Description,
                Priority = request.Priority,
                TaskType = request.TaskType,
                CreatedAt = DateTime.UtcNow,
                CorrelationId = correlationId
            };

            // Publish event to start orchestration flow
            await _publisher.PublishAsync(
                taskCreatedEvent,
                RabbitMQConstants.TaskExchange,
                RabbitMQConstants.TaskCreated,
                correlationId);

            _logger.LogInformation(
                "Task creation initiated via API Gateway. TaskId: {TaskId}, CorrelationId: {CorrelationId}",
                taskId, correlationId);

            // Return accepted (202) since processing is asynchronous
            return Accepted(new
            {
                taskId = taskId,
                correlationId = correlationId,
                message = "Task creation initiated. Processing asynchronously."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initiating task creation via API Gateway");
            return StatusCode(500, new { error = "An error occurred while initiating task creation" });
        }
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", service = "API Gateway" });
    }
}

