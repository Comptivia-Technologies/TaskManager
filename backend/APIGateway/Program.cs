using Shared.Messaging;
using APIGateway.Infrastructure.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Event Bus - Register all providers (factory pattern allows switching via config) for EventBus
builder.Services.Configure<AwsEventBusOptions>(builder.Configuration.GetSection("EventBus:AWS"));
builder.Services.AddSingleton<AwsEventBus>();

builder.Services.Configure<AzureEventBusOptions>(builder.Configuration.GetSection("EventBus:Azure"));
builder.Services.AddSingleton<AzureEventBus>();

builder.Services.Configure<GcpEventBusOptions>(builder.Configuration.GetSection("EventBus:GCP"));
builder.Services.AddSingleton<GcpEventBus>();

// Factory pattern - resolves provider from configuration
builder.Services.AddSingleton<IEventBusFactory, EventBusFactory>();
builder.Services.AddSingleton<IEventBus>(sp => sp.GetRequiredService<IEventBusFactory>().CreateEventBus());

// YARP Reverse Proxy - Load config
// Note: Cluster addresses can be overridden via environment variables using the format:
// ReverseProxy__Clusters__{cluster-name}__Destinations__{destination-name}__Address
var reverseProxyConfig = builder.Configuration.GetSection("ReverseProxy");
builder.Services.AddReverseProxy()
    .LoadFromConfig(reverseProxyConfig);

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

// API Key Authentication Middleware (before authorization)
app.UseMiddleware<ApiKeyMiddleware>();

app.UseAuthorization();

// Map controllers (for task creation endpoint that publishes to EventBus)
app.MapControllers();

// Map reverse proxy routes (for all other services)
app.MapReverseProxy();

app.Run();

