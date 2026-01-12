# Sync all overdue tasks from TaskService to WorkflowManagement.API
# This syncs existing overdue tasks that were marked overdue before the sync functionality was added

Write-Host "Syncing overdue tasks to WorkflowManagement.API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5005/api/tasks/sync-overdue" -Method Post -ContentType "application/json"
    Write-Host "[SUCCESS] Sync completed successfully!" -ForegroundColor Green
    Write-Host "Response: $($response.message)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check TaskService logs for detailed sync information." -ForegroundColor Yellow
}
catch {
    Write-Host "[ERROR] Error syncing overdue tasks:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

