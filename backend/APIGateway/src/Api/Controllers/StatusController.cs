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

    // Valid status values
    private static readonly Dictionary<string, int> StatusMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "Created", 0 },
        { "WorkflowSelected", 1 },
        { "SLAConfigured", 2 },
        { "Assigned", 3 },
        { "InProgress", 4 },
        { "Completed", 5 },
        { "Overdue", 6 },
        { "Cancelled", 7 },
        { "Escalated", 8 }
    };

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

            // Parse status string to numeric value (supports both string and numeric)
            int statusValue;
            if (int.TryParse(request.Status, out int statusNumber))
            {
                // Numeric input (backward compatibility)
                if (statusNumber < 0 || statusNumber > 8)
                {
                    return BadRequest(new { error = "Status must be between 0 and 8" });
                }
                statusValue = statusNumber;
            }
            else
            {
                // String input - case-insensitive lookup
                if (!StatusMap.TryGetValue(request.Status, out statusValue))
                {
                    var validStatuses = string.Join(", ", StatusMap.Keys);
                    return BadRequest(new { 
                        error = $"Invalid status '{request.Status}'. Valid values are: {validStatuses} (or numeric 0-8)" 
                    });
                }
            }

            // Create DTO for TaskService
            var updateDto = new { Status = statusValue };

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
            var statusName = StatusMap.FirstOrDefault(kvp => kvp.Value == statusValue).Key ?? statusValue.ToString();
            _logger.LogInformation("Task status updated successfully. TaskId: {TaskId}, Status: {Status}", 
                taskId, statusName);

            return Ok(new { message = "Task status updated successfully", taskId = taskId, status = statusName });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating task status. TaskId: {TaskId}", taskId);
            return StatusCode(500, new { error = "An error occurred while updating task status" });
        }
    }
}
