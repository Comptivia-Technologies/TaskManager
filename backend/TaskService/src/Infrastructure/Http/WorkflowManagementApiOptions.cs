namespace TaskService.Infrastructure.Http;

public class WorkflowManagementApiOptions
{
    public const string SectionName = "WorkflowManagementApi";

    public string BaseUrl { get; set; } = string.Empty;
    public string ServiceEmail { get; set; } = string.Empty;
    public string ServicePassword { get; set; } = string.Empty;
}
