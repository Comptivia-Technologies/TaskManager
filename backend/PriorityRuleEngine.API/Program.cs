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

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString))
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
    var dbPort = Environment.GetEnvironmentVariable("DB_PORT") ?? "5432";
    var dbName = Environment.GetEnvironmentVariable("DB_NAME") ?? "PriorityRuleEngine";
    var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD")
        ?? throw new InvalidOperationException("DB_PASSWORD environment variable is required");
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword};SSL Mode=Require;Channel Binding=require";
}

builder.Services.AddDbContext<PriorityRuleDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<PriorityRuleEngine.API.Services.ICurrentOrganizationAccessor, PriorityRuleEngine.API.Services.CurrentOrganizationAccessor>();

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
builder.Services.AddScoped<IPriorityRuleRepository, PriorityRuleRepository>();

// Services
builder.Services.AddScoped<IRuleEvaluator, RuleEvaluator>();
builder.Services.AddScoped<IPriorityRuleService, PriorityRuleService>();

// Event Handlers
builder.Services.AddScoped<WorkflowSelectedEventHandler>();

// CORS
var allowedOrigin = builder.Configuration["Cors:AllowedOrigin"] 
    ?? throw new InvalidOperationException("Cors:AllowedOrigin configuration is required");
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

// Start EventBus consumer
var eventBus = app.Services.GetRequiredService<IEventBus>();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

try
{
    logger.LogInformation("Starting WorkflowSelectedEvent consumer for priority assignment...");
    eventBus.StartConsuming<WorkflowSelectedEvent>(
        EventBusConstants.PriorityServiceQueue,
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
        var dbConnectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrEmpty(dbConnectionString))
        {
            var dbHost2 = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
            var dbPort2 = Environment.GetEnvironmentVariable("DB_PORT") ?? "5432";
            var dbName2 = Environment.GetEnvironmentVariable("DB_NAME") ?? "PriorityRuleEngine";
            var dbUser2 = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
            var dbPassword2 = Environment.GetEnvironmentVariable("DB_PASSWORD")
                ?? throw new InvalidOperationException("DB_PASSWORD environment variable is required");
            
            dbConnectionString = $"Host={dbHost2};Port={dbPort2};Database={dbName2};Username={dbUser2};Password={dbPassword2};SSL Mode=Require;Channel Binding=require";
        }
        
        // Extract database name from connection string
        var targetDbName = "PriorityRuleEngine";
        var dbNameMatch = System.Text.RegularExpressions.Regex.Match(dbConnectionString, @"Database=([^;]+)");
        if (dbNameMatch.Success)
        {
            targetDbName = dbNameMatch.Groups[1].Value;
        }
        var postgresConnectionString = dbConnectionString.Replace($"Database={targetDbName}", "Database=postgres");
        
        // Connect to postgres database to create the target database if needed
        using (var tempConnection = new NpgsqlConnection(postgresConnectionString))
        {
            await tempConnection.OpenAsync();
            
            // Check if database exists
            using var checkDbCommand = tempConnection.CreateCommand();
            checkDbCommand.CommandText = $@"
                SELECT 1 FROM pg_database WHERE datname = '{targetDbName}'
            ";
            var dbExists = await checkDbCommand.ExecuteScalarAsync() != null;
            
            if (!dbExists)
            {
                scopeLogger.LogInformation($"Database '{targetDbName}' does not exist. Creating...");
                using var createDbCommand = tempConnection.CreateCommand();
                createDbCommand.CommandText = $@"
                    CREATE DATABASE ""{targetDbName}""
                ";
                await createDbCommand.ExecuteNonQueryAsync();
                scopeLogger.LogInformation($"Database '{targetDbName}' created successfully.");
            }
            else
            {
                scopeLogger.LogInformation($"Database '{targetDbName}' already exists.");
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
                    ""RuleId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ""OrganizationId"" UUID NOT NULL,
                    ""RuleName"" VARCHAR(200) NOT NULL,
                    ""Priority"" VARCHAR(50) NOT NULL,
                    ""Salience"" INTEGER NOT NULL DEFAULT 0,
                    ""IsActive"" BOOLEAN NOT NULL DEFAULT true,
                    ""ConditionsJson"" TEXT NOT NULL,
                    ""MaxWorkloadScore"" INTEGER,
                    ""TeamName"" VARCHAR(200),
                    ""WorkflowId"" UUID,
                    ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                )";
            
            await dbContext.Database.ExecuteSqlRawAsync(createTableSql);
            
            // Create indexes
            await dbContext.Database.ExecuteSqlRawAsync(@"
                CREATE INDEX IF NOT EXISTS ""IX_PriorityRules_OrganizationId"" 
                ON ""PriorityRules"" (""OrganizationId"")");
            
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
            // Table exists - use single connection for both column checks to avoid ObjectDisposedException
            try
            {
                var connection = dbContext.Database.GetDbConnection();
                var wasOpen = connection.State == System.Data.ConnectionState.Open;
                if (!wasOpen)
                    await connection.OpenAsync();
                try
                {
                    // Check OrganizationId and add if missing
                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = @"
                            SELECT COUNT(*) FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'PriorityRules' AND column_name = 'OrganizationId'";
                        var orgColumnExists = Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0;
                        if (!orgColumnExists)
                        {
                            scopeLogger.LogInformation("OrganizationId column does not exist. Adding...");
                            await dbContext.Database.ExecuteSqlRawAsync(@"
                                ALTER TABLE ""PriorityRules""
                                ADD COLUMN ""OrganizationId"" UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'");
                            await dbContext.Database.ExecuteSqlRawAsync(@"
                                CREATE INDEX IF NOT EXISTS ""IX_PriorityRules_OrganizationId""
                                ON ""PriorityRules"" (""OrganizationId"")");
                            scopeLogger.LogInformation("OrganizationId column added successfully.");
                        }
                    }

                    // Check WorkflowId and add if missing
                    using (var cmd = connection.CreateCommand())
                    {
                        cmd.CommandText = @"
                            SELECT COUNT(*) FROM information_schema.columns
                            WHERE table_schema = 'public' AND table_name = 'PriorityRules' AND column_name = 'WorkflowId'";
                        var workflowIdExists = Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0;
                        if (!workflowIdExists)
                        {
                            scopeLogger.LogInformation("WorkflowId column does not exist. Adding...");
                            await dbContext.Database.ExecuteSqlRawAsync(@"
                                ALTER TABLE ""PriorityRules"" ADD COLUMN ""WorkflowId"" UUID");
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
                }
                finally
                {
                    if (!wasOpen)
                        await connection.CloseAsync();
                }
            }
            catch (Exception ex)
            {
                scopeLogger.LogWarning(ex, "Could not verify/add PriorityRules columns. They may already exist or there was an error.");
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

