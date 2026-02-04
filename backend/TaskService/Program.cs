using Microsoft.EntityFrameworkCore;
using TaskService.Infrastructure.Persistence;
using TaskService.Application.Interfaces;
using TaskService.Infrastructure.Repositories;
using TaskService.Application.Services;
using TaskService.Application.EventHandlers;
using Shared.Messaging;
using Shared.Contracts.Constants;
using Shared.Contracts.EventContracts;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString))
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
    var dbPort = Environment.GetEnvironmentVariable("DB_PORT") ?? "5432";
    var dbName = Environment.GetEnvironmentVariable("DB_NAME") ?? "TaskService";
    var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD")
        ?? throw new InvalidOperationException("DB_PASSWORD environment variable is required");
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword}";
}

builder.Services.AddDbContext<TaskDbContext>(options =>
    options.UseNpgsql(connectionString));

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

// HTTP Client for syncing to WorkflowManagement.API
builder.Services.AddHttpClient();

// Repositories
builder.Services.AddScoped<ITaskRepository, TaskRepository>();

// Services
builder.Services.AddScoped<ITaskService, TaskService.Application.Services.TaskService>();

// Event Handlers
builder.Services.AddScoped<TaskCreatedEventHandler>();
builder.Services.AddScoped<WorkflowSelectedEventHandler>();
builder.Services.AddScoped<PriorityAssignedEventHandler>();
builder.Services.AddScoped<SLAConfiguredEventHandler>();
builder.Services.AddScoped<TaskAssignedEventHandler>();
builder.Services.AddScoped<TaskOverdueEventHandler>();
builder.Services.AddScoped<TaskStageStartedEventHandler>();
builder.Services.AddScoped<TaskStageCompletedEventHandler>();
builder.Services.AddScoped<TaskStageEscalationTriggeredEventHandler>();
builder.Services.AddScoped<TaskCompletedEventHandler>();

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
app.MapControllers();

// Start EventBus consumers
var eventBus = app.Services.GetRequiredService<IEventBus>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

// Subscribe to events - create scope for each event to resolve scoped handlers
// TaskService consumes events from its dedicated queue
try
{
    logger.LogInformation("Starting TaskCreatedEvent consumer...");
    eventBus.StartConsuming<TaskCreatedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskCreatedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskCreatedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskCreatedEvent consumer");
}

try
{
    logger.LogInformation("Starting WorkflowSelectedEvent consumer...");
    eventBus.StartConsuming<WorkflowSelectedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<WorkflowSelectedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ WorkflowSelectedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start WorkflowSelectedEvent consumer");
}

try
{
    logger.LogInformation("Starting PriorityAssignedEvent consumer...");
    eventBus.StartConsuming<PriorityAssignedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<PriorityAssignedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ PriorityAssignedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start PriorityAssignedEvent consumer");
}

try
{
    logger.LogInformation("Starting SLAConfiguredEvent consumer...");
    eventBus.StartConsuming<SLAConfiguredEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<SLAConfiguredEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ SLAConfiguredEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start SLAConfiguredEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskAssignedEvent consumer...");
    eventBus.StartConsuming<TaskAssignedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskAssignedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskAssignedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskAssignedEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskOverdueEvent consumer...");
    eventBus.StartConsuming<TaskOverdueEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskOverdueEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskOverdueEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskOverdueEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskStageStartedEvent consumer...");
    eventBus.StartConsuming<TaskStageStartedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStageStartedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStageStartedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStageStartedEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskStageCompletedEvent consumer...");
    eventBus.StartConsuming<TaskStageCompletedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStageCompletedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStageCompletedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStageCompletedEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskStageEscalationTriggeredEvent consumer...");
    eventBus.StartConsuming<TaskStageEscalationTriggeredEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStageEscalationTriggeredEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStageEscalationTriggeredEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStageEscalationTriggeredEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskCompletedEvent consumer...");
    eventBus.StartConsuming<TaskCompletedEvent>(
        EventBusConstants.TaskServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskCompletedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskCompletedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskCompletedEvent consumer");
}

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<TaskDbContext>();
    dbContext.Database.EnsureCreated();
}

app.Run();

