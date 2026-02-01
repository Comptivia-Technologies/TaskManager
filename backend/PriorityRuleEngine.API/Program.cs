using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Npgsql;
using PriorityRuleEngine.API.Data;
using PriorityRuleEngine.API.Repositories;
using PriorityRuleEngine.API.Services;
using PriorityRuleEngine.API.EventHandlers;
using Shared.Messaging;
using Shared.Contracts.Constants;
using Shared.Contracts.EventContracts;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=PriorityRuleEngine;Username=postgres;Password=postgres";

builder.Services.AddDbContext<PriorityRuleDbContext>(options =>
    options.UseNpgsql(connectionString));

// RabbitMQ
builder.Services.Configure<RabbitMQOptions>(builder.Configuration.GetSection("RabbitMQ"));
builder.Services.AddSingleton<IRabbitMQPublisher, RabbitMQPublisher>();
builder.Services.AddSingleton<IRabbitMQConsumer, RabbitMQConsumer>();

// Repositories
builder.Services.AddScoped<IPriorityRuleRepository, PriorityRuleRepository>();

// Services
builder.Services.AddScoped<IRuleEvaluator, RuleEvaluator>();
builder.Services.AddScoped<IPriorityRuleService, PriorityRuleService>();

// Event Handlers
builder.Services.AddScoped<WorkflowSelectedEventHandler>();

// CORS
var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins(allowedOrigin)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowReactApp");
app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

// Start RabbitMQ consumer
var consumer = app.Services.GetRequiredService<IRabbitMQConsumer>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

try
{
    logger.LogInformation("Starting WorkflowSelectedEvent consumer for priority assignment...");
    consumer.StartConsuming<WorkflowSelectedEvent>(
        RabbitMQConstants.WorkflowExchange,
        RabbitMQConstants.WorkflowSelectedPriorityQueue,
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

// Ensure database and tables are created
using (var scope = app.Services.CreateScope())
{
    var scopeLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
    
    try
    {
        scopeLogger.LogInformation("Ensuring database and tables are created...");
        
        // First, ensure the database exists
        var dbConnectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=PriorityRuleEngine;Username=postgres;Password=sree";
        
        // Extract database name from connection string
        var dbName = "PriorityRuleEngine";
        var postgresConnectionString = dbConnectionString.Replace($"Database={dbName}", "Database=postgres");
        
        // Connect to postgres database to create the target database if needed
        using (var tempConnection = new NpgsqlConnection(postgresConnectionString))
        {
            await tempConnection.OpenAsync();
            
            // Check if database exists
            using var checkDbCommand = tempConnection.CreateCommand();
            checkDbCommand.CommandText = $@"
                SELECT 1 FROM pg_database WHERE datname = '{dbName}'
            ";
            var dbExists = await checkDbCommand.ExecuteScalarAsync() != null;
            
            if (!dbExists)
            {
                scopeLogger.LogInformation($"Database '{dbName}' does not exist. Creating...");
                using var createDbCommand = tempConnection.CreateCommand();
                createDbCommand.CommandText = $@"
                    CREATE DATABASE ""{dbName}""
                ";
                await createDbCommand.ExecuteNonQueryAsync();
                scopeLogger.LogInformation($"Database '{dbName}' created successfully.");
            }
            else
            {
                scopeLogger.LogInformation($"Database '{dbName}' already exists.");
            }
        }
        
        // Now connect to the target database and create the table
        var dbContext = scope.ServiceProvider.GetRequiredService<PriorityRuleDbContext>();
        
        // Check if PriorityRules table exists
        bool tableExists = true;
        try
        {
            await dbContext.Database.ExecuteSqlRawAsync("SELECT 1 FROM \"PriorityRules\" LIMIT 1");
            scopeLogger.LogInformation("PriorityRules table exists.");
        }
        catch
        {
            tableExists = false;
            scopeLogger.LogInformation("PriorityRules table does not exist. Creating...");
        }
        
        if (!tableExists)
        {
            // Create table manually using raw SQL
            var createTableSql = @"
                CREATE TABLE IF NOT EXISTS ""PriorityRules"" (
                    ""RuleId"" SERIAL PRIMARY KEY,
                    ""RuleName"" VARCHAR(200) NOT NULL,
                    ""Priority"" VARCHAR(50) NOT NULL,
                    ""Salience"" INTEGER NOT NULL DEFAULT 0,
                    ""IsActive"" BOOLEAN NOT NULL DEFAULT true,
                    ""ConditionsJson"" TEXT NOT NULL,
                    ""MaxWorkloadScore"" INTEGER,
                    ""TeamName"" VARCHAR(200),
                    ""WorkflowId"" INTEGER,
                    ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )";
            
            await dbContext.Database.ExecuteSqlRawAsync(createTableSql);
            
            // Create indexes
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_PriorityRules_IsActive_Salience"" 
                ON ""PriorityRules"" (""IsActive"", ""Salience"" DESC)");
            
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_PriorityRules_WorkflowId_IsActive"" 
                ON ""PriorityRules"" (""WorkflowId"", ""IsActive"")");
            
            scopeLogger.LogInformation("PriorityRules table created successfully.");
        }
        else
        {
            // Table exists - check if WorkflowId column exists and add it if missing
            try
            {
                // Check if column exists using information_schema
                using var connection = dbContext.Database.GetDbConnection();
                await connection.OpenAsync();
                using var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT COUNT(*) 
                    FROM information_schema.columns 
                    WHERE table_name = 'PriorityRules' AND column_name = 'WorkflowId'";
                var columnExists = Convert.ToInt32(await command.ExecuteScalarAsync()) > 0;
                
                if (!columnExists)
                {
                    scopeLogger.LogInformation("WorkflowId column does not exist. Adding...");
                    await dbContext.Database.ExecuteSqlRawAsync(@"
                        ALTER TABLE ""PriorityRules"" 
                        ADD COLUMN ""WorkflowId"" INTEGER");
                    
                    // Create index for WorkflowId
                    await dbContext.Database.ExecuteSqlRawAsync(@"
                        CREATE INDEX IF NOT EXISTS ""IX_PriorityRules_WorkflowId_IsActive"" 
                        ON ""PriorityRules"" (""WorkflowId"", ""IsActive"")");
                    
                    scopeLogger.LogInformation("WorkflowId column added successfully.");
                }
                else
                {
                    scopeLogger.LogInformation("WorkflowId column already exists.");
                }
            }
            catch (Exception ex)
            {
                scopeLogger.LogWarning(ex, "Could not verify/add WorkflowId column. It may already exist or there was an error.");
            }
        }
    }
    catch (Exception ex)
    {
        scopeLogger.LogError(ex, "Error creating database: {Message}", ex.Message);
        // Don't throw - let the service start and handle errors gracefully
    }
}

app.Run();

