using Microsoft.EntityFrameworkCore;
using System.Linq;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Middleware;
using WorkflowManagement.API.Repositories;
using WorkflowManagement.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Repositories
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITeamRepository, TeamRepository>();
builder.Services.AddScoped<IMemberRepository, MemberRepository>();
builder.Services.AddScoped<IWorkflowRepository, WorkflowRepository>();
builder.Services.AddScoped<IStageRepository, StageRepository>();
builder.Services.AddScoped<ITaskRepository, TaskRepository>();

// Services
builder.Services.AddScoped<ITeamService, TeamService>();
builder.Services.AddScoped<IMemberService, MemberService>();
builder.Services.AddScoped<IWorkflowService, WorkflowService>();
builder.Services.AddScoped<IStageService, StageService>();
builder.Services.AddScoped<ITaskService, TaskService>();

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

// Ensure database is created and migrations are applied
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        // Try EnsureCreated first
        var created = dbContext.Database.EnsureCreated();
        logger.LogInformation(created ? "Database and tables created successfully." : "Database already exists.");
        
        // CRITICAL: Verify tables actually exist
        var connection = dbContext.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen)
            await connection.OpenAsync();
        
        try
        {
            // Check if all required tables exist
            using var verifyCommand = connection.CreateCommand();
            verifyCommand.CommandText = @"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('Members', 'Teams', 'Workflows', 'Stages', 'Tasks')
            ";
            var tableCount = Convert.ToInt32(await verifyCommand.ExecuteScalarAsync());
            
            if (tableCount < 5)
            {
                logger.LogWarning($"Only {tableCount} out of 5 required tables exist. EnsureCreated() may have failed. Creating tables manually...");
                
                // Create tables using raw SQL (more reliable than EnsureCreated)
                using var createCommand = connection.CreateCommand();
                createCommand.CommandText = @"
                    -- Create Teams table
                    CREATE TABLE IF NOT EXISTS ""Teams"" (
                        ""TeamId"" SERIAL PRIMARY KEY,
                        ""TeamName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    -- Create Members table
                    CREATE TABLE IF NOT EXISTS ""Members"" (
                        ""MemberId"" SERIAL PRIMARY KEY,
                        ""FirstName"" VARCHAR(100) NOT NULL,
                        ""LastName"" VARCHAR(100) NOT NULL,
                        ""Email"" VARCHAR(200) NOT NULL,
                        ""Role"" VARCHAR(100) NOT NULL,
                        ""SkillLevel"" INTEGER NOT NULL DEFAULT 3,
                        ""TeamId"" INTEGER,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Members_Teams_TeamId"" FOREIGN KEY (""TeamId"") 
                            REFERENCES ""Teams""(""TeamId"") ON DELETE RESTRICT,
                        CONSTRAINT ""CK_Members_SkillLevel_Range"" 
                            CHECK (""SkillLevel"" >= 1 AND ""SkillLevel"" <= 5)
                    );
                    
                    -- Create Workflows table
                    CREATE TABLE IF NOT EXISTS ""Workflows"" (
                        ""WorkflowId"" SERIAL PRIMARY KEY,
                        ""WorkflowName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""TeamId"" INTEGER,
                        ""WorkflowJson"" JSONB,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Workflows_Teams_TeamId"" FOREIGN KEY (""TeamId"") 
                            REFERENCES ""Teams""(""TeamId"") ON DELETE RESTRICT
                    );
                    
                    -- Create Stages table
                    CREATE TABLE IF NOT EXISTS ""Stages"" (
                        ""StageId"" SERIAL PRIMARY KEY,
                        ""StageName"" VARCHAR(200) NOT NULL,
                        ""StageOrder"" INTEGER NOT NULL,
                        ""WorkflowId"" INTEGER NOT NULL,
                        ""TeamId"" INTEGER NOT NULL,
                        ""StageType"" INTEGER NOT NULL DEFAULT 0,
                        ""TransitionPolicy"" INTEGER NOT NULL DEFAULT 0,
                        ""TimeoutMinutes"" INTEGER,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Stages_Workflows_WorkflowId"" FOREIGN KEY (""WorkflowId"") 
                            REFERENCES ""Workflows""(""WorkflowId"") ON DELETE CASCADE,
                        CONSTRAINT ""FK_Stages_Teams_TeamId"" FOREIGN KEY (""TeamId"") 
                            REFERENCES ""Teams""(""TeamId"") ON DELETE RESTRICT
                    );
                    
                    -- Create Tasks table
                    CREATE TABLE IF NOT EXISTS ""Tasks"" (
                        ""TaskId"" SERIAL PRIMARY KEY,
                        ""TaskName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""Status"" VARCHAR(50) NOT NULL,
                        ""Priority"" VARCHAR(50) NOT NULL,
                        ""DueDate"" TIMESTAMP,
                        ""WorkflowId"" INTEGER NOT NULL,
                        ""StageId"" INTEGER,
                        ""AssignedToMemberId"" INTEGER,
                        ""CompletedByMemberIds"" TEXT,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Tasks_Workflows_WorkflowId"" FOREIGN KEY (""WorkflowId"") 
                            REFERENCES ""Workflows""(""WorkflowId"") ON DELETE CASCADE,
                        CONSTRAINT ""FK_Tasks_Stages_StageId"" FOREIGN KEY (""StageId"") 
                            REFERENCES ""Stages""(""StageId"") ON DELETE SET NULL,
                        CONSTRAINT ""FK_Tasks_Members_AssignedToMemberId"" FOREIGN KEY (""AssignedToMemberId"") 
                            REFERENCES ""Members""(""MemberId"") ON DELETE SET NULL
                    );
                    
                    -- Create indexes
                    CREATE INDEX IF NOT EXISTS ""IX_Members_SkillLevel"" ON ""Members"" (""SkillLevel"");
                    CREATE INDEX IF NOT EXISTS ""IX_Members_TeamId"" ON ""Members"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Workflows_TeamId"" ON ""Workflows"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Stages_WorkflowId"" ON ""Stages"" (""WorkflowId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Stages_TeamId"" ON ""Stages"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_WorkflowId"" ON ""Tasks"" (""WorkflowId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_StageId"" ON ""Tasks"" (""StageId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_AssignedToMemberId"" ON ""Tasks"" (""AssignedToMemberId"");
                ";
                
                await createCommand.ExecuteNonQueryAsync();
                logger.LogInformation("Tables created successfully using raw SQL.");
                
                // Verify again
                tableCount = Convert.ToInt32(await verifyCommand.ExecuteScalarAsync());
                if (tableCount < 5)
                {
                    throw new InvalidOperationException(
                        $"CRITICAL: Failed to create all tables. Only {tableCount} tables exist. " +
                        "Please check database connection and user permissions.");
                }
                logger.LogInformation($"Verified: All {tableCount} required tables now exist.");
            }
            else
            {
                logger.LogInformation($"Verified: All {tableCount} required tables exist.");
            }
            
            // Check and add SkillLevel column if it doesn't exist (only if Members table exists)
            using var checkCommand = connection.CreateCommand();
            checkCommand.CommandText = @"
                SELECT COUNT(*) 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'Members' 
                AND column_name = 'SkillLevel'
            ";
            var result = await checkCommand.ExecuteScalarAsync();
            var columnExists = Convert.ToInt32(result) > 0;

            if (!columnExists)
            {
                logger.LogInformation("SkillLevel column not found. Adding it to Members table...");
                
                using var addColumnCommand = connection.CreateCommand();
                addColumnCommand.CommandText = @"
                    ALTER TABLE ""Members"" ADD COLUMN IF NOT EXISTS ""SkillLevel"" INTEGER DEFAULT 3;
                    UPDATE ""Members"" SET ""SkillLevel"" = 3 WHERE ""SkillLevel"" IS NULL;
                    ALTER TABLE ""Members"" ALTER COLUMN ""SkillLevel"" SET NOT NULL;
                    ALTER TABLE ""Members""
                    ADD CONSTRAINT ""CK_Members_SkillLevel_Range"" 
                    CHECK (""SkillLevel"" >= 1 AND ""SkillLevel"" <= 5);
                    CREATE INDEX IF NOT EXISTS ""IX_Members_SkillLevel"" 
                    ON ""Members"" (""SkillLevel"");
                ";
                await addColumnCommand.ExecuteNonQueryAsync();
                
                logger.LogInformation("SkillLevel column added successfully to Members table.");
            }
            else
            {
                logger.LogInformation("SkillLevel column already exists in Members table.");
            }
            
            // Check and add missing columns to Tasks table if they don't exist
            using var checkTasksCommand = connection.CreateCommand();
            checkTasksCommand.CommandText = @"
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'Tasks' 
                AND column_name IN ('DueDate', 'CompletedByMemberIds')
            ";
            var existingColumns = new List<string>();
            using (var reader = await checkTasksCommand.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    existingColumns.Add(reader.GetString(0));
                }
            }
            
            var columnsToAdd = new List<string>();
            if (!existingColumns.Contains("DueDate"))
            {
                columnsToAdd.Add(@"""DueDate"" TIMESTAMP");
            }
            if (!existingColumns.Contains("CompletedByMemberIds"))
            {
                columnsToAdd.Add(@"""CompletedByMemberIds"" TEXT");
            }
            
            if (columnsToAdd.Count > 0)
            {
                logger.LogInformation($"Adding missing columns to Tasks table: {string.Join(", ", columnsToAdd)}");
                // Add each column separately (PostgreSQL doesn't support IF NOT EXISTS with multiple columns in one statement)
                foreach (var column in columnsToAdd)
                {
                    using var addColumnCommand = connection.CreateCommand();
                    addColumnCommand.CommandText = $@"ALTER TABLE ""Tasks"" ADD COLUMN IF NOT EXISTS {column}";
                    await addColumnCommand.ExecuteNonQueryAsync();
                }
                logger.LogInformation("Missing columns added successfully to Tasks table.");
            }
            else
            {
                logger.LogInformation("All required columns exist in Tasks table.");
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

