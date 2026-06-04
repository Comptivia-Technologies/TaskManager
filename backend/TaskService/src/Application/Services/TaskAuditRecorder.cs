using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using TaskService.Application.DTOs;
using TaskService.Application.Interfaces;
using TaskService.Infrastructure.Http;

namespace TaskService.Application.Services;

public class TaskAuditRecorder : ITaskAuditRecorder
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TaskAuditRecorder> _logger;

    public TaskAuditRecorder(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<TaskAuditRecorder> logger)
    {
        _httpClient = httpClientFactory.CreateClient(WorkflowManagementApiClientNames.ClientName);
        _configuration = configuration;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task TryRecordAsync(Guid taskId, TaskAuditRecordDto record)
    {
        try
        {
            var baseUrl = _configuration[$"{WorkflowManagementApiOptions.SectionName}:BaseUrl"]
                ?? _configuration["WorkflowManagementApi:BaseUrl"]
                ?? "http://localhost:5000/api";

            var response = await _httpClient.PostAsJsonAsync(
                $"{baseUrl.TrimEnd('/')}/tasks/{taskId}/audit",
                new
                {
                    record.EventId,
                    record.ActionType,
                    record.MemberId,
                    record.FromMemberId,
                    record.ToMemberId,
                    record.StageId,
                    record.StageName,
                    record.NextStageId,
                    record.NextStageName,
                    record.Reason,
                    record.CorrelationId,
                    record.OccurredAt
                });

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogWarning(
                    "Failed to record task audit. TaskId: {TaskId}, ActionType: {ActionType}, Status: {Status}, Body: {Body}",
                    taskId, record.ActionType, response.StatusCode, body);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Error recording task audit (non-fatal). TaskId: {TaskId}, ActionType: {ActionType}",
                taskId, record.ActionType);
        }
    }
}
