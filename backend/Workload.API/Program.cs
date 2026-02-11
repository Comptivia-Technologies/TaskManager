using Microsoft.EntityFrameworkCore;
using Workload.API.Data;
using Workload.API.Middleware;
using Workload.API.Repositories;
using Workload.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container for Workload.API API
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

builder.Services.AddDbContext<WorkloadDbContext>(options =>
    options.UseNpgsql(connectionString));

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Repositories
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<IWorkloadRepository, WorkloadRepository>();

// Services
builder.Services.AddScoped<IWorkloadService, WorkloadService>();

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
    var dbContext = scope.ServiceProvider.GetRequiredService<WorkloadDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        // Check if Workloads table exists using a query
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
                AND table_name = 'Workloads'
            ";
            var result = await command.ExecuteScalarAsync();
            var tableExists = Convert.ToInt32(result) > 0;

            if (!tableExists)
            {
                // Create the Workloads table
                using var createCommand = connection.CreateCommand();
                createCommand.CommandText = @"
                    CREATE TABLE ""Workloads"" (
                        ""WorkloadId"" SERIAL PRIMARY KEY,
                        ""MemberId"" INTEGER NOT NULL,
                        ""WorkloadScore"" DOUBLE PRECISION NOT NULL,
                        ""WorkloadStatus"" VARCHAR(50) NOT NULL,
                        ""Efficiency"" DOUBLE PRECISION NOT NULL,
                        ""SkillLevel"" INTEGER NOT NULL,
                        ""TaskCompletionRate"" DOUBLE PRECISION NOT NULL,
                        ""ActiveTaskCount"" INTEGER NOT NULL,
                        ""PendingTaskCount"" INTEGER NOT NULL,
                        ""IsAvailable"" BOOLEAN NOT NULL,
                        ""CalculatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL,
                        ""CreatedAt"" TIMESTAMP WITH TIME ZONE NOT NULL
                    );
                    
                    CREATE INDEX ""IX_Workloads_MemberId"" 
                    ON ""Workloads"" (""MemberId"");
                    
                    CREATE INDEX ""IX_Workloads_CalculatedAt"" 
                    ON ""Workloads"" (""CalculatedAt"");
                ";
                await createCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Workloads table created successfully.");
            }
            else
            {
                logger.LogInformation("Workloads table already exists.");
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

