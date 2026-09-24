namespace TaskService.Application.Gmail;

public class GmailOptions
{
    public const string SectionName = "Gmail";

    public Guid OrganizationId { get; set; }

    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;

    /// <summary>projects/{project}/topics/gmail-enquiries</summary>
    public string PubSubTopic { get; set; } = string.Empty;

    /// <summary>Audience (aud) expected on the Pub/Sub push OIDC token.</summary>
    public string PushAudience { get; set; } = string.Empty;

    /// <summary>Shared secret for the watch-renew endpoint. Sent as X-Gmail-Watch-Key.</summary>
    public string WatchKey { get; set; } = string.Empty;
}
