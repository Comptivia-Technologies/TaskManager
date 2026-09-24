using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Shared.Messaging;
using APIGateway.Infrastructure.Middleware;
using APIGateway.Infrastructure.Transforms;
using Yarp.ReverseProxy.Transforms.Builder;

var builder = WebApplication.CreateBuilder(args);

var firebaseProjectId = builder.Configuration["Firebase:ProjectId"] ?? "product-hub-478006";

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://securetoken.google.com/{firebaseProjectId}";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = $"https://securetoken.google.com/{firebaseProjectId}",
            ValidAudience = firebaseProjectId,
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
        };
    });

// Event Bus - Register all providers (factory pattern allows switching via config) for EventBus
builder.Services.Configure<AwsEventBusOptions>(builder.Configuration.GetSection("EventBus:AWS"));
builder.Services.AddSingleton<AwsEventBus>();

builder.Services.Configure<AzureEventBusOptions>(builder.Configuration.GetSection("EventBus:Azure"));
builder.Services.AddSingleton<AzureEventBus>();

builder.Services.Configure<GcpEventBusOptions>(builder.Configuration.GetSection("EventBus:GCP"));
builder.Services.AddSingleton<GcpEventBus>();

builder.Services.Configure<RabbitMQEventBusOptions>(builder.Configuration.GetSection("EventBus:RabbitMQ"));
builder.Services.AddSingleton<RabbitMQEventBus>();

// Factory pattern - resolves provider from configuration
builder.Services.AddSingleton<IEventBusFactory, EventBusFactory>();
builder.Services.AddSingleton<IEventBus>(sp => sp.GetRequiredService<IEventBusFactory>().CreateEventBus());

// YARP Reverse Proxy - Load config (this is the reverse proxy for the API Gateway) This is the reverse proxy for the API Gateway
// Note: Cluster addresses can be overridden via environment variables using the format:
// ReverseProxy__Clusters__{cluster-name}__Destinations__{destination-name}__Address
var reverseProxyConfig = builder.Configuration.GetSection("ReverseProxy");
builder.Services.AddReverseProxy()
    .LoadFromConfig(reverseProxyConfig)
    .AddTransforms(transformBuilderContext =>
    {
        transformBuilderContext.RequestTransforms.Add(new ForwardOrganizationIdTransform());
    });

// HttpClient for proxy
builder.Services.AddHttpClient();

// Caller permissions are resolved once here and forwarded to the services, so a
// service can enforce a permission without learning how roles are assigned.
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<APIGateway.Infrastructure.Services.CallerPermissionResolver>();

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

app.UseAuthentication();
app.UseMiddleware<OrganizationAuthMiddleware>();
app.UseAuthorization();

// Map controllers (for task creation endpoint that publishes to EventBus)
app.MapControllers();

// Map reverse proxy routes (for all other services)
app.MapReverseProxy();

app.Run();

