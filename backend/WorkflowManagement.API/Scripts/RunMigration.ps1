# PowerShell script to run database migration
# Usage: .\Scripts\RunMigration.ps1

param(
    [string]$DatabaseName = "WorkflowManagement",
    [string]$Username = "postgres",
    [string]$Host = "localhost",
    [int]$Port = 5432
)

Write-Host "Running database migration..." -ForegroundColor Green
Write-Host "Database: $DatabaseName" -ForegroundColor Cyan
Write-Host "Host: $Host:$Port" -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found. Please ensure PostgreSQL is installed and in your PATH." -ForegroundColor Red
    exit 1
}

# Get password
$Password = Read-Host "Enter PostgreSQL password" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set PGPASSWORD environment variable
$env:PGPASSWORD = $PlainPassword

# Run migration
$scriptPath = Join-Path $PSScriptRoot "MigrateStagesTeamId.sql"
$connectionString = "-h $Host -p $Port -U $Username -d $DatabaseName"

Write-Host "Executing migration script..." -ForegroundColor Yellow
& psql $connectionString -f $scriptPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nMigration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`nMigration failed. Please check the error messages above." -ForegroundColor Red
}

# Clear password from environment
Remove-Item Env:\PGPASSWORD



