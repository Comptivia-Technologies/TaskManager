# Diagnostic Script for Queue Creation Issues
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Queue Creation Diagnostic" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check RabbitMQ
Write-Host "[1] Checking RabbitMQ..." -ForegroundColor Yellow
$rabbitmq = Test-NetConnection -ComputerName localhost -Port 5672 -InformationLevel Quiet
if ($rabbitmq) {
    Write-Host "  ✓ RabbitMQ is accessible" -ForegroundColor Green
} else {
    Write-Host "  ✗ RabbitMQ is NOT accessible!" -ForegroundColor Red
    Write-Host "    Run: docker start rabbitmq" -ForegroundColor Yellow
    exit 1
}

# Check RabbitMQ Management API
Write-Host "`n[2] Checking RabbitMQ Management API..." -ForegroundColor Yellow
try {
    $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("guest:guest"))
    $headers = @{ Authorization = "Basic $cred" }
    
    $connections = Invoke-RestMethod -Uri "http://localhost:15672/api/connections" -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  Active Connections: $($connections.Count)" -ForegroundColor $(if ($connections.Count -gt 0) { "Green" } else { "Red" })
    
    if ($connections.Count -gt 0) {
        Write-Host "  Connection Details:" -ForegroundColor Cyan
        $connections | ForEach-Object {
            Write-Host "    - $($_.name) (State: $($_.state), VHost: $($_.vhost))" -ForegroundColor White
        }
    } else {
        Write-Host "  ⚠ No connections! Services may not be connected to RabbitMQ." -ForegroundColor Yellow
    }
    
    $queues = Invoke-RestMethod -Uri "http://localhost:15672/api/queues" -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "`n  Queues Found: $($queues.Count)" -ForegroundColor $(if ($queues.Count -gt 0) { "Green" } else { "Yellow" })
    
    if ($queues.Count -gt 0) {
        Write-Host "  Queue Details:" -ForegroundColor Cyan
        $queues | ForEach-Object {
            Write-Host "    - $($_.name) (Messages: $($_.messages), Consumers: $($_.consumers))" -ForegroundColor White
        }
    } else {
        Write-Host "  ⚠ No queues found!" -ForegroundColor Yellow
    }
    
    $exchanges = Invoke-RestMethod -Uri "http://localhost:15672/api/exchanges" -Headers $headers -Method GET -ErrorAction Stop
    $customExchanges = $exchanges | Where-Object { $_.name -notlike "amq.*" -and $_.name -ne "" }
    Write-Host "`n  Custom Exchanges: $($customExchanges.Count)" -ForegroundColor $(if ($customExchanges.Count -gt 0) { "Green" } else { "Yellow" })
    
    if ($customExchanges.Count -gt 0) {
        Write-Host "  Exchange Details:" -ForegroundColor Cyan
        $customExchanges | ForEach-Object {
            Write-Host "    - $($_.name) (Type: $($_.type))" -ForegroundColor White
        }
    }
    
} catch {
    Write-Host "  ✗ Error: $($_.Exception.Message)" -ForegroundColor Red
}

# Check service ports
Write-Host "`n[3] Checking service ports..." -ForegroundColor Yellow
$ports = @(
    @{Port=5004; Name="APIGateway"},
    @{Port=5005; Name="TaskService"},
    @{Port=5006; Name="WorkflowService"},
    @{Port=5007; Name="SLAManagerService"},
    @{Port=5008; Name="WorkloadService"}
)

$runningServices = @()
foreach ($p in $ports) {
    $result = netstat -ano | findstr ":$($p.Port)" | Select-Object -First 1
    if ($result) {
        Write-Host "  ✓ $($p.Name) (Port $($p.Port)) - RUNNING" -ForegroundColor Green
        $runningServices += $p.Name
    } else {
        Write-Host "  ✗ $($p.Name) (Port $($p.Port)) - NOT RUNNING" -ForegroundColor Red
    }
}

# Recommendations
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Recommendations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($runningServices.Count -lt 5) {
    Write-Host "⚠ Not all services are running!" -ForegroundColor Yellow
    Write-Host "  Action: Restart all services using start-all.ps1" -ForegroundColor White
    Write-Host ""
}

if ($connections.Count -eq 0) {
    Write-Host "⚠ No RabbitMQ connections!" -ForegroundColor Yellow
    Write-Host "  This means services are not connected to RabbitMQ." -ForegroundColor White
    Write-Host "  Possible causes:" -ForegroundColor White
    Write-Host "    1. Services are using old Shared.Messaging library" -ForegroundColor Gray
    Write-Host "    2. RabbitMQ connection failed during startup" -ForegroundColor Gray
    Write-Host "    3. Services crashed during consumer startup" -ForegroundColor Gray
    Write-Host "  Action: Check service logs for errors, then restart services" -ForegroundColor White
    Write-Host ""
}

if ($queues.Count -eq 0) {
    Write-Host "⚠ No queues found!" -ForegroundColor Yellow
    Write-Host "  Queues are created when StartConsuming() is called successfully." -ForegroundColor White
    Write-Host "  If no queues exist, StartConsuming() is either:" -ForegroundColor White
    Write-Host "    1. Not being called (check Program.cs)" -ForegroundColor Gray
    Write-Host "    2. Throwing exceptions (check service logs)" -ForegroundColor Gray
    Write-Host "    3. Failing silently (now fixed with error handling)" -ForegroundColor Gray
    Write-Host "  Action:" -ForegroundColor White
    Write-Host "    1. Check service console windows for error messages" -ForegroundColor Gray
    Write-Host "    2. Look for 'Failed to start ... consumer' messages" -ForegroundColor Gray
    Write-Host "    3. Restart services to pick up new error handling code" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Check each service's console window for error messages" -ForegroundColor White
Write-Host "  2. Look for messages starting with 'Starting ... consumer...'" -ForegroundColor White
Write-Host "  3. If you see '✗ Failed to start ... consumer', check the error details" -ForegroundColor White
Write-Host "  4. Restart services: Stop all, then run start-all.ps1" -ForegroundColor White
Write-Host ""

