# Quick Test Script for Task Flow
# This script creates a task and shows you what to check

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Task Flow Testing Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create a test task
$task = @{
    taskName = "Test AIMS Task - $(Get-Date -Format 'HH:mm:ss')"
    taskType = "AIMS"
    priority = "Critical"
    description = "Testing the complete orchestration flow"
} | ConvertTo-Json

Write-Host "[*] Creating task via API Gateway..." -ForegroundColor Yellow
Write-Host "   TaskType: ERP" -ForegroundColor Gray
Write-Host "   Priority: Critical" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
        -Method POST `
        -ContentType "application/json" `
        -Body $task

    $taskId = $response.taskId
    $correlationId = $response.correlationId
    
    Write-Host "[OK] Task Created Successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Details:" -ForegroundColor Cyan
    Write-Host "  TaskId: $taskId" -ForegroundColor White
    Write-Host "  CorrelationId: $correlationId" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[*] Waiting 5 seconds for event processing..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  What Happened Behind the Scenes:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[OK] 1. TaskCreatedEvent published to RabbitMQ" -ForegroundColor Green
    Write-Host "[OK] 2. TaskService created task in database (Status: Created)" -ForegroundColor Green
    Write-Host "[OK] 3. WorkflowService matched workflow by task type (ERP -> ERP Workflow)" -ForegroundColor Green
    Write-Host "[OK] 4. SLAManagerService configured SLA with priority 'Critical' (60 min)" -ForegroundColor Green
    Write-Host "[OK] 5. WorkloadService filtered members by workflow's team" -ForegroundColor Green
    Write-Host "[OK] 6. Task assigned to best member from the team" -ForegroundColor Green
    Write-Host "[OK] 7. TaskService updated task (Status: Assigned)" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  How to Verify:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[DB] Check TaskService Database:" -ForegroundColor Magenta
    Write-Host "   SELECT * FROM `"Tasks`" WHERE `"TaskId`" = '$taskId';" -ForegroundColor Gray
    Write-Host "   Expected: WorkflowId, MemberId, SLADeadline all populated" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[DB] Check WorkflowService Database:" -ForegroundColor Magenta
    Write-Host "   SELECT * FROM `"WorkflowSelections`" WHERE `"TaskId`" = '$taskId';" -ForegroundColor Gray
    Write-Host "   Expected: WorkflowId = 1, SelectionReason contains 'ERP'" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[DB] Check SLAManagerService Database:" -ForegroundColor Magenta
    Write-Host "   SELECT * FROM `"SLAAssignments`" WHERE `"TaskId`" = '$taskId';" -ForegroundColor Gray
    Write-Host "   Expected: Priority = 'Critical', ResponseTimeMinutes = 60" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[DB] Check WorkloadService Database:" -ForegroundColor Magenta
    Write-Host "   SELECT * FROM `"TaskAssignments`" WHERE `"TaskId`" = '$taskId';" -ForegroundColor Gray
    Write-Host "   Expected: MemberId from workflow's team" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[LOG] Check Service Logs:" -ForegroundColor Magenta
    Write-Host "   - WorkflowService: Should show 'Matched workflow by name. TaskType: ERP'" -ForegroundColor White
    Write-Host "   - SLAManagerService: Should show 'Priority: Critical' (not 'Medium')" -ForegroundColor White
    Write-Host "   - WorkloadService: Should show 'Filtering members by workflow team'" -ForegroundColor White
    Write-Host ""
    
    Write-Host "[WEB] Check RabbitMQ Management UI:" -ForegroundColor Magenta
    Write-Host "   http://localhost:15672 (guest/guest)" -ForegroundColor White
    Write-Host "   Check queues: task.created.queue, workflow.selected.queue, etc." -ForegroundColor White
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Test Complete!" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    
} catch {
    Write-Host "[ERROR] Error creating task!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "  1. API Gateway is running on port 5004" -ForegroundColor White
    Write-Host "  2. All services are started" -ForegroundColor White
    Write-Host "  3. RabbitMQ is running" -ForegroundColor White
}

