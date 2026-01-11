# Diagnostic script to check task assignment issues

Write-Host "=== Task Assignment Diagnostic ===" -ForegroundColor Cyan
Write-Host ""

# Check if services are running
Write-Host "[*] Checking if services are running..." -ForegroundColor Yellow
$services = @("APIGateway", "TaskService", "WorkflowService", "SLAManagerService", "WorkloadService")
foreach ($service in $services) {
    $process = Get-Process -Name $service -ErrorAction SilentlyContinue
    if ($process) {
        Write-Host "  [OK] $service is running (PID: $($process.Id))" -ForegroundColor Green
    } else {
        Write-Host "  [X] $service is NOT running" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "[*] Database Checks (run these in PostgreSQL):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Check if workflow has TeamId:" -ForegroundColor Cyan
Write-Host '   SELECT "WorkflowId", "WorkflowName", "TeamId" FROM "Workflows" WHERE "WorkflowName" LIKE ''%AIMS%'';' -ForegroundColor White
Write-Host ""
Write-Host "2. Check members in that team:" -ForegroundColor Cyan
Write-Host '   SELECT "MemberId", "FirstName", "LastName", "TeamId", "SkillLevel" FROM "Members" WHERE "TeamId" = <TeamId>;' -ForegroundColor White
Write-Host ""
Write-Host "3. Check TaskAssignments table:" -ForegroundColor Cyan
Write-Host '   SELECT * FROM "TaskAssignments" ORDER BY "AssignedAt" DESC LIMIT 5;' -ForegroundColor White
Write-Host ""
Write-Host "4. Check Tasks in TaskService database:" -ForegroundColor Cyan
Write-Host '   SELECT "TaskId", "TaskName", "Status", "MemberId", "WorkflowId" FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 5;' -ForegroundColor White
Write-Host ""
Write-Host "[*] Next Steps:" -ForegroundColor Yellow
Write-Host "1. Check WorkloadService logs for:" -ForegroundColor White
Write-Host "   - 'Found workflow. WorkflowId: ..., TeamId: ...'" -ForegroundColor Gray
Write-Host "   - 'Filtering members by workflow team. Found X members...'" -ForegroundColor Gray
Write-Host "   - 'Evaluated member. MemberId: ..., WorkloadScore: ...'" -ForegroundColor Gray
Write-Host "   - 'Selected best member. MemberId: ...'" -ForegroundColor Gray
Write-Host "   - 'Task assigned to member. TaskId: ..., MemberId: ...'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. If you see errors, check:" -ForegroundColor White
Write-Host "   - 'Workflow not found' -> Workflow doesn't exist" -ForegroundColor Gray
Write-Host "   - 'No members available' -> No members in workflow's team" -ForegroundColor Gray
Write-Host "   - 'Error evaluating workload' -> Issue with task query or calculation" -ForegroundColor Gray
Write-Host ""

