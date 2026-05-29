using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WorkflowService.Infrastructure.Persistence;
using WorkflowService.Application.Interfaces;
using WorkflowService.Infrastructure.Repositories;
using WorkflowService.Application.Services;
using WorkflowService.Application.EventHandlers;
using WorkflowService.Infrastructure.BackgroundJobs;
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
    var dbName = Environment.GetEnvironmentVariable("DB_NAME") ?? "WorkflowManagement";
    var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD")
        ?? throw new InvalidOperationException("DB_PASSWORD environment variable is required");
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword};SSL Mode=Require;Channel Binding=require";
}

builder.Services.AddDbContext<WorkflowDbContext>(options =>
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

// Repositories
builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>();

// Services
builder.Services.AddScoped<IWorkflowSelectionService, WorkflowSelectionService>();
// Add HttpClient for TaskService API calls
builder.Services.AddHttpClient<IStageOrchestrationService, StageOrchestrationService>();

// Event Handlers
builder.Services.AddScoped<TaskCreatedEventHandler>();
builder.Services.AddScoped<TaskAssignedEventHandler>();
builder.Services.AddScoped<TaskStageCompletedEventHandler>();
builder.Services.AddScoped<TaskStageEscalatedEventHandler>();
builder.Services.AddScoped<TaskStageEscalationTriggeredEventHandler>();

// Background Services
builder.Services.AddHostedService<StageEscalationMonitorService>();

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

var logger = app.Services.GetRequiredService<ILogger<Program>>();

// Ensure database and tables are created before starting event consumers
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
    try
    {
        logger.LogInformation("Ensuring WorkflowSelections table exists...");
        bool tableExists = true;
        try
        {
            await dbContext.Database.ExecuteSqlRawAsync("SELECT 1 FROM \"WorkflowSelections\" LIMIT 1");
            logger.LogInformation("WorkflowSelections table exists.");
        }
        catch
        {
            tableExists = false;
            logger.LogInformation("WorkflowSelections table does not exist. Creating...");
        }
        if (!tableExists)
        {
            await dbContext.Database.BeginTransactionAsync();
            try
            {
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE TABLE IF NOT EXISTS ""WorkflowSelections"" (
                        ""SelectionId"" UUID PRIMARY KEY,
                        ""TaskId"" UUID NOT NULL,
                        ""WorkflowId"" UUID NOT NULL,
                        ""WorkflowName"" VARCHAR(200) NOT NULL,
                        ""SelectionReason"" VARCHAR(500),
                        ""SelectedAt"" TIMESTAMP WITH TIME ZONE NOT NULL,
                        ""TaskCreatedEventId"" UUID,
                        ""StageOrchestrationStarted"" BOOLEAN NOT NULL DEFAULT FALSE,
                        ""StageOrchestrationStartedAt"" TIMESTAMP WITH TIME ZONE NULL
                    )");
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE UNIQUE INDEX IF NOT EXISTS ""IX_WorkflowSelections_TaskId"" ON ""WorkflowSelections"" (""TaskId"")");
                await dbContext.Database.ExecuteSqlRawAsync(@"
                    CREATE INDEX IF NOT EXISTS ""IX_WorkflowSelections_WorkflowId"" ON ""WorkflowSelections"" (""WorkflowId"")");
                await dbContext.Database.CommitTransactionAsync();
                logger.LogInformation("WorkflowSelections table created successfully.");
            }
            catch
            {
                await dbContext.Database.RollbackTransactionAsync();
                throw;
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "WorkflowSelections table could not be created. Application will not start. Ensure the database user has CREATE permission on the schema. Error: {Message}", ex.Message);
        throw;
    }
}

// Start EventBus consumers
var eventBus = app.Services.GetRequiredService<IEventBus>();

try
{
    logger.LogInformation("Starting TaskCreatedEvent consumer...");
    eventBus.StartConsuming<TaskCreatedEvent>(
        EventBusConstants.WorkflowServiceQueue,
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
    logger.LogInformation("Starting TaskAssignedEvent consumer...");
    eventBus.StartConsuming<TaskAssignedEvent>(
        EventBusConstants.WorkflowServiceQueue,
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
    logger.LogInformation("Starting TaskStageCompletedEvent consumer...");
    eventBus.StartConsuming<TaskStageCompletedEvent>(
        EventBusConstants.WorkflowServiceQueue,
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
    logger.LogInformation("Starting TaskStageEscalatedEvent consumer...");
    eventBus.StartConsuming<TaskStageEscalatedEvent>(
        EventBusConstants.WorkflowServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStageEscalatedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStageEscalatedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStageEscalatedEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskStageEscalationTriggeredEvent consumer...");
    eventBus.StartConsuming<TaskStageEscalationTriggeredEvent>(
        EventBusConstants.WorkflowServiceQueue,
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

app.Run();

