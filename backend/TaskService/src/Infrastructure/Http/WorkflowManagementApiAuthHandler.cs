using System.Net;
using System.Net.Http.Headers;

namespace TaskService.Infrastructure.Http;

public class WorkflowManagementApiAuthHandler : DelegatingHandler
{
    private readonly IWorkflowManagementApiTokenProvider _tokenProvider;

    public WorkflowManagementApiAuthHandler(IWorkflowManagementApiTokenProvider tokenProvider)
    {
        _tokenProvider = tokenProvider;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var token = await _tokenProvider.GetTokenAsync(cancellationToken);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await base.SendAsync(request, cancellationToken);
        if (response.StatusCode != HttpStatusCode.Unauthorized)
        {
            return response;
        }

        response.Dispose();
        await _tokenProvider.InvalidateAsync();

        using var retryRequest = await CloneRequestAsync(request);
        var retryToken = await _tokenProvider.GetTokenAsync(cancellationToken);
        retryRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", retryToken);

        return await base.SendAsync(retryRequest, cancellationToken);
    }

    private static async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage request)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri);

        if (request.Content != null)
        {
            var contentBytes = await request.Content.ReadAsByteArrayAsync();
            clone.Content = new ByteArrayContent(contentBytes);

            foreach (var header in request.Content.Headers)
            {
                clone.Content.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }
        }

        foreach (var header in request.Headers)
        {
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        clone.Version = request.Version;
        return clone;
    }
}
