namespace TaskService.Infrastructure.Http;

public static class WorkflowManagementApiServiceCollectionExtensions
{
    public static IServiceCollection AddWorkflowManagementApiClient(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<WorkflowManagementApiOptions>(configuration.GetSection(WorkflowManagementApiOptions.SectionName));
        services.AddSingleton<IWorkflowManagementApiTokenProvider, WorkflowManagementApiTokenProvider>();
        services.AddTransient<WorkflowManagementApiAuthHandler>();
        services.AddHttpClient(WorkflowManagementApiClientNames.ClientName)
            .AddHttpMessageHandler<WorkflowManagementApiAuthHandler>();

        return services;
    }
}
