using Microsoft.EntityFrameworkCore;
using SLAManagerService.Infrastructure.Persistence;
using SLAManagerService.Application.Interfaces;
using SLAManagerService.Infrastructure.Repositories;
using SLAManagerService.Application.Services;
using SLAManagerService.Application.EventHandlers;
using SLAManagerService.Infrastructure.BackgroundJobs;
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

builder.Services.AddDbContext<SLADbContext>(options =>
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

// Repositories
builder.Services.AddScoped<ISLARepository, SLARepository>();

// Services
builder.Services.AddScoped<ISLAService, SLAService>();

// Event Handlers
builder.Services.AddScoped<PriorityAssignedEventHandler>();

// Background Services
builder.Services.AddHostedService<SLAMonitorService>();

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

// Start EventBus consumer
var eventBus = app.Services.GetRequiredService<IEventBus>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

try
{
    logger.LogInformation("Starting PriorityAssignedEvent consumer...");
    eventBus.StartConsuming<PriorityAssignedEvent>(
        EventBusConstants.SLAServiceQueue,
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

// Ensure database is created before starting
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SLADbContext>();
    
    try
    {
        logger.LogInformation("Ensuring database and tables are created...");
        
        // Check if table exists by trying to query it
        bool tableExists = true;
        try
        {
            await dbContext.Database.ExecuteSqlRawAsync("SELECT 1 FROM \"SLAAssignments\" LIMIT 1");
            logger.LogInformation("SLAAssignments table exists.");
        }
        catch
        {
            tableExists = false;
            logger.LogInformation("SLAAssignments table does not exist. Creating...");
        }
        
        if (!tableExists)
        {
            
            // Create table manually using raw SQL
            var createTableSql = @"
                CREATE TABLE IF NOT EXISTS ""SLAAssignments"" (
                    ""SLAAssignmentId"" UUID PRIMARY KEY,
                    ""TaskId"" UUID NOT NULL,
                    ""WorkflowId"" UUID NOT NULL,
                    ""Priority"" VARCHAR(50) NOT NULL,
                    ""ResponseTimeMinutes"" INTEGER NOT NULL,
                    ""SLAStartTime"" TIMESTAMP WITH TIME ZONE NOT NULL,
                    ""SLADeadline"" TIMESTAMP WITH TIME ZONE NOT NULL,
                    ""IsOverdue"" BOOLEAN NOT NULL DEFAULT FALSE,
                    ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL,
                    ""WorkflowSelectedEventId"" UUID
                )";
            
            await dbContext.Database.ExecuteSqlRawAsync(createTableSql);
            
            // Create indexes
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_SLAAssignments_TaskId"" ON ""SLAAssignments"" (""TaskId"")");
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_SLAAssignments_WorkflowId"" ON ""SLAAssignments"" (""WorkflowId"")");
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_SLAAssignments_SLADeadline"" ON ""SLAAssignments"" (""SLADeadline"")");
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_SLAAssignments_IsOverdue"" ON ""SLAAssignments"" (""IsOverdue"")");
            
            logger.LogInformation("SLAAssignments table created manually.");
        }
        else
        {
            logger.LogInformation("SLAAssignments table exists.");
        }
        
        // Migrate existing TIMESTAMP columns to TIMESTAMP WITH TIME ZONE if needed
        // This runs regardless of whether table was just created or already existed
        // Uses PostgreSQL's DO block to check and migrate only if needed
        try
        {
            logger.LogInformation("Checking and migrating timezone columns if needed...");
            var migrationSql = @"
                DO $$
                BEGIN
                    -- Check if SLADeadline is timestamp without time zone and migrate
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'SLAAssignments' 
                        AND column_name = 'SLADeadline'
                        AND data_type = 'timestamp without time zone'
                    ) THEN
                        ALTER TABLE ""SLAAssignments"" 
                            ALTER COLUMN ""SLAStartTime"" TYPE TIMESTAMP WITH TIME ZONE 
                            USING ""SLAStartTime"" AT TIME ZONE 'UTC';
                        
                        ALTER TABLE ""SLAAssignments"" 
                            ALTER COLUMN ""SLADeadline"" TYPE TIMESTAMP WITH TIME ZONE 
                            USING ""SLADeadline"" AT TIME ZONE 'UTC';
                        
                        ALTER TABLE ""SLAAssignments"" 
                            ALTER COLUMN ""CreatedAt"" TYPE TIMESTAMP WITH TIME ZONE 
                            USING ""CreatedAt"" AT TIME ZONE 'UTC';
                    END IF;
                END $$";
            
            await dbContext.Database.ExecuteSqlRawAsync(migrationSql);
            logger.LogInformation("✓ Timezone columns verified/migrated successfully");
        }
        catch (Exception migrationEx)
        {
            logger.LogWarning(migrationEx, "Could not migrate timezone columns. This is OK if columns are already correct.");
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error creating database: {Message}", ex.Message);
        // Don't throw - let the service start and handle errors gracefully
    }
}

app.Run();

