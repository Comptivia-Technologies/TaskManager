using Microsoft.EntityFrameworkCore;
using TaskService.Infrastructure.Persistence;
using TaskService.Application.Interfaces;
using TaskService.Infrastructure.Repositories;
using TaskService.Application.Services;
using TaskService.Application.EventHandlers;
using TaskService.Infrastructure.Http;
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
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword};SSL Mode=Require;Channel Binding=require";
}

builder.Services.AddDbContext<TaskDbContext>(options =>
    options.UseNpgsql(connectionString));

// Event Bus - Register all providers
builder.Services.Configure<AwsEventBusOptions>(builder.Configuration.GetSection("EventBus:AWS"));
builder.Services.AddSingleton<AwsEventBus>();

builder.Services.Configure<RabbitMQEventBusOptions>(builder.Configuration.GetSection("EventBus:RabbitMQ"));
builder.Services.AddSingleton<RabbitMQEventBus>();

builder.Services.Configure<AzureEventBusOptions>(builder.Configuration.GetSection("EventBus:Azure"));
builder.Services.AddSingleton<AzureEventBus>();

builder.Services.Configure<GcpEventBusOptions>(builder.Configuration.GetSection("EventBus:GCP"));
builder.Services.AddSingleton<GcpEventBus>();

// Factory pattern - resolves provider from configuration
builder.Services.AddSingleton<IEventBusFactory, EventBusFactory>();
builder.Services.AddSingleton<IEventBus>(sp => sp.GetRequiredService<IEventBusFactory>().CreateEventBus());

// HTTP Client for syncing to WorkflowManagement.API
builder.Services.AddWorkflowManagementApiClient(builder.Configuration);

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
builder.Services.AddScoped<TaskStageEscalatedEventHandler>();
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
    logger.LogInformation("Starting TaskStageEscalatedEvent consumer...");
    eventBus.StartConsuming<TaskStageEscalatedEvent>(
        EventBusConstants.TaskServiceQueue,
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
    // logger is already declared in outer scope (line 97), reuse it
    
    try
    {
        // Try EnsureCreated first
        var created = dbContext.Database.EnsureCreated();
        logger.LogInformation(created ? "Database and tables created successfully." : "Database already exists.");
        
        // CRITICAL: Verify Tasks table actually exists
        var connection = dbContext.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen)
            await connection.OpenAsync();
        
        try
        {
            // Check if Tasks table exists
            using var verifyCommand = connection.CreateCommand();
            verifyCommand.CommandText = @"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'Tasks'
            ";
            var tableExists = Convert.ToInt32(await verifyCommand.ExecuteScalarAsync()) > 0;
            
            if (!tableExists)
            {
                logger.LogWarning("Tasks table does not exist. EnsureCreated() may have failed. Creating table manually...");
                
                // Create Tasks table using raw SQL
                using var createCommand = connection.CreateCommand();
                createCommand.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""Tasks"" (
                        ""TaskId"" UUID PRIMARY KEY,
                        ""TaskName"" VARCHAR(200) NOT NULL,
                        ""Description"" TEXT,
                        ""Priority"" VARCHAR(50) NOT NULL,
                        ""TaskType"" VARCHAR(100) NOT NULL,
                        ""Status"" INTEGER NOT NULL DEFAULT 0,
                        ""WorkflowId"" UUID,
                        ""MemberId"" UUID,
                        ""SLAConfigurationId"" UUID,
                        ""CurrentStageId"" UUID,
                        ""CurrentStageStartedAt"" TIMESTAMP WITH TIME ZONE,
                        ""StageTimeoutAt"" TIMESTAMP WITH TIME ZONE,
                        ""SLADeadline"" TIMESTAMP,
                        ""SLAStartTime"" TIMESTAMP,
                        ""IsOverdue"" BOOLEAN NOT NULL DEFAULT FALSE,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""WorkflowSelectedEventId"" UUID,
                        ""SLAConfiguredEventId"" UUID,
                        ""TaskAssignedEventId"" UUID,
                        ""TaskOverdueEventId"" UUID,
                        ""TaskStageStartedEventId"" UUID,
                        ""TaskStageCompletedEventId"" UUID,
                        ""TaskStageEscalatedEventId"" UUID,
                        ""TaskStageEscalationTriggeredEventId"" UUID,
                        ""TaskCompletedEventId"" UUID
                    );
                    
                    -- Create indexes
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_Status"" ON ""Tasks"" (""Status"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_WorkflowId"" ON ""Tasks"" (""WorkflowId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_MemberId"" ON ""Tasks"" (""MemberId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_CurrentStageId"" ON ""Tasks"" (""CurrentStageId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_SLADeadline"" ON ""Tasks"" (""SLADeadline"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_StageTimeoutAt"" ON ""Tasks"" (""StageTimeoutAt"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_IsOverdue"" ON ""Tasks"" (""IsOverdue"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_WorkflowSelectedEventId"" ON ""Tasks"" (""WorkflowSelectedEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_SLAConfiguredEventId"" ON ""Tasks"" (""SLAConfiguredEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskAssignedEventId"" ON ""Tasks"" (""TaskAssignedEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskStageStartedEventId"" ON ""Tasks"" (""TaskStageStartedEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskStageCompletedEventId"" ON ""Tasks"" (""TaskStageCompletedEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskStageEscalatedEventId"" ON ""Tasks"" (""TaskStageEscalatedEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskStageEscalationTriggeredEventId"" ON ""Tasks"" (""TaskStageEscalationTriggeredEventId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_TaskCompletedEventId"" ON ""Tasks"" (""TaskCompletedEventId"");
                ";
                
                await createCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Tasks table created successfully using raw SQL.");
                
                // Verify again
                tableExists = Convert.ToInt32(await verifyCommand.ExecuteScalarAsync()) > 0;
                if (!tableExists)
                {
                    throw new InvalidOperationException(
                        "CRITICAL: Failed to create Tasks table. " +
                        "Please check database connection and user permissions.");
                }
                logger.LogInformation("Verified: Tasks table now exists.");
            }
            else
            {
                logger.LogInformation("Verified: Tasks table exists.");
            }
        }
        finally
        {
            if (!wasOpen)
                await connection.CloseAsync();
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "CRITICAL: Error ensuring database is created: {Message}", ex.Message);
        // Re-throw to prevent app from starting with broken database
        throw;
    }
}

app.Run();

