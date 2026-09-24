namespace TaskService.Application.Interfaces;

public interface IGmailInboundService
{
    System.Threading.Tasks.Task HandlePushAsync(string pushBody, string? authorizationHeader);
    System.Threading.Tasks.Task RenewWatchAsync(string? watchKey);
}
