# Script to check task details in TaskService database

Write-Host "=== Task Database Diagnostic ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these SQL queries in PostgreSQL (TaskService database):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Check all tasks with their details:" -ForegroundColor Cyan
Write-Host '   SELECT "TaskId", "TaskName", "Status", "WorkflowId", "MemberId", "SLAConfigurationId", "SLADeadline", "SLAStartTime", "IsOverdue", "CreatedAt", "UpdatedAt" FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 10;' -ForegroundColor White
Write-Host ""
Write-Host "2. Check event tracking fields:" -ForegroundColor Cyan
Write-Host '   SELECT "TaskId", "TaskName", "WorkflowSelectedEventId", "SLAConfiguredEventId", "TaskAssignedEventId" FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 10;' -ForegroundColor White
Write-Host ""
Write-Host "3. Check a specific task (replace TaskId):" -ForegroundColor Cyan
Write-Host '   SELECT * FROM "Tasks" WHERE "TaskId" = ''<YourTaskId>'';' -ForegroundColor White
Write-Host ""
Write-Host "Expected values after full flow:" -ForegroundColor Yellow
Write-Host "  - WorkflowId: Should be set (integer)" -ForegroundColor White
Write-Host "  - MemberId: Should be set (integer)" -ForegroundColor White
Write-Host "  - SLADeadline: Should be set (timestamp)" -ForegroundColor White
Write-Host "  - SLAStartTime: Should be set (timestamp)" -ForegroundColor White
Write-Host "  - Status: Should be 'Assigned' (enum value)" -ForegroundColor White
Write-Host "  - WorkflowSelectedEventId: Should be set (UUID)" -ForegroundColor White
Write-Host "  - SLAConfiguredEventId: Should be set (UUID)" -ForegroundColor White
Write-Host "  - TaskAssignedEventId: Should be set (UUID)" -ForegroundColor White
Write-Host ""

