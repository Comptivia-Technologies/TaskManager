using System;
using System.Data;
using Npgsql;

class Program
{
    static void Main(string[] args)
    {
        // Get connection string from args or use default
        // Default matches appsettings.Development.json
        var connectionString = args.Length > 0 
            ? args[0] 
            : "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=test123";

        Console.WriteLine("==========================================");
        Console.WriteLine("Database Migration Tool");
        Console.WriteLine("==========================================");
        Console.WriteLine($"Database: WorkflowManagement");
        Console.WriteLine($"Host: localhost:5432");
        Console.WriteLine();

        try
        {
            using var connection = new NpgsqlConnection(connectionString);
            connection.Open();
            Console.WriteLine("✓ Connected to database.");

            // Check if TeamId column exists
            using var checkCmd = new NpgsqlCommand(@"
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'Stages' AND column_name = 'TeamId'", connection);
            
            var columnExists = checkCmd.ExecuteScalar() != null;

            if (columnExists)
            {
                Console.WriteLine("✓ TeamId column already exists. Migration not needed.");
                return;
            }

            Console.WriteLine("⚠ TeamId column not found. Starting migration...");
            Console.WriteLine();

            // Ensure Teams table has at least one team
            using var teamCheckCmd = new NpgsqlCommand("SELECT COUNT(*) FROM \"Teams\"", connection);
            var teamCount = Convert.ToInt32(teamCheckCmd.ExecuteScalar() ?? 0);

            if (teamCount == 0)
            {
                Console.WriteLine("Creating default team...");
                using var createTeamCmd = new NpgsqlCommand(@"
                    INSERT INTO ""Teams"" (""TeamName"", ""Description"", ""CreatedAt"", ""UpdatedAt"") 
                    VALUES ('Default Team', 'Default team for stages', NOW(), NOW())", connection);
                createTeamCmd.ExecuteNonQuery();
                Console.WriteLine("✓ Default team created.");
            }

            // Get first team ID
            using var getTeamCmd = new NpgsqlCommand("SELECT \"TeamId\" FROM \"Teams\" LIMIT 1", connection);
            var defaultTeamId = Convert.ToInt32(getTeamCmd.ExecuteScalar());
            Console.WriteLine($"Using Team ID: {defaultTeamId}");

            // Add TeamId column (nullable first)
            Console.WriteLine("Adding TeamId column...");
            using var addColumnCmd = new NpgsqlCommand($@"
                ALTER TABLE ""Stages"" 
                ADD COLUMN ""TeamId"" INTEGER", connection);
            addColumnCmd.ExecuteNonQuery();
            Console.WriteLine("✓ Column added.");

            // Set default value for existing stages
            Console.WriteLine("Setting default values for existing stages...");
            using var updateCmd = new NpgsqlCommand($@"
                UPDATE ""Stages"" 
                SET ""TeamId"" = {defaultTeamId} 
                WHERE ""TeamId"" IS NULL", connection);
            var updatedRows = updateCmd.ExecuteNonQuery();
            Console.WriteLine($"✓ Updated {updatedRows} existing stage(s).");

            // Make column NOT NULL
            Console.WriteLine("Making TeamId NOT NULL...");
            using var notNullCmd = new NpgsqlCommand(@"
                ALTER TABLE ""Stages"" 
                ALTER COLUMN ""TeamId"" SET NOT NULL", connection);
            notNullCmd.ExecuteNonQuery();
            Console.WriteLine("✓ Column set to NOT NULL.");

            // Add default value
            using var defaultCmd = new NpgsqlCommand($@"
                ALTER TABLE ""Stages"" 
                ALTER COLUMN ""TeamId"" SET DEFAULT {defaultTeamId}", connection);
            defaultCmd.ExecuteNonQuery();
            Console.WriteLine("✓ Default value set.");

            // Add foreign key constraint
            Console.WriteLine("Adding foreign key constraint...");
            using var fkCmd = new NpgsqlCommand(@"
                ALTER TABLE ""Stages"" 
                ADD CONSTRAINT ""FK_Stages_Teams_TeamId"" 
                FOREIGN KEY (""TeamId"") REFERENCES ""Teams"" (""TeamId"") ON DELETE RESTRICT", connection);
            fkCmd.ExecuteNonQuery();
            Console.WriteLine("✓ Foreign key constraint added.");

            Console.WriteLine();
            Console.WriteLine("==========================================");
            Console.WriteLine("Migration completed successfully!");
            Console.WriteLine("==========================================");
        }
        catch (Exception ex)
        {
            Console.WriteLine();
            Console.WriteLine("==========================================");
            Console.WriteLine("ERROR: Migration failed!");
            Console.WriteLine("==========================================");
            Console.WriteLine($"Error: {ex.Message}");
            if (ex.InnerException != null)
            {
                Console.WriteLine($"Details: {ex.InnerException.Message}");
            }
            Environment.Exit(1);
        }
    }
}

