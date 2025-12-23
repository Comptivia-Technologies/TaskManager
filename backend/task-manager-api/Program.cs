using Microsoft.EntityFrameworkCore;
using TaskManager.API.Data;
using TaskManager.API.Middleware;
using TaskManager.API.Repositories;
using TaskManager.API.Services;

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
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=postgres";

builder.Services.AddDbContext<TaskManagerDbContext>(options =>
    options.UseNpgsql(connectionString));

// Http clients for external APIs
var workflowApiBaseUrl = builder.Configuration.GetValue<string>("WorkflowApiBaseUrl")
    ?? "http://localhost:5000/api/";
var slaApiBaseUrl = builder.Configuration.GetValue<string>("SlaApiBaseUrl")
    ?? "http://localhost:5002/api/";

builder.Services.AddHttpClient("WorkflowsApi", client =>
{
    client.BaseAddress = new Uri(workflowApiBaseUrl);
});

builder.Services.AddHttpClient("SlaApi", client =>
{
    client.BaseAddress = new Uri(slaApiBaseUrl);
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Repositories
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITaskManagerTaskRepository, TaskManagerTaskRepository>();

// Services
builder.Services.AddScoped<ITaskAssignmentService, TaskAssignmentService>();
builder.Services.AddScoped<ITaskManagerService, TaskManagerService>();

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

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<TaskManagerDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        dbContext.Database.EnsureCreated();
        logger.LogInformation("Task Manager database ensured/created successfully.");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error ensuring Task Manager database is created.");
    }
}

app.Run();


