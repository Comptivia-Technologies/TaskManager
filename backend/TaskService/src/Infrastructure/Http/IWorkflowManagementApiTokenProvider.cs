namespace TaskService.Infrastructure.Http;

public interface IWorkflowManagementApiTokenProvider
{
    Task<string> GetTokenAsync(CancellationToken cancellationToken = default);
    Task InvalidateAsync();
}
