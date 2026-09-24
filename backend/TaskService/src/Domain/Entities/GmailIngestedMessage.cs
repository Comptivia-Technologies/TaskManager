namespace TaskService.Domain.Entities;

/// <summary>
/// One row per Gmail message that the push handler has already accepted.
/// A repeat Pub/Sub delivery finds this row and does not create another task.
/// </summary>
public class GmailIngestedMessage
{
    public string MessageId { get; set; } = string.Empty;
    public Guid? TaskId { get; set; }
    public DateTime ProcessedAt { get; set; }
}
