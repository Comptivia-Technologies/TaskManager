# PowerShell script to fix timezone columns in SLAAssignments table
# Uses Npgsql to execute SQL commands

$connectionString = "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=sree"

Write-Host "Connecting to PostgreSQL..." -ForegroundColor Yellow

# Load Npgsql assembly (if available in .NET runtime)
Add-Type -Path "C:\Program Files\dotnet\shared\Microsoft.NETCore.App\*\Npgsql.dll" -ErrorAction SilentlyContinue

if (-not ([System.Management.Automation.PSTypeName]'Npgsql.NpgsqlConnection').Type) {
    Write-Host "Npgsql not found in GAC. Trying alternative approach..." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please run this SQL manually using pgAdmin or another PostgreSQL client:" -ForegroundColor Cyan
    Write-Host ""
    Get-Content fix_timezone_columns.sql | Write-Host
    Write-Host ""
    Write-Host "Or install PostgreSQL client tools and run:" -ForegroundColor Cyan
    Write-Host "psql -h localhost -U postgres -d WorkflowManagement -f fix_timezone_columns.sql" -ForegroundColor Green
    exit 1
}

try {
    $connection = New-Object Npgsql.NpgsqlConnection($connectionString)
    $connection.Open()
    Write-Host "Connected successfully!" -ForegroundColor Green
    
    $commands = @(
        "ALTER TABLE `"SLAAssignments`" ALTER COLUMN `"SLAStartTime`" TYPE TIMESTAMP WITH TIME ZONE USING `"SLAStartTime`" AT TIME ZONE 'UTC';",
        "ALTER TABLE `"SLAAssignments`" ALTER COLUMN `"SLADeadline`" TYPE TIMESTAMP WITH TIME ZONE USING `"SLADeadline`" AT TIME ZONE 'UTC';",
        "ALTER TABLE `"SLAAssignments`" ALTER COLUMN `"CreatedAt`" TYPE TIMESTAMP WITH TIME ZONE USING `"CreatedAt`" AT TIME ZONE 'UTC';"
    )
    
    foreach ($cmd in $commands) {
        Write-Host "Executing: $($cmd.Substring(0, [Math]::Min(60, $cmd.Length)))..." -ForegroundColor Yellow
        $npgsqlCmd = New-Object Npgsql.NpgsqlCommand($cmd, $connection)
        $npgsqlCmd.ExecuteNonQuery() | Out-Null
        Write-Host "✓ Success" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "All columns updated successfully!" -ForegroundColor Green
    
    $connection.Close()
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the SQL manually:" -ForegroundColor Cyan
    Get-Content fix_timezone_columns.sql | Write-Host
    exit 1
}

