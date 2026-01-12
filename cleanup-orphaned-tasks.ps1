# Cleanup orphaned tasks from WorkflowManagement.API
# This removes tasks that exist in WorkflowManagement but not in TaskService database

Write-Host "Cleaning up orphaned tasks from WorkflowManagement.API..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5005/api/tasks/cleanup-orphaned" -Method Post -ContentType "application/json"
    Write-Host "[SUCCESS] Cleanup completed successfully!" -ForegroundColor Green
    Write-Host "Response: $($response.message)" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check TaskService logs for detailed cleanup information." -ForegroundColor Yellow
}
catch {
    Write-Host "[ERROR] Error cleaning up orphaned tasks:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}

