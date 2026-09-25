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
        var email = notice.RootElement.TryGetProperty("emailAddress", out var emailProp)
            ? emailProp.GetString()
            : null;

        var mailbox = string.IsNullOrWhiteSpace(email)
            ? null
            : await _db.GmailMailboxes.FirstOrDefaultAsync(m => m.Email.ToLower() == email.ToLower());

        if (mailbox == null)
        {
            _logger.LogWarning("No connected mailbox for Gmail notification {Email}", email);
            return;
        }

        var accessToken = await GetAccessTokenAsync(mailbox.RefreshToken);
        var messageIds = string.IsNullOrEmpty(mailbox.HistoryId)
            ? await ListUnreadAsync(accessToken)
            : await ListAddedSinceAsync(accessToken, mailbox.HistoryId);

        foreach (var messageId in messageIds.Distinct())
        {
            if (await _db.GmailIngestedMessages.AnyAsync(m => m.MessageId == messageId))
                continue;

            var taskId = await CreateFromMessageAsync(accessToken, messageId, mailbox.OrganizationId);
            _db.GmailIngestedMessages.Add(new GmailIngestedMessage
            {
                MessageId = messageId,
                TaskId = taskId,
                ProcessedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync();
        }

        mailbox.HistoryId = historyId;
        await _db.SaveChangesAsync();
    }

    public string BuildAuthorizeUrl(string? email)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId) || string.IsNullOrWhiteSpace(_options.OAuthRedirectUri))
            throw new InvalidOperationException("Gmail OAuth client id and redirect URI are required.");

        var query = new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["redirect_uri"] = _options.OAuthRedirectUri,
            ["response_type"] = "code",
            ["scope"] = "https://www.googleapis.com/auth/gmail.readonly",
            ["access_type"] = "offline",
            ["prompt"] = "consent",
            ["state"] = "gmail"
        };
        if (!string.IsNullOrWhiteSpace(email))
            query["login_hint"] = email.Trim();
        return "https://accounts.google.com/o/oauth2/v2/auth?" + string.Join("&",
            query.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
    }

    public async System.Threading.Tasks.Task<IReadOnlyList<GmailMailboxSummary>> ListMailboxesAsync(Guid organizationId)
    {
        return await _db.GmailMailboxes
            .Where(m => m.OrganizationId == organizationId)
            .OrderBy(m => m.Email)
            .Select(m => new GmailMailboxSummary(m.MailboxId, m.Email, m.ConnectedAt))
            .ToListAsync();
    }

    public async System.Threading.Tasks.Task<GmailMailboxSummary> ConnectAsync(string code, Guid organizationId)
    {
        if (organizationId == Guid.Empty)
            organizationId = _options.OrganizationId;
        if (organizationId == Guid.Empty)
            throw new UnauthorizedAccessException("Organization context required.");

        var refreshToken = await ExchangeCodeAsync(code);
        var accessToken = await GetAccessTokenAsync(refreshToken);
        var email = await GetProfileEmailAsync(accessToken);
        var mailbox = await _db.GmailMailboxes.FirstOrDefaultAsync(m => m.Email.ToLower() == email.ToLower());
        if (mailbox == null)
        {
            mailbox = new GmailMailbox
            {
                OrganizationId = organizationId,
                Email = email,
                RefreshToken = refreshToken,
                ConnectedAt = DateTime.UtcNow
            };
            _db.GmailMailboxes.Add(mailbox);
        }
        else
        {
            mailbox.OrganizationId = organizationId;
            mailbox.RefreshToken = refreshToken;
            mailbox.ConnectedAt = DateTime.UtcNow;
        }

        mailbox.HistoryId = await StartWatchAsync(accessToken);
        await _db.SaveChangesAsync();
        return new GmailMailboxSummary(mailbox.MailboxId, mailbox.Email, mailbox.ConnectedAt);
    }

    public async System.Threading.Tasks.Task DisconnectAsync(Guid mailboxId, Guid organizationId)
    {
        var mailbox = await _db.GmailMailboxes.FirstOrDefaultAsync(m =>
            m.MailboxId == mailboxId && m.OrganizationId == organizationId);
        if (mailbox == null)
            return;
        _db.GmailMailboxes.Remove(mailbox);
        await _db.SaveChangesAsync();
    }

    public async System.Threading.Tasks.Task RenewWatchAsync(string? watchKey)
    {
        if (string.IsNullOrEmpty(_options.WatchKey) || watchKey != _options.WatchKey)
            throw new UnauthorizedAccessException("Invalid watch key.");
        if (string.IsNullOrWhiteSpace(_options.PubSubTopic))
            throw new InvalidOperationException("Gmail:PubSubTopic is required.");

        var mailboxes = await _db.GmailMailboxes.ToListAsync();
        foreach (var mailbox in mailboxes)
        {
            var accessToken = await GetAccessTokenAsync(mailbox.RefreshToken);
            mailbox.HistoryId = await StartWatchAsync(accessToken);
        }

        await _db.SaveChangesAsync();
        _logger.LogInformation("Gmail watch renewed for {Count} mailboxes", mailboxes.Count);
    }

    private async System.Threading.Tasks.Task<Guid> CreateFromMessageAsync(string accessToken, string messageId, Guid organizationId)
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
        }, organizationId);

        _logger.LogInformation(
            "Created task {TaskId} from Gmail message {MessageId}",
            created.TaskId, messageId);
        return created.TaskId;
    }

    private async System.Threading.Tasks.Task<string> ExchangeCodeAsync(string code)
    {
        var client = _httpClientFactory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["redirect_uri"] = _options.OAuthRedirectUri,
            ["grant_type"] = "authorization_code"
        });
        var response = await client.PostAsync("https://oauth2.googleapis.com/token", form);
        var payload = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException("Google did not accept the authorization code.");

        using var doc = JsonDocument.Parse(payload);
        var refreshToken = doc.RootElement.TryGetProperty("refresh_token", out var token) ? token.GetString() : null;
        if (string.IsNullOrWhiteSpace(refreshToken))
            throw new InvalidOperationException("Google did not return a refresh token. Connect the mailbox again and allow access.");
        return refreshToken;
    }

    private async System.Threading.Tasks.Task<string> GetProfileEmailAsync(string accessToken)
    {
        var client = Authorized(accessToken);
        var response = await client.GetAsync("https://gmail.googleapis.com/gmail/v1/users/me/profile");
        response.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.GetProperty("emailAddress").GetString()
            ?? throw new InvalidOperationException("Gmail profile had no email address.");
    }

    private async System.Threading.Tasks.Task<string> StartWatchAsync(string accessToken)
    {
        if (string.IsNullOrWhiteSpace(_options.PubSubTopic))
            return string.Empty;

        var client = Authorized(accessToken);
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
        return doc.RootElement.GetProperty("historyId").ToString();
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

    private async System.Threading.Tasks.Task<string> GetAccessTokenAsync(string refreshToken)
    {
        if (string.IsNullOrWhiteSpace(_options.ClientId) ||
            string.IsNullOrWhiteSpace(_options.ClientSecret) ||
            string.IsNullOrWhiteSpace(refreshToken))
            throw new InvalidOperationException("Gmail OAuth client id, secret, and refresh token are required.");

        var client = _httpClientFactory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["refresh_token"] = refreshToken,
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
