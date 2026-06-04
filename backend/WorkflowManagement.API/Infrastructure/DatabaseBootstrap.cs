using Microsoft.EntityFrameworkCore;
using Npgsql;
using WorkflowManagement.API.Data;
using WorkflowManagement.API.Models;

namespace WorkflowManagement.API.Infrastructure;

public static class DatabaseBootstrap
{
    public static async System.Threading.Tasks.Task InitializeAsync(IServiceProvider services, ILogger logger)
    {
        using var scope = services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

        await dbContext.Database.EnsureCreatedAsync();

        var connection = dbContext.Database.GetDbConnection();
        var wasOpen = connection.State == System.Data.ConnectionState.Open;
        if (!wasOpen) await connection.OpenAsync();

        try
        {
            await DropOrganizationColumnsIfExistAsync(connection, logger);
            await EnsureAppUsersTableAsync(connection, logger);
            await EnsureTaskAuditEntriesTableAsync(connection, logger);
            await SeedPermissionsAsync(connection, logger);
            await SeedAdminRoleAndUserAsync(dbContext, config, logger);
        }
        finally
        {
            if (!wasOpen) await connection.CloseAsync();
        }
    }

    private static async System.Threading.Tasks.Task DropOrganizationColumnsIfExistAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        var tables = new[] { "Teams", "Members", "Workflows", "Stages", "Tasks", "Roles" };
        foreach (var table in tables)
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = $@"
                ALTER TABLE ""{table}"" DROP COLUMN IF EXISTS ""OrganizationId"";
                DROP INDEX IF EXISTS ""IX_{table}_OrganizationId"";";
            try
            {
                await cmd.ExecuteNonQueryAsync();
            }
            catch (Exception ex)
            {
                logger.LogDebug(ex, "Drop OrganizationId on {Table} skipped", table);
            }
        }

        await using var dropUserId = connection.CreateCommand();
        dropUserId.CommandText = @"ALTER TABLE ""Members"" DROP COLUMN IF EXISTS ""UserId"";";
        try { await dropUserId.ExecuteNonQueryAsync(); } catch { /* column may not exist */ }

        logger.LogInformation("OrganizationId columns removed where present.");
    }

    private static async System.Threading.Tasks.Task EnsureAppUsersTableAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS ""AppUsers"" (
                ""UserId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ""Email"" VARCHAR(200) NOT NULL,
                ""PasswordHash"" TEXT NOT NULL,
                ""FullName"" VARCHAR(200) NOT NULL,
                ""RoleId"" UUID NOT NULL,
                ""IsActive"" BOOLEAN NOT NULL DEFAULT TRUE,
                ""CreatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ""UpdatedAt"" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ""FK_AppUsers_Roles"" FOREIGN KEY (""RoleId"") REFERENCES ""Roles""(""RoleId"") ON DELETE RESTRICT
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_AppUsers_Email"" ON ""AppUsers"" (""Email"");";
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("AppUsers table ensured.");
    }

    private static async System.Threading.Tasks.Task EnsureTaskAuditEntriesTableAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS ""TaskAuditEntries"" (
                ""AuditId"" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ""TaskId"" UUID NOT NULL,
                ""EventId"" UUID NOT NULL,
                ""ActionType"" VARCHAR(50) NOT NULL,
                ""MemberId"" UUID NULL,
                ""FromMemberId"" UUID NULL,
                ""ToMemberId"" UUID NULL,
                ""StageId"" UUID NULL,
                ""StageName"" VARCHAR(200) NULL,
                ""NextStageId"" UUID NULL,
                ""NextStageName"" VARCHAR(200) NULL,
                ""Reason"" VARCHAR(500) NULL,
                ""CorrelationId"" UUID NOT NULL,
                ""OccurredAt"" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT ""FK_TaskAuditEntries_Tasks"" FOREIGN KEY (""TaskId"") REFERENCES ""Tasks""(""TaskId"") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ""IX_TaskAuditEntries_EventId"" ON ""TaskAuditEntries"" (""EventId"");
            CREATE INDEX IF NOT EXISTS ""IX_TaskAuditEntries_TaskId_OccurredAt"" ON ""TaskAuditEntries"" (""TaskId"", ""OccurredAt"");";
        await cmd.ExecuteNonQueryAsync();
        logger.LogInformation("TaskAuditEntries table ensured.");
    }

    private static async System.Threading.Tasks.Task SeedPermissionsAsync(System.Data.Common.DbConnection connection, ILogger logger)
    {
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

        if (connection is not NpgsqlConnection npgsql) return;
        foreach (var p in seedPermissions)
        {
            await using var seedCmd = new NpgsqlCommand(
                @"INSERT INTO ""Permissions"" (""PermissionId"", ""Code"", ""Name"", ""Category"", ""CreatedAt"", ""UpdatedAt"")
                  SELECT gen_random_uuid(), @code, @name, @category, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                  WHERE NOT EXISTS (SELECT 1 FROM ""Permissions"" WHERE ""Code"" = @code)",
                npgsql);
            seedCmd.Parameters.AddWithValue("code", p.Code);
            seedCmd.Parameters.AddWithValue("name", p.Name);
            seedCmd.Parameters.AddWithValue("category", (object?)p.Category ?? DBNull.Value);
            await seedCmd.ExecuteNonQueryAsync();
        }
        logger.LogInformation("Permissions seed completed.");
    }

    private static async System.Threading.Tasks.Task SeedAdminRoleAndUserAsync(ApplicationDbContext context, IConfiguration config, ILogger logger)
    {
        var adminEmail = config["Seed:AdminEmail"] ?? "admin@workflow.local";
        var adminPassword = config["Seed:AdminPassword"] ?? "Admin@12345";

        var allPermissions = await context.Permissions.ToListAsync();
        var adminRole = await context.Roles
            .Include(r => r.RolePermissions)
            .FirstOrDefaultAsync(r => r.Name == "Administrator");

        if (adminRole == null)
        {
            adminRole = new Role
            {
                Name = "Administrator",
                Description = "Full system access",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            context.Roles.Add(adminRole);
            await context.SaveChangesAsync();
        }

        var existingRp = await context.RolePermissions.Where(rp => rp.RoleId == adminRole.RoleId).ToListAsync();
        context.RolePermissions.RemoveRange(existingRp);
        foreach (var perm in allPermissions)
            context.RolePermissions.Add(new RolePermission { RoleId = adminRole.RoleId, PermissionId = perm.PermissionId });
        await context.SaveChangesAsync();

        if (!await context.AppUsers.AnyAsync(u => u.Email == adminEmail.ToLower()))
        {
            context.AppUsers.Add(new AppUser
            {
                Email = adminEmail.ToLower(),
                FullName = "System Administrator",
                RoleId = adminRole.RoleId,
                IsActive = true,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded admin user {Email}", adminEmail);
        }
    }
}
