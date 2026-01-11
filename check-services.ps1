# Diagnostic script to check microservices status
Write-Host "=== Microservices Diagnostic Check ===" -ForegroundColor Cyan
Write-Host ""

# Check if RabbitMQ is running
Write-Host "1. Checking RabbitMQ..." -ForegroundColor Yellow
try {
    $rabbitmqStatus = docker ps --filter "name=rabbitmq" --format "{{.Status}}"
    if ($rabbitmqStatus) {
        Write-Host "   ✓ RabbitMQ is running: $rabbitmqStatus" -ForegroundColor Green
    } else {
        Write-Host "   ✗ RabbitMQ is NOT running!" -ForegroundColor Red
        Write-Host "   Start it with: docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ✗ Could not check RabbitMQ status" -ForegroundColor Red
}
Write-Host ""

# Check if services are listening on their ports
Write-Host "2. Checking service ports..." -ForegroundColor Yellow
$services = @(
    @{Name="API Gateway"; Port=5004},
    @{Name="TaskService"; Port=5005},
    @{Name="WorkflowService"; Port=5006},
    @{Name="SLAManagerService"; Port=5007},
    @{Name="WorkloadService"; Port=5008}
)

foreach ($service in $services) {
    $connection = Test-NetConnection -ComputerName localhost -Port $service.Port -WarningAction SilentlyContinue -InformationLevel Quiet
    if ($connection) {
        Write-Host "   ✓ $($service.Name) is listening on port $($service.Port)" -ForegroundColor Green
    } else {
        Write-Host "   ✗ $($service.Name) is NOT listening on port $($service.Port)" -ForegroundColor Red
    }
}
Write-Host ""

# Check RabbitMQ Management UI
Write-Host "3. Checking RabbitMQ Management UI..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:15672" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "   ✓ RabbitMQ Management UI is accessible at http://localhost:15672" -ForegroundColor Green
    Write-Host "   Login: guest / guest" -ForegroundColor Cyan
} catch {
    Write-Host "   ✗ RabbitMQ Management UI is NOT accessible" -ForegroundColor Red
}
Write-Host ""

# Check if processes are running
Write-Host "4. Checking .NET processes..." -ForegroundColor Yellow
$processes = Get-Process -Name "dotnet" -ErrorAction SilentlyContinue
if ($processes) {
    Write-Host "   ✓ Found $($processes.Count) dotnet process(es)" -ForegroundColor Green
    foreach ($proc in $processes) {
        Write-Host "      - PID: $($proc.Id), Memory: $([math]::Round($proc.WorkingSet64/1MB, 2)) MB" -ForegroundColor Cyan
    }
} else {
    Write-Host "   ✗ No dotnet processes found" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== Diagnostic Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Ensure RabbitMQ is running (docker ps)" -ForegroundColor White
Write-Host "2. Start all services using start-all.ps1" -ForegroundColor White
Write-Host "3. Check service logs for connection errors" -ForegroundColor White
Write-Host "4. Verify queues in RabbitMQ Management UI (http://localhost:15672)" -ForegroundColor White

