using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TaskService.Application.DTOs;
using TaskService.Application.Gmail;
using TaskService.Application.Interfaces;
using TaskService.Domain.Entities;
using TaskService.Infrastructure.Persistence;

namespace TaskService.Application.Services;

public class GmailInboundService : IGmailInboundService
{
    private readonly TaskDbContext _db;
    private readonly ITaskService _taskService;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly GmailOptions _options;
    private readonly ILogger<GmailInboundService> _logger;

    public GmailInboundService(
        TaskDbContext db,
        ITaskService taskService,
        IHttpClientFactory httpClientFactory,
        IOptions<GmailOptions> options,
        ILogger<GmailInboundService> logger)
    {
        _db = db;
        _taskService = taskService;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _logger = logger;
    }

    public async System.Threading.Tasks.Task HandlePushAsync(string pushBody, string? authorizationHeader)
    {
        if (_options.OrganizationId == Guid.Empty)
            throw new InvalidOperationException("Gmail:OrganizationId is required.");

        await EnsurePushAuthorizedAsync(authorizationHeader);

        using var doc = JsonDocument.Parse(pushBody);
        var data = doc.RootElement.GetProperty("message").GetProperty("data").GetString()
            ?? throw new InvalidOperationException("Pub/Sub message has no data.");
        var json = Encoding.UTF8.GetString(Convert.FromBase64String(PadBase64(data.Replace('-', '+').Replace('_', '/'))));
        using var notice = JsonDocument.Parse(json);
        var historyId = notice.RootElement.GetProperty("historyId").ToString();

        var accessToken = await GetAccessTokenAsync();
        var state = await _db.GmailWatchStates.FirstOrDefaultAsync(s => s.Id == 1);
        var messageIds = state == null
            ? await ListUnreadAsync(accessToken)
            : await ListAddedSinceAsync(accessToken, state.HistoryId);

        foreach (var messageId in messageIds.Distinct())
        {
            if (await _db.GmailIngestedMessages.AnyAsync(m => m.MessageId == messageId))
                continue;

            Guid? taskId = null;
            try
            {
                taskId = await CreateFromMessageAsync(accessToken, messageId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create a task from Gmail message {MessageId}", messageId);
                throw;
            }

            _db.GmailIngestedMessages.Add(new GmailIngestedMessage
            {
                MessageId = messageId,
                TaskId = taskId,
                ProcessedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        if (state == null)
        {
            _db.GmailWatchStates.Add(new GmailWatchState
            {
                Id = 1,
                HistoryId = historyId,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            state.HistoryId = historyId;
            state.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task RenewWatchAsync(string? watchKey)
    {
        if (string.IsNullOrEmpty(_options.WatchKey) || watchKey != _options.WatchKey)
            throw new UnauthorizedAccessException("Invalid watch key.");
        if (string.IsNullOrWhiteSpace(_options.PubSubTopic))
            throw new InvalidOperationException("Gmail:PubSubTopic is required.");

        var accessToken = await GetAccessTokenAsync();
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var body = JsonSerializer.Serialize(new
        {
            topicName = _options.PubSubTopic,
            labelIds = new[] { "INBOX" }
        });
        var response = await client.PostAsync(
            "https://gmail.googleapis.com/gmail/v1/users/me/watch",
            new StringContent(body, Encoding.UTF8, "application/json"));
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var historyId = doc.RootElement.GetProperty("historyId").ToString();
        var state = await _db.GmailWatchStates.FirstOrDefaultAsync(s => s.Id == 1);
        if (state == null)
        {
            _db.GmailWatchStates.Add(new GmailWatchState
            {
                Id = 1,
                HistoryId = historyId,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else if (string.IsNullOrEmpty(state.HistoryId))
        {
            state.HistoryId = historyId;
            state.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Gmail watch renewed. HistoryId: {HistoryId}", historyId);
    }

    private async System.Threading.Tasks.Task<Guid> CreateFromMessageAsync(string accessToken, string messageId)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var response = await client.GetAsync(
            $"https://gmail.googleapis.com/gmail/v1/users/me/messages/{messageId}?format=full");
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var payload = doc.RootElement.GetProperty("payload");

        var subject = Header(payload, "Subject");
        var from = Header(payload, "From");
        var dateHeader = Header(payload, "Date");
        var received = DateTime.TryParse(dateHeader, out var parsed) ? parsed.ToUniversalTime() : DateTime.UtcNow;
        var plain = ExtractPlain(payload);
        var taskData = GmailEnquiryParser.ToTaskData(plain, from, subject, received, messageId);

        var name = string.IsNullOrWhiteSpace(subject) ? "(no subject)" : subject.Trim();
        if (name.Length > 200)
            name = name[..200];

        var created = await _taskService.CreateTaskForOrganizationAsync(new TaskCreateDto
        {
            TaskName = name,
            Description = plain,
            TaskType = string.Empty,
            TaskData = taskData
        }, _options.OrganizationId);

        _logger.LogInformation(
            "Created task {TaskId} from Gmail message {MessageId}",
            created.TaskId, messageId);
        return created.TaskId;
    }

    private async System.Threading.Tasks.Task EnsurePushAuthorizedAsync(string? authorizationHeader)
    {
        if (string.IsNullOrWhiteSpace(_options.PushAudience))
            throw new UnauthorizedAccessException("Gmail:PushAudience is required.");

        if (string.IsNullOrWhiteSpace(authorizationHeader) ||
            !authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Pub/Sub bearer token is required.");

        var token = authorizationHeader["Bearer ".Length..].Trim();
        var client = _httpClientFactory.CreateClient();
        var response = await client.GetAsync(
            "https://oauth2.googleapis.com/tokeninfo?id_token=" + Uri.EscapeDataString(token));
        if (!response.IsSuccessStatusCode)
            throw new UnauthorizedAccessException("Pub/Sub token was rejected.");

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var aud = doc.RootElement.TryGetProperty("aud", out var audProp) ? audProp.GetString() : null;
        var emailVerified = doc.RootElement.TryGetProperty("email_verified", out var verifiedProp)
            ? verifiedProp.GetString()
            : null;
        if (!string.Equals(aud, _options.PushAudience, StringComparison.Ordinal) ||
            !string.Equals(emailVerified, "true", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Pub/Sub token audience was rejected.");
    }

    private async System.Threading.Tasks.Task<string> GetAccessTokenAsync()
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId) ||
            string.IsNullOrWhiteSpace(_options.ClientSecret) ||
            string.IsNullOrWhiteSpace(_options.RefreshToken))
            throw new InvalidOperationException("Gmail OAuth client id, secret, and refresh token are required.");

        var client = _httpClientFactory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["refresh_token"] = _options.RefreshToken,
            ["grant_type"] = "refresh_token"
        });
        var response = await client.PostAsync("https://oauth2.googleapis.com/token", form);
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("Gmail token response had no access_token.");
    }

    private async System.Threading.Tasks.Task<List<string>> ListUnreadAsync(string accessToken)
    {
        var client = Authorized(accessToken);
        var response = await client.GetAsync(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10");
        response.EnsureSuccessStatusCode();
        return ReadMessageIds(await response.Content.ReadAsStringAsync());
    }

    private async System.Threading.Tasks.Task<List<string>> ListAddedSinceAsync(string accessToken, string startHistoryId)
    {
        var client = Authorized(accessToken);
        var response = await client.GetAsync(
            "https://gmail.googleapis.com/gmail/v1/users/me/history?historyTypes=messageAdded&startHistoryId="
            + Uri.EscapeDataString(startHistoryId));
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return new List<string>();
        response.EnsureSuccessStatusCode();

        var ids = new List<string>();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        if (!doc.RootElement.TryGetProperty("history", out var history))
            return ids;

        foreach (var entry in history.EnumerateArray())
        {
            if (!entry.TryGetProperty("messagesAdded", out var added))
                continue;
            foreach (var item in added.EnumerateArray())
            {
                if (item.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("id", out var id))
                {
                    var value = id.GetString();
                    if (!string.IsNullOrEmpty(value))
                        ids.Add(value);
                }
            }
        }

        return ids;
    }

    private HttpClient Authorized(string accessToken)
    {
        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return client;
    }

    private static List<string> ReadMessageIds(string json)
    {
        var ids = new List<string>();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("messages", out var messages))
            return ids;
        foreach (var message in messages.EnumerateArray())
        {
            if (message.TryGetProperty("id", out var id))
            {
                var value = id.GetString();
                if (!string.IsNullOrEmpty(value))
                    ids.Add(value);
            }
        }
        return ids;
    }

    private static string Header(JsonElement payload, string name)
    {
        if (!payload.TryGetProperty("headers", out var headers))
            return string.Empty;
        foreach (var header in headers.EnumerateArray())
        {
            if (header.TryGetProperty("name", out var headerName) &&
                string.Equals(headerName.GetString(), name, StringComparison.OrdinalIgnoreCase) &&
                header.TryGetProperty("value", out var value))
                return value.GetString() ?? string.Empty;
        }
        return string.Empty;
    }

    private static string ExtractPlain(JsonElement payload)
    {
        var direct = PartText(payload, "text/plain");
        if (!string.IsNullOrWhiteSpace(direct))
            return direct;
        return PartText(payload, "text/html");
    }

    private static string PartText(JsonElement part, string mime)
    {
        var partMime = part.TryGetProperty("mimeType", out var mimeProp) ? mimeProp.GetString() : null;
        if (string.Equals(partMime, mime, StringComparison.OrdinalIgnoreCase) &&
            part.TryGetProperty("body", out var body) &&
            body.TryGetProperty("data", out var data))
        {
            var raw = data.GetString();
            if (!string.IsNullOrEmpty(raw))
            {
                var text = Encoding.UTF8.GetString(Convert.FromBase64String(PadBase64(raw.Replace('-', '+').Replace('_', '/'))));
                return mime == "text/html" ? StripTags(text) : text;
            }
        }

        if (!part.TryGetProperty("parts", out var parts))
            return string.Empty;
        foreach (var child in parts.EnumerateArray())
        {
            var text = PartText(child, mime);
            if (!string.IsNullOrWhiteSpace(text))
                return text;
        }
        return string.Empty;
    }

    private static string StripTags(string html) =>
        System.Text.RegularExpressions.Regex.Replace(html, "<[^>]+>", " ").Trim();

    private static string PadBase64(string value)
    {
        var pad = value.Length % 4;
        return pad == 0 ? value : value + new string('=', 4 - pad);
    }
}
