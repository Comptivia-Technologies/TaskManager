# PowerShell script to run the MakeWorkflowTeamIdNullable.sql migration
# Usage: .\RunWorkflowTeamIdMigration.ps1

$ErrorActionPreference = "Stop"

# Get the script directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlScriptPath = Join-Path $scriptPath "MakeWorkflowTeamIdNullable.sql"

# Database connection parameters (update these if needed)
$dbHost = "localhost"
$dbPort = "5432"
$dbName = "WorkflowManagement"
$dbUser = "postgres"
$dbPassword = "test123"  # Change to "test123" if using Development settings

Write-Host "Running migration: MakeWorkflowTeamIdNullable.sql" -ForegroundColor Cyan
Write-Host "Database: $dbName on ${dbHost}:${dbPort}" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = "psql"
try {
    $null = Get-Command psql -ErrorAction Stop
} catch {
    # Try common PostgreSQL installation paths
    $commonPaths = @(
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe",
        "C:\Program Files\PostgreSQL\12\bin\psql.exe"
    )
    
    $found = $false
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $psqlPath = $path
            $found = $true
            break
        }
    }
    
    if (-not $found) {
        Write-Host "Error: psql not found. Please install PostgreSQL or add it to your PATH." -ForegroundColor Red
        exit 1
    }
}

# Set PGPASSWORD environment variable for password authentication
$env:PGPASSWORD = $dbPassword

try {
    # Run the SQL script
    & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d $dbName -f $sqlScriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error running migration: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear the password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

