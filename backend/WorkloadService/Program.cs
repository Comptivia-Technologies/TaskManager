using Microsoft.EntityFrameworkCore;
using WorkloadService.Infrastructure.Persistence;
using WorkloadService.Application.Interfaces;
using WorkloadService.Infrastructure.Repositories;
using WorkloadService.Application.Services;
using WorkloadService.Application.EventHandlers;
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

builder.Services.AddDbContext<WorkloadDbContext>(options =>
    options.UseNpgsql(connectionString));

// Event Bus - Register all providers
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

// Repositories
builder.Services.AddScoped<IWorkloadRepository, WorkloadRepository>();

// Services
builder.Services.AddScoped<IWorkloadEvaluationService, WorkloadEvaluationService>();

// Event Handlers
builder.Services.AddScoped<SLAConfiguredEventHandler>();
builder.Services.AddScoped<TaskStatusUpdatedEventHandler>();
builder.Services.AddScoped<TaskStageReassignmentNeededEventHandler>();

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

// Start EventBus consumers
var eventBus = app.Services.GetRequiredService<IEventBus>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

try
{
    logger.LogInformation("Starting SLAConfiguredEvent consumer...");
    eventBus.StartConsuming<SLAConfiguredEvent>(
        EventBusConstants.WorkloadServiceQueue,
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
    logger.LogInformation("Starting TaskStatusUpdatedEvent consumer...");
    eventBus.StartConsuming<TaskStatusUpdatedEvent>(
        EventBusConstants.WorkloadServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStatusUpdatedEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStatusUpdatedEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStatusUpdatedEvent consumer");
}

try
{
    logger.LogInformation("Starting TaskStageReassignmentNeededEvent consumer...");
    eventBus.StartConsuming<TaskStageReassignmentNeededEvent>(
        EventBusConstants.WorkloadServiceQueue,
        async (evt, correlationId) =>
        {
            using var scope = app.Services.CreateScope();
            var handler = scope.ServiceProvider.GetRequiredService<TaskStageReassignmentNeededEventHandler>();
            await handler.HandleAsync(evt, correlationId);
        });
    logger.LogInformation("✓ TaskStageReassignmentNeededEvent consumer started successfully");
}
catch (Exception ex)
{
    logger.LogError(ex, "✗ Failed to start TaskStageReassignmentNeededEvent consumer");
}

// Ensure database and tables are created before starting
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<WorkloadDbContext>();

    try
    {
        logger.LogInformation("Ensuring database and tables are created...");

        // Check if TaskAssignments table exists
        bool taskAssignmentsTableExists = true;
        try
        {
            dbContext.Database.ExecuteSqlRawAsync("SELECT 1 FROM \"TaskAssignments\" LIMIT 1").GetAwaiter().GetResult();
            logger.LogInformation("TaskAssignments table exists.");
        }
        catch
        {
            taskAssignmentsTableExists = false;
            logger.LogInformation("TaskAssignments table does not exist. Creating...");
        }

        if (!taskAssignmentsTableExists)
        {
            var createTableSql = @"
                CREATE TABLE IF NOT EXISTS ""TaskAssignments"" (
                    ""AssignmentId"" UUID PRIMARY KEY,
                    ""TaskId"" UUID NOT NULL,
                    ""MemberId"" UUID NOT NULL,
                    ""WorkloadScore"" DOUBLE PRECISION NOT NULL,
                    ""AssignmentReason"" VARCHAR(500),
                    ""AssignedAt"" TIMESTAMP NOT NULL,
                    ""SLAConfiguredEventId"" UUID
                )";
            dbContext.Database.ExecuteSqlRawAsync(createTableSql).GetAwaiter().GetResult();
            dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TaskAssignments_TaskId"" ON ""TaskAssignments"" (""TaskId"")").GetAwaiter().GetResult();
            dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_TaskAssignments_MemberId"" ON ""TaskAssignments"" (""MemberId"")").GetAwaiter().GetResult();
            logger.LogInformation("TaskAssignments table created manually.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error ensuring WorkloadService database tables are created: {Message}", ex.Message);
    }
}

app.Run();

