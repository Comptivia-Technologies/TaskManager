using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WorkflowService.Infrastructure.Persistence;
using WorkflowService.Application.Interfaces;
using WorkflowService.Infrastructure.Repositories;
using WorkflowService.Application.Services;
using WorkflowService.Application.EventHandlers;
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

builder.Services.AddDbContext<WorkflowDbContext>(options =>
    options.UseNpgsql(connectionString));

// RabbitMQ
builder.Services.Configure<RabbitMQOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.AddSingleton<IRabbitMQPublisher, RabbitMQPublisher>();
builder.Services.AddSingleton<IRabbitMQConsumer, RabbitMQConsumer>();

// Repositories
builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>();

// Services
builder.Services.AddScoped<IWorkflowSelectionService, WorkflowSelectionService>();

// Event Handlers
builder.Services.AddScoped<TaskCreatedEventHandler>();

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
    logger.LogInformation("Starting TaskCreatedEvent consumer...");
    consumer.StartConsuming<TaskCreatedEvent>(
        RabbitMQConstants.TaskExchange,
        RabbitMQConstants.TaskCreatedWorkflowQueue, // Use separate queue for WorkflowService
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

// Ensure database and tables are created
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<WorkflowDbContext>();
    
    try
    {
        logger.LogInformation("Ensuring database and tables are created...");
        
        // Check if WorkflowSelections table exists
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
            // Create table manually using raw SQL
            var createTableSql = @"
                CREATE TABLE IF NOT EXISTS ""WorkflowSelections"" (
                    ""SelectionId"" UUID PRIMARY KEY,
                    ""TaskId"" UUID NOT NULL,
                    ""WorkflowId"" INTEGER NOT NULL,
                    ""WorkflowName"" VARCHAR(200) NOT NULL,
                    ""SelectionReason"" VARCHAR(500),
                    ""SelectedAt"" TIMESTAMP NOT NULL,
                    ""TaskCreatedEventId"" UUID
                )";
            
            await dbContext.Database.ExecuteSqlRawAsync(createTableSql);
            
            // Create indexes
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_WorkflowSelections_TaskId"" ON ""WorkflowSelections"" (""TaskId"")");
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_WorkflowSelections_WorkflowId"" ON ""WorkflowSelections"" (""WorkflowId"")");
            
            logger.LogInformation("WorkflowSelections table created successfully.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error creating database: {Message}", ex.Message);
        // Don't throw - let the service start and handle errors gracefully
    }
}

app.Run();

