using Microsoft.EntityFrameworkCore;
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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=postgres";

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

// Ensure database is created and migrations are applied
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        dbContext.Database.EnsureCreated();
        logger.LogInformation("Database ensured/created successfully.");
        
        // Check and add SkillLevel column if it doesn't exist
        var connection = dbContext.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen)
            await connection.OpenAsync();
        
        try
        {
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
                
                // Add column as nullable first
                using var addColumnCommand = connection.CreateCommand();
                addColumnCommand.CommandText = @"
                    ALTER TABLE ""Members"" ADD COLUMN ""SkillLevel"" INTEGER;
                ";
                await addColumnCommand.ExecuteNonQueryAsync();
                
                // Set default value for existing records
                using var updateCommand = connection.CreateCommand();
                updateCommand.CommandText = @"
                    UPDATE ""Members"" SET ""SkillLevel"" = 3 WHERE ""SkillLevel"" IS NULL;
                ";
                await updateCommand.ExecuteNonQueryAsync();
                
                // Make column NOT NULL
                using var alterCommand = connection.CreateCommand();
                alterCommand.CommandText = @"
                    ALTER TABLE ""Members"" ALTER COLUMN ""SkillLevel"" SET NOT NULL;
                ";
                await alterCommand.ExecuteNonQueryAsync();
                
                // Add check constraint
                using var constraintCommand = connection.CreateCommand();
                constraintCommand.CommandText = @"
                    ALTER TABLE ""Members""
                    ADD CONSTRAINT ""CK_Members_SkillLevel_Range"" 
                    CHECK (""SkillLevel"" >= 1 AND ""SkillLevel"" <= 5);
                ";
                await constraintCommand.ExecuteNonQueryAsync();
                
                // Create index
                using var indexCommand = connection.CreateCommand();
                indexCommand.CommandText = @"
                    CREATE INDEX IF NOT EXISTS ""IX_Members_SkillLevel"" 
                    ON ""Members"" (""SkillLevel"");
                ";
                await indexCommand.ExecuteNonQueryAsync();
                
                logger.LogInformation("SkillLevel column added successfully to Members table.");
            }
            else
            {
                logger.LogInformation("SkillLevel column already exists in Members table.");
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
        logger.LogError(ex, "Error ensuring database is created. You may need to run migration scripts manually.");
    }
}

app.Run();

