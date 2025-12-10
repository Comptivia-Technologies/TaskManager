using Npgsql;
using System;
using System.IO;
using System.Threading.Tasks;

namespace WorkflowManagement.API.Migrations;

class RunWorkflowMigration
{
    static async Task Main(string[] args)
    {
        // Connection string - update if needed
        var connectionString = args.Length > 0 
            ? args[0] 
            : "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=test123";

        // Get the directory where this executable is located
        var exeDirectory = AppDomain.CurrentDomain.BaseDirectory;
        
        // The SQL file should be in the same directory as this executable
        var scriptPath = Path.Combine(exeDirectory, "AddWorkflowJsonBColumn.sql");
        
        // If not found, try relative to current working directory
        if (!File.Exists(scriptPath))
        {
            scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "AddWorkflowJsonBColumn.sql");
        }
        
        // If still not found, try MakeWorkflowTeamIdNullable.sql (for backward compatibility)
        if (!File.Exists(scriptPath))
        {
            scriptPath = Path.Combine(exeDirectory, "MakeWorkflowTeamIdNullable.sql");
            if (!File.Exists(scriptPath))
            {
                scriptPath = Path.Combine(Directory.GetCurrentDirectory(), "MakeWorkflowTeamIdNullable.sql");
            }
        }
        
        // Resolve to absolute path
        scriptPath = Path.GetFullPath(scriptPath);

        if (!File.Exists(scriptPath))
        {
            Console.WriteLine($"Error: SQL script not found at {scriptPath}");
            Console.WriteLine("Please ensure the file exists.");
            return;
        }

        var sqlScript = await File.ReadAllTextAsync(scriptPath);

        var scriptName = Path.GetFileName(scriptPath);
        Console.WriteLine($"Running migration: {scriptName}");
        Console.WriteLine($"Script path: {scriptPath}");
        Console.WriteLine();

        try
        {
            await using var connection = new NpgsqlConnection(connectionString);
            await connection.OpenAsync();
            Console.WriteLine("Connected to database successfully.");

            await using var command = new NpgsqlCommand(sqlScript, connection);
            await command.ExecuteNonQueryAsync();

            Console.WriteLine();
            Console.WriteLine("Migration completed successfully!");
            if (scriptName.Contains("JsonB") || scriptName.Contains("Json"))
            {
                Console.WriteLine("The WorkflowJson JSONB column has been added to the Workflows table.");
            }
            else if (scriptName.Contains("TeamId"))
            {
                Console.WriteLine("The Workflow.TeamId column is now nullable.");
            }
            else
            {
                Console.WriteLine("Database migration completed.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error running migration: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Inner exception: {ex.InnerException.Message}");
            }
            Environment.Exit(1);
        }
    }
}

