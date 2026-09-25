namespace TaskService.Domain.Entities;

/// <summary>
/// A Gmail mailbox that has allowed this app to read mail. One refresh token per address.
/// </summary>
public class GmailMailbox
{
    public Guid MailboxId { get; set; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public string HistoryId { get; set; } = string.Empty;
    public DateTime ConnectedAt { get; set; }
}
