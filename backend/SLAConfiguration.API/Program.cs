using Microsoft.EntityFrameworkCore;
using System.Data.Common;
using SLAConfiguration.API.Data;
using SLAConfiguration.API.Middleware;
using SLAConfiguration.API.Repositories;
using SLAConfiguration.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString))
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
    var dbPort = Environment.GetEnvironmentVariable("DB_PORT") ?? "5432";
    var dbName = Environment.GetEnvironmentVariable("DB_NAME") ?? "WorkflowManagement";
    var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD")
        ?? throw new InvalidOperationException("DB_PASSWORD environment variable is required");
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword}";
}

builder.Services.AddDbContext<SLAConfigurationDbContext>(options =>
    options.UseNpgsql(connectionString));

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Repositories
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ISLARepository, SLARepository>();

// Services
builder.Services.AddScoped<ISLAService, SLAService>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CORS must be before UseHttpsRedirection
app.UseCors("AllowReactApp");

app.UseHttpsRedirection();

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseAuthorization();

app.MapControllers();

// Ensure database and tables are created
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SLAConfigurationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        // Check if SLAConfigurations table exists using a query
        var connection = dbContext.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen)
            await connection.OpenAsync();
        
        try
        {
            using var command = connection.CreateCommand();
            command.CommandText = @"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'SLAConfigurations'
            ";
            var result = await command.ExecuteScalarAsync();
            var tableExists = Convert.ToInt32(result) > 0;

            if (!tableExists)
            {
                // Create the SLAConfigurations table
                using var createCommand = connection.CreateCommand();
                createCommand.CommandText = @"
                    CREATE TABLE ""SLAConfigurations"" (
                        ""SLAConfigurationId"" SERIAL PRIMARY KEY,
                        ""WorkflowId"" INTEGER NOT NULL,
                        ""PriorityLevelsJson"" JSONB NOT NULL DEFAULT '{}',
                        ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL,
                        ""UpdatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL,
                        CONSTRAINT ""UQ_SLAConfigurations_WorkflowId"" UNIQUE (""WorkflowId"")
                    );
                    
                    CREATE INDEX ""IX_SLAConfigurations_WorkflowId"" 
                    ON ""SLAConfigurations"" (""WorkflowId"");
                ";
                await createCommand.ExecuteNonQueryAsync();
                logger.LogInformation("SLAConfigurations table created successfully.");
            }
            else
            {
                logger.LogInformation("SLAConfigurations table already exists.");
                
                // Check if columns need to be updated to timestamp with time zone
                using var checkCommand = connection.CreateCommand();
                checkCommand.CommandText = @"
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'SLAConfigurations' 
                    AND column_name = 'CreatedAt'
                ";
                var columnType = await checkCommand.ExecuteScalarAsync() as string;
                
                if (columnType == "timestamp without time zone")
                {
                    // Alter columns to use timestamp with time zone
                    using var alterCommand = connection.CreateCommand();
                    alterCommand.CommandText = @"
                        ALTER TABLE ""SLAConfigurations"" 
                        ALTER COLUMN ""CreatedAt"" TYPE TIMESTAMP WITH TIME ZONE,
                        ALTER COLUMN ""UpdatedAt"" TYPE TIMESTAMP WITH TIME ZONE;
                    ";
                    await alterCommand.ExecuteNonQueryAsync();
                    logger.LogInformation("Updated SLAConfigurations table columns to use timestamp with time zone.");
                }
            }
        }
        finally
        {
            if (!wasOpen)
                await connection.CloseAsync();
        }

        // Ensure database schema is up to date
        dbContext.Database.EnsureCreated();
        logger.LogInformation("Database ensured/created successfully.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error ensuring database is created. You may need to run migration scripts manually.");
    }
}

app.Run();

