namespace TaskService.Domain.Entities;

/// <summary>
/// Last Gmail history id seen for the mailbox. The next notification lists only newer mail.
/// </summary>
public class GmailWatchState
{
    public int Id { get; set; } = 1;
    public string HistoryId { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}
