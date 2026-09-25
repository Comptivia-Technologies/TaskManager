namespace TaskService.Application.Interfaces;

public interface IGmailInboundService
{
    System.Threading.Tasks.Task HandlePushAsync(string pushBody, string? authorizationHeader);
    System.Threading.Tasks.Task RenewWatchAsync(string? watchKey);
    string BuildAuthorizeUrl(string? email);
    System.Threading.Tasks.Task<IReadOnlyList<GmailMailboxSummary>> ListMailboxesAsync(Guid organizationId);
    System.Threading.Tasks.Task<GmailMailboxSummary> ConnectAsync(string code, Guid organizationId);
    System.Threading.Tasks.Task DisconnectAsync(Guid mailboxId, Guid organizationId);
}

public sealed record GmailMailboxSummary(Guid MailboxId, string Email, DateTime ConnectedAt);
