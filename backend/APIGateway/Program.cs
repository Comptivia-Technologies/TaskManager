using Shared.Messaging;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Event Bus - Register all providers
builder.Services.Configure<AwsEventBusOptions>(builder.Configuration.GetSection("EventBus:AWS"));
builder.Services.AddSingleton<AwsEventBus>();

builder.Services.Configure<AzureEventBusOptions>(builder.Configuration.GetSection("EventBus:Azure"));
builder.Services.AddSingleton<AzureEventBus>();

builder.Services.Configure<GcpEventBusOptions>(builder.Configuration.GetSection("EventBus:GCP"));
builder.Services.AddSingleton<GcpEventBus>();

// Factory pattern - resolves provider from configuration
builder.Services.AddSingleton<IEventBusFactory, EventBusFactory>();
builder.Services.AddSingleton<IEventBus>(sp => sp.GetRequiredService<IEventBusFactory>().CreateEventBus());

// YARP Reverse Proxy - Load config and override with environment variables
var reverseProxyConfig = builder.Configuration.GetSection("ReverseProxy");
builder.Services.AddReverseProxy()
    .LoadFromConfig(reverseProxyConfig);

// Override ReverseProxy cluster addresses from environment variables after config load
builder.Services.PostConfigure<Yarp.ReverseProxy.Configuration.ReverseProxyOptions>(options =>
{
    // Override cluster addresses from environment variables if provided
    var workflowBase = Environment.GetEnvironmentVariable("WORKFLOW_MANAGEMENT_API_BASE");
    var slaBase = Environment.GetEnvironmentVariable("SLA_CONFIGURATION_API_BASE");
    var priorityBase = Environment.GetEnvironmentVariable("PRIORITY_RULE_ENGINE_API_BASE");
    var workloadBase = Environment.GetEnvironmentVariable("WORKLOAD_API_BASE");
    var taskServiceBase = Environment.GetEnvironmentVariable("TASK_SERVICE_API_BASE");

    if (!string.IsNullOrEmpty(workflowBase) && options.Clusters.ContainsKey("workflow-cluster"))
    {
        options.Clusters["workflow-cluster"].Destinations["destination1"].Address = workflowBase;
    }
    else if (options.Clusters.ContainsKey("workflow-cluster") && 
             string.IsNullOrEmpty(options.Clusters["workflow-cluster"].Destinations["destination1"].Address))
    {
        options.Clusters["workflow-cluster"].Destinations["destination1"].Address = "http://localhost:5000";
    }

    if (!string.IsNullOrEmpty(slaBase) && options.Clusters.ContainsKey("sla-cluster"))
    {
        options.Clusters["sla-cluster"].Destinations["destination1"].Address = slaBase;
    }
    else if (options.Clusters.ContainsKey("sla-cluster") && 
             string.IsNullOrEmpty(options.Clusters["sla-cluster"].Destinations["destination1"].Address))
    {
        options.Clusters["sla-cluster"].Destinations["destination1"].Address = "http://localhost:5002";
    }

    if (!string.IsNullOrEmpty(priorityBase) && options.Clusters.ContainsKey("priority-cluster"))
    {
        options.Clusters["priority-cluster"].Destinations["destination1"].Address = priorityBase;
    }
    else if (options.Clusters.ContainsKey("priority-cluster") && 
             string.IsNullOrEmpty(options.Clusters["priority-cluster"].Destinations["destination1"].Address))
    {
        options.Clusters["priority-cluster"].Destinations["destination1"].Address = "http://localhost:5010";
    }

    if (!string.IsNullOrEmpty(workloadBase) && options.Clusters.ContainsKey("workload-cluster"))
    {
        options.Clusters["workload-cluster"].Destinations["destination1"].Address = workloadBase;
    }
    else if (options.Clusters.ContainsKey("workload-cluster") && 
             string.IsNullOrEmpty(options.Clusters["workload-cluster"].Destinations["destination1"].Address))
    {
        options.Clusters["workload-cluster"].Destinations["destination1"].Address = "http://localhost:5003";
    }

    if (!string.IsNullOrEmpty(taskServiceBase) && options.Clusters.ContainsKey("task-service-cluster"))
    {
        options.Clusters["task-service-cluster"].Destinations["destination1"].Address = taskServiceBase;
    }
    else if (options.Clusters.ContainsKey("task-service-cluster") && 
             string.IsNullOrEmpty(options.Clusters["task-service-cluster"].Destinations["destination1"].Address))
    {
        options.Clusters["task-service-cluster"].Destinations["destination1"].Address = "http://localhost:5005";
    }
});

// HttpClient for proxy
builder.Services.AddHttpClient();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseHttpsRedirection();
app.UseAuthorization();

// Map controllers (for task creation endpoint that publishes to EventBus)
app.MapControllers();

// Map reverse proxy routes (for all other services)
app.MapReverseProxy();

app.Run();

