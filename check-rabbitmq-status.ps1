# RabbitMQ Connection and Queue Diagnostic Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RabbitMQ Diagnostic Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check RabbitMQ connectivity
Write-Host "[1] Checking RabbitMQ connectivity..." -ForegroundColor Yellow
$rabbitmq = Test-NetConnection -ComputerName localhost -Port 5672 -InformationLevel Quiet
if ($rabbitmq) {
    Write-Host "  ✓ RabbitMQ port 5672 is accessible" -ForegroundColor Green
} else {
    Write-Host "  ✗ RabbitMQ port 5672 is NOT accessible!" -ForegroundColor Red
    Write-Host "    Please ensure RabbitMQ is running: docker start rabbitmq" -ForegroundColor Yellow
    exit
}

# Check RabbitMQ Management UI
Write-Host "`n[2] Checking RabbitMQ Management UI..." -ForegroundColor Yellow
try {
    $cred = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("guest:guest"))
    $headers = @{ Authorization = "Basic $cred" }
    
    # Check connections
    $connections = Invoke-RestMethod -Uri "http://localhost:15672/api/connections" -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "  Active Connections: $($connections.Count)" -ForegroundColor $(if ($connections.Count -gt 0) { "Green" } else { "Red" })
    
    if ($connections.Count -gt 0) {
        Write-Host "  Connection Details:" -ForegroundColor Cyan
        $connections | ForEach-Object {
            Write-Host "    - $($_.name) (State: $($_.state), VHost: $($_.vhost))" -ForegroundColor White
        }
    } else {
        Write-Host "  ⚠ No active connections! Services may not be running or connected." -ForegroundColor Yellow
    }
    
    # Check queues
    $queues = Invoke-RestMethod -Uri "http://localhost:15672/api/queues" -Headers $headers -Method GET -ErrorAction Stop
    Write-Host "`n  Queues Found: $($queues.Count)" -ForegroundColor $(if ($queues.Count -gt 0) { "Green" } else { "Yellow" })
    
    if ($queues.Count -gt 0) {
        Write-Host "  Queue Details:" -ForegroundColor Cyan
        $queues | ForEach-Object {
            Write-Host "    - $($_.name) (Messages: $($_.messages), Consumers: $($_.consumers))" -ForegroundColor White
        }
    } else {
        Write-Host "  ⚠ No queues found! Queues are created when services start consuming." -ForegroundColor Yellow
    }
    
    # Check exchanges
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
    Write-Host "  ✗ Error accessing RabbitMQ Management API: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Make sure RabbitMQ Management UI is accessible at http://localhost:15672" -ForegroundColor Yellow
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

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Summary & Recommendations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($runningServices.Count -lt 5) {
    Write-Host "⚠ Not all services are running!" -ForegroundColor Yellow
    Write-Host "  Please start all 5 microservices:" -ForegroundColor White
    Write-Host "    1. TaskService (5005)" -ForegroundColor White
    Write-Host "    2. WorkflowService (5006)" -ForegroundColor White
    Write-Host "    3. SLAManagerService (5007)" -ForegroundColor White
    Write-Host "    4. WorkloadService (5008)" -ForegroundColor White
    Write-Host "    5. APIGateway (5004)" -ForegroundColor White
    Write-Host ""
}

if ($connections.Count -eq 0) {
    Write-Host "⚠ No RabbitMQ connections found!" -ForegroundColor Yellow
    Write-Host "  This means services are not connected to RabbitMQ." -ForegroundColor White
    Write-Host "  Action: Restart all services after rebuilding Shared.Messaging" -ForegroundColor White
    Write-Host ""
}

if ($queues.Count -eq 0) {
    Write-Host "⚠ No queues found!" -ForegroundColor Yellow
    Write-Host "  Queues are created when services start consuming." -ForegroundColor White
    Write-Host "  Action: Restart all services to create queues" -ForegroundColor White
    Write-Host ""
}

Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Rebuild Shared.Messaging (already done)" -ForegroundColor White
Write-Host "  2. Restart ALL services in this order:" -ForegroundColor White
Write-Host "     - TaskService" -ForegroundColor Gray
Write-Host "     - WorkflowService" -ForegroundColor Gray
Write-Host "     - SLAManagerService" -ForegroundColor Gray
Write-Host "     - WorkloadService" -ForegroundColor Gray
Write-Host "     - APIGateway" -ForegroundColor Gray
Write-Host "  3. Wait 10 seconds after all services start" -ForegroundColor White
Write-Host "  4. Run this script again to verify connections and queues" -ForegroundColor White
Write-Host "  5. Create a test task to trigger queue creation" -ForegroundColor White
Write-Host ""

