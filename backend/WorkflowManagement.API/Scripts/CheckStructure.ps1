# PowerShell script to check database structure
# Usage: .\Scripts\CheckStructure.ps1

param(
    [string]$DatabaseName = "WorkflowManagement",
    [string]$Username = "postgres",
    [string]$Host = "localhost",
    [int]$Port = 5432
)

Write-Host "Checking database structure..." -ForegroundColor Green
Write-Host "Database: $DatabaseName" -ForegroundColor Cyan
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

# Run check script
$scriptPath = Join-Path $PSScriptRoot "CheckDatabaseStructure.sql"
$connectionString = "-h $Host -p $Port -U $Username -d $DatabaseName"

Write-Host "Executing structure check..." -ForegroundColor Yellow
& psql $connectionString -f $scriptPath

# Clear password from environment
Remove-Item Env:\PGPASSWORD



