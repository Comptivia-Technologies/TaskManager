using Microsoft.AspNetCore.Mvc;
using APIGateway.Application.DTOs;

namespace APIGateway.Api.Controllers;

/// <summary>
/// API Gateway - Task status update endpoint
/// </summary>
[ApiController]
[Route("api/tasks/status")]
public class StatusController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<StatusController> _logger;

    public StatusController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<StatusController> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Update task status (e.g., mark as Completed, InProgress, etc.)
    /// </summary>
    [HttpPut("{taskId:guid}")]
    public async Task<ActionResult> UpdateTaskStatus(Guid taskId, [FromBody] UpdateTaskStatusRequestDto request)
    {
        try
        {
            var taskServiceApiUrl = _configuration["TaskServiceApi:BaseUrl"] 
                ?? throw new InvalidOperationException("TaskServiceApi:BaseUrl configuration is required");
            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            // Validate status value (0-7)
            if (request.Status < 0 || request.Status > 7)
            {
                return BadRequest(new { error = "Status must be between 0 and 7" });
            }

            // Create DTO for TaskService
            var updateDto = new { Status = request.Status };

            var response = await httpClient.PutAsJsonAsync(
                $"{taskServiceApiUrl}/task-service/{taskId}/status",
                updateDto);

            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return NotFound(new { error = $"Task with ID {taskId} not found" });
            }

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("TaskService returned error. Status: {Status}, TaskId: {TaskId}, Error: {Error}", 
                    response.StatusCode, taskId, errorContent);
                return StatusCode((int)response.StatusCode, new { error = "Failed to update task status" });
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            _logger.LogInformation("Task status updated successfully. TaskId: {TaskId}, Status: {Status}", 
                taskId, request.Status);

            return Ok(new { message = "Task status updated successfully", taskId = taskId, status = request.Status });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating task status. TaskId: {TaskId}", taskId);
            return StatusCode(500, new { error = "An error occurred while updating task status" });
        }
    }
}
