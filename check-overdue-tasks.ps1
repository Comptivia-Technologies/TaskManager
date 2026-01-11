# Check Overdue Tasks Diagnostic Script
# This script checks both SLAAssignments and Tasks tables to see why tasks aren't being marked overdue

Write-Host "=== Checking Overdue Tasks ===" -ForegroundColor Cyan
Write-Host ""

# Connection string - adjust if needed
$connectionString = "Host=localhost;Port=5432;Database=SLAConfiguration;Username=postgres;Password=postgres"

Write-Host "1. Checking SLAAssignments table..." -ForegroundColor Yellow
$query1 = @"
SELECT 
    "TaskId",
    "SLADeadline",
    "IsOverdue",
    "Priority",
    "CreatedAt",
    CASE 
        WHEN "SLADeadline" < NOW() THEN 'OVERDUE'
        ELSE 'NOT_OVERDUE'
    END as Status
FROM "SLAAssignments"
WHERE NOT "IsOverdue"
ORDER BY "SLADeadline" ASC
LIMIT 10;
"@

try {
    $result1 = psql -d $connectionString -c $query1 2>&1
    Write-Host $result1
} catch {
    Write-Host "Error querying SLAAssignments: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Checking Tasks table (TaskService database)..." -ForegroundColor Yellow
$connectionString2 = "Host=localhost;Port=5432;Database=TaskService;Username=postgres;Password=postgres"
$query2 = @"
SELECT 
    "TaskId",
    "TaskName",
    "SLADeadline",
    "IsOverdue",
    "Status",
    CASE 
        WHEN "SLADeadline" < NOW() THEN 'OVERDUE'
        ELSE 'NOT_OVERDUE'
    END as DeadlineStatus
FROM "Tasks"
WHERE "SLADeadline" IS NOT NULL
ORDER BY "SLADeadline" ASC
LIMIT 10;
"@

try {
    $result2 = psql -d $connectionString2 -c $query2 2>&1
    Write-Host $result2
} catch {
    Write-Host "Error querying Tasks: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Current UTC Time:" -ForegroundColor Yellow
Write-Host (Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")

Write-Host ""
Write-Host "=== Diagnostic Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If tasks show as OVERDUE but IsOverdue=false, the fallback worker should mark them."
Write-Host "Check SLAManagerService logs for 'SLA breached for task' messages."

