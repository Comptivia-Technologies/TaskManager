using Microsoft.EntityFrameworkCore;
using Npgsql;
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

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentOrganizationAccessor, CurrentOrganizationAccessor>();

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
    
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPassword};SSL Mode=Require";
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
builder.Services.AddScoped<IRoleService, RoleService>();

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
            // Note: PostgreSQL stores quoted identifiers as-is, but information_schema.tables stores them in lowercase
            // So we need to check for lowercase names using LOWER() function
            using var verifyCommand = connection.CreateCommand();
            verifyCommand.CommandText = @"
                SELECT COUNT(*) 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND LOWER(table_name) IN ('members', 'teams', 'workflows', 'stages', 'tasks')
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
                        ""TeamId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""OrganizationId"" UUID NOT NULL,
                        ""TeamName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    
                    -- Create Members table
                    CREATE TABLE IF NOT EXISTS ""Members"" (
                        ""MemberId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""OrganizationId"" UUID NOT NULL,
                        ""UserId"" VARCHAR(128),
                        ""FirstName"" VARCHAR(100) NOT NULL,
                        ""LastName"" VARCHAR(100) NOT NULL,
                        ""Email"" VARCHAR(200) NOT NULL,
                        ""Role"" VARCHAR(100) NOT NULL,
                        ""SkillLevel"" INTEGER NOT NULL DEFAULT 3,
                        ""TeamId"" UUID,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Members_Teams_TeamId"" FOREIGN KEY (""TeamId"") 
                            REFERENCES ""Teams""(""TeamId"") ON DELETE RESTRICT,
                        CONSTRAINT ""CK_Members_SkillLevel_Range"" 
                            CHECK (""SkillLevel"" >= 1 AND ""SkillLevel"" <= 5)
                    );
                    
                    -- Create Workflows table
                    CREATE TABLE IF NOT EXISTS ""Workflows"" (
                        ""WorkflowId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""OrganizationId"" UUID NOT NULL,
                        ""WorkflowName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""TeamId"" UUID,
                        ""WorkflowJson"" JSONB,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""FK_Workflows_Teams_TeamId"" FOREIGN KEY (""TeamId"") 
                            REFERENCES ""Teams""(""TeamId"") ON DELETE RESTRICT
                    );
                    
                    -- Create Stages table
                    CREATE TABLE IF NOT EXISTS ""Stages"" (
                        ""StageId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""OrganizationId"" UUID NOT NULL,
                        ""StageName"" VARCHAR(200) NOT NULL,
                        ""StageOrder"" INTEGER NOT NULL,
                        ""WorkflowId"" UUID NOT NULL,
                        ""TeamId"" UUID NOT NULL,
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
                        ""TaskId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""OrganizationId"" UUID NOT NULL,
                        ""TaskName"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""Status"" VARCHAR(50) NOT NULL,
                        ""Priority"" VARCHAR(50) NOT NULL,
                        ""DueDate"" TIMESTAMP,
                        ""WorkflowId"" UUID NOT NULL,
                        ""StageId"" UUID,
                        ""AssignedToMemberId"" UUID,
                        ""CompletedByMemberIds"" TEXT,
                        ""EscalatedByMemberIds"" TEXT,
                        ""IsOverdue"" BOOLEAN NOT NULL DEFAULT FALSE,
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
                    CREATE INDEX IF NOT EXISTS ""IX_Teams_OrganizationId"" ON ""Teams"" (""OrganizationId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Members_OrganizationId"" ON ""Members"" (""OrganizationId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Members_SkillLevel"" ON ""Members"" (""SkillLevel"");
                    CREATE INDEX IF NOT EXISTS ""IX_Members_TeamId"" ON ""Members"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Workflows_OrganizationId"" ON ""Workflows"" (""OrganizationId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Workflows_TeamId"" ON ""Workflows"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Stages_OrganizationId"" ON ""Stages"" (""OrganizationId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Stages_WorkflowId"" ON ""Stages"" (""WorkflowId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Stages_TeamId"" ON ""Stages"" (""TeamId"");
                    CREATE INDEX IF NOT EXISTS ""IX_Tasks_OrganizationId"" ON ""Tasks"" (""OrganizationId"");
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
                AND LOWER(table_name) = 'members' 
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
                AND LOWER(table_name) = 'tasks' 
                AND column_name IN ('DueDate', 'CompletedByMemberIds', 'IsOverdue')
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
            if (!existingColumns.Contains("IsOverdue"))
            {
                columnsToAdd.Add(@"""IsOverdue"" BOOLEAN NOT NULL DEFAULT FALSE");
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

            // Ensure Permissions table exists and seed default permissions
            using (var permTableCmd = connection.CreateCommand())
            {
                permTableCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""Permissions"" (
                        ""PermissionId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""Code"" VARCHAR(100) NOT NULL,
                        ""Name"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(500),
                        ""Category"" VARCHAR(100),
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT ""UQ_Permissions_Code"" UNIQUE (""Code"")
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_Permissions_Code"" ON ""Permissions"" (""Code"");
                    CREATE INDEX IF NOT EXISTS ""IX_Permissions_Category"" ON ""Permissions"" (""Category"");
                ";
                await permTableCmd.ExecuteNonQueryAsync();
                logger.LogInformation("Permissions table ensured.");
            }

            // Ensure Roles table exists
            using (var rolesTableCmd = connection.CreateCommand())
            {
                rolesTableCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""Roles"" (
                        ""RoleId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ""Name"" VARCHAR(200) NOT NULL,
                        ""Description"" VARCHAR(1000),
                        ""OrganizationId"" UUID NOT NULL,
                        ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    CREATE INDEX IF NOT EXISTS ""IX_Roles_OrganizationId"" ON ""Roles"" (""OrganizationId"");
                ";
                await rolesTableCmd.ExecuteNonQueryAsync();
                logger.LogInformation("Roles table ensured.");
            }

            // Ensure RolePermissions table exists
            using (var rpTableCmd = connection.CreateCommand())
            {
                rpTableCmd.CommandText = @"
                    CREATE TABLE IF NOT EXISTS ""RolePermissions"" (
                        ""RoleId"" UUID NOT NULL,
                        ""PermissionId"" UUID NOT NULL,
                        PRIMARY KEY (""RoleId"", ""PermissionId""),
                        CONSTRAINT ""FK_RolePermissions_Roles"" FOREIGN KEY (""RoleId"") REFERENCES ""Roles""(""RoleId"") ON DELETE CASCADE,
                        CONSTRAINT ""FK_RolePermissions_Permissions"" FOREIGN KEY (""PermissionId"") REFERENCES ""Permissions""(""PermissionId"") ON DELETE CASCADE
                    );
                ";
                await rpTableCmd.ExecuteNonQueryAsync();
                logger.LogInformation("RolePermissions table ensured.");
            }

            // Option A: view + manage per area (~20 permissions)
            var seedPermissions = new (string Code, string Name, string? Category)[]
            {
                ("users.view", "View Users", "Users"),
                ("users.manage", "Manage Users", "Users"),
                ("roles.view", "View Roles", "Roles"),
                ("roles.manage", "Manage Roles", "Roles"),
                ("permissions.view", "View Permissions", "Permissions"),
                ("permissions.manage", "Manage Permissions", "Permissions"),
                ("workflows.view", "View Workflows", "Workflows"),
                ("workflows.manage", "Manage Workflows", "Workflows"),
                ("tasks.view", "View Tasks", "Tasks"),
                ("tasks.manage", "Manage Tasks", "Tasks"),
                ("teams.view", "View Teams", "Teams"),
                ("teams.manage", "Manage Teams", "Teams"),
                ("members.view", "View Members", "Members"),
                ("members.manage", "Manage Members", "Members"),
                ("sla.view", "View SLA", "SLA"),
                ("sla.manage", "Manage SLA", "SLA"),
                ("workload.view", "View Workload", "Workload"),
                ("workload.manage", "Manage Workload", "Workload"),
                ("priority_rules.view", "View Priority Rules", "Priority Rules"),
                ("priority_rules.manage", "Manage Priority Rules", "Priority Rules"),
            };

            var npgsqlConnection = (NpgsqlConnection)connection;
            foreach (var p in seedPermissions)
            {
                await using var seedCmd = new NpgsqlCommand(
                    @"INSERT INTO ""Permissions"" (""PermissionId"", ""Code"", ""Name"", ""Category"", ""CreatedAt"", ""UpdatedAt"")
                      VALUES (gen_random_uuid(), @code, @name, @category, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                      ON CONFLICT (""Code"") DO NOTHING",
                    npgsqlConnection);
                seedCmd.Parameters.AddWithValue("code", p.Code);
                seedCmd.Parameters.AddWithValue("name", p.Name);
                seedCmd.Parameters.AddWithValue("category", (object?)p.Category ?? DBNull.Value);
                await seedCmd.ExecuteNonQueryAsync();
            }
            logger.LogInformation("Permissions seed completed.");
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

