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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=TaskService;Username=postgres;Password=postgres";

builder.Services.AddDbContext<TaskDbContext>(options =>
    options.UseNpgsql(connectionString));

// RabbitMQ
builder.Services.Configure<RabbitMQOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.AddSingleton<IRabbitMQPublisher, RabbitMQPublisher>();
builder.Services.AddSingleton<IRabbitMQConsumer, RabbitMQConsumer>();

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

// Start RabbitMQ consumers
var consumer = app.Services.GetRequiredService<IRabbitMQConsumer>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

// Subscribe to events - create scope for each event to resolve scoped handlers
// TaskService consumes TaskCreatedEvent to create tasks in its database
try
{
    logger.LogInformation("Starting TaskCreatedEvent consumer...");
    consumer.StartConsuming<TaskCreatedEvent>(
        RabbitMQConstants.TaskExchange,
        RabbitMQConstants.TaskCreatedQueue,
        RabbitMQConstants.TaskCreated,
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
    consumer.StartConsuming<WorkflowSelectedEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.WorkflowSelectedQueue,
        RabbitMQConstants.WorkflowSelected,
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
    consumer.StartConsuming<PriorityAssignedEvent>(
        RabbitMQConstants.TaskExchange,
        RabbitMQConstants.PriorityAssignedTaskQueue,
        RabbitMQConstants.PriorityAssigned,
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
    consumer.StartConsuming<SLAConfiguredEvent>(
        RabbitMQConstants.SLAExchange,
        RabbitMQConstants.SLAConfiguredQueue,
        RabbitMQConstants.SLAConfigured,
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
    consumer.StartConsuming<TaskAssignedEvent>(
        RabbitMQConstants.WorkloadExchange,
        RabbitMQConstants.TaskAssignedQueue,
        RabbitMQConstants.TaskAssigned,
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
    consumer.StartConsuming<TaskOverdueEvent>(
        RabbitMQConstants.SLAExchange,
        RabbitMQConstants.TaskOverdueQueue,
        RabbitMQConstants.TaskOverdue,
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
    consumer.StartConsuming<TaskStageStartedEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.TaskStageStartedQueue,
        RabbitMQConstants.TaskStageStarted,
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
    consumer.StartConsuming<TaskStageCompletedEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.TaskStageCompletedQueue,
        RabbitMQConstants.TaskStageCompleted,
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
    consumer.StartConsuming<TaskStageEscalationTriggeredEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.TaskStageEscalationTriggeredQueue,
        RabbitMQConstants.TaskStageEscalationTriggered,
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
    consumer.StartConsuming<TaskCompletedEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.TaskCompletedQueue,
        RabbitMQConstants.TaskCompleted,
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

