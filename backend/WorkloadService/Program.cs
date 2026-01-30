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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=postgres";

builder.Services.AddDbContext<WorkloadDbContext>(options =>
    options.UseNpgsql(connectionString));

// RabbitMQ
builder.Services.Configure<RabbitMQOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.AddSingleton<IRabbitMQPublisher, RabbitMQPublisher>();
builder.Services.AddSingleton<IRabbitMQConsumer, RabbitMQConsumer>();

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

// Start RabbitMQ consumer
var consumer = app.Services.GetRequiredService<IRabbitMQConsumer>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

try
{
    logger.LogInformation("Starting SLAConfiguredEvent consumer...");
    consumer.StartConsuming<SLAConfiguredEvent>(
        RabbitMQConstants.SLAExchange,
        RabbitMQConstants.SLAConfiguredWorkloadQueue, // Use separate queue for WorkloadService
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
    logger.LogInformation("Starting TaskStatusUpdatedEvent consumer...");
    consumer.StartConsuming<TaskStatusUpdatedEvent>(
        RabbitMQConstants.TaskExchange,
        RabbitMQConstants.TaskStatusUpdatedQueue,
        RabbitMQConstants.TaskStatusUpdated,
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
    consumer.StartConsuming<TaskStageReassignmentNeededEvent>(
        RabbitMQConstants.WorkloadExchange,
        RabbitMQConstants.TaskStageReassignmentNeededQueue,
        RabbitMQConstants.TaskStageReassignmentNeeded,
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
                    ""MemberId"" INTEGER NOT NULL,
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

