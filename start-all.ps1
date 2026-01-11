# Start All Microservices Script
# Run this from the project root directory

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Microservices Architecture  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is installed
Write-Host "[1/9] Checking Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker is installed: $dockerVersion" -ForegroundColor Green
    } else {
        throw "Docker not found"
    }
} catch {
    Write-Host "  ✗ Docker is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Please install Docker Desktop:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.docker.com/products/docker-desktop/" -ForegroundColor White
    Write-Host "  2. Install and restart your computer" -ForegroundColor White
    Write-Host "  3. Start Docker Desktop" -ForegroundColor White
    Write-Host "  4. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "  See DOCKER_SETUP.md for detailed instructions" -ForegroundColor Cyan
    exit 1
}

# Check if Docker is running
Write-Host "  → Checking if Docker is running..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Docker is running" -ForegroundColor Green
    } else {
        throw "Docker not running"
    }
} catch {
    Write-Host "  ✗ Docker is not running!" -ForegroundColor Red
    Write-Host "  → Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

# Check if RabbitMQ is running
Write-Host "  → Checking RabbitMQ..." -ForegroundColor Yellow
$rabbitmqRunning = docker ps --filter "name=rabbitmq" --format "{{.Names}}" 2>$null | Select-String "rabbitmq"
if ($rabbitmqRunning) {
    Write-Host "  ✓ RabbitMQ is already running" -ForegroundColor Green
} else {
    Write-Host "  → Starting RabbitMQ container..." -ForegroundColor Yellow
    docker start rabbitmq 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  → Creating new RabbitMQ container..." -ForegroundColor Yellow
        docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ RabbitMQ started successfully" -ForegroundColor Green
            Write-Host "  → Management UI: http://localhost:15672 (guest/guest)" -ForegroundColor Cyan
        } else {
            Write-Host "  ✗ Failed to start RabbitMQ" -ForegroundColor Red
            Write-Host "  → Check Docker logs for errors" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "  ✓ RabbitMQ started" -ForegroundColor Green
    }
}
Start-Sleep -Seconds 2

# Build shared libraries
Write-Host ""
Write-Host "[2/9] Building shared libraries..." -ForegroundColor Yellow
$sharedContractsPath = "backend\Shared\Shared.Contracts"
$sharedMessagingPath = "backend\Shared\Shared.Messaging"

if (Test-Path $sharedContractsPath) {
    Write-Host "  → Building Shared.Contracts..." -ForegroundColor Yellow
    Push-Location $sharedContractsPath
    dotnet build | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Shared.Contracts built" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to build Shared.Contracts" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

if (Test-Path $sharedMessagingPath) {
    Write-Host "  → Building Shared.Messaging..." -ForegroundColor Yellow
    Push-Location $sharedMessagingPath
    dotnet build | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Shared.Messaging built" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to build Shared.Messaging" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
}

# Function to start a service
function Start-Service {
    param(
        [string]$ServiceName,
        [string]$ServicePath,
        [int]$Port,
        [string]$Type = "Existing"
    )
    
    $color = if ($Type -eq "Existing") { "Green" } else { "Cyan" }
    $icon = if ($Type -eq "Existing") { "✓" } else { "🆕" }
    
    Write-Host "  → Starting $ServiceName..." -ForegroundColor Yellow
    
    if (Test-Path $ServicePath) {
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ServicePath'; Write-Host 'Starting $ServiceName on port $Port...' -ForegroundColor $color; dotnet run" -WindowStyle Normal
        Start-Sleep -Seconds 3
        Write-Host "  $icon $ServiceName started (Port $Port)" -ForegroundColor $color
    } else {
        Write-Host "  ✗ Path not found: $ServicePath" -ForegroundColor Red
    }
}

# Start Existing APIs
Write-Host ""
Write-Host "[3/9] Starting Existing APIs..." -ForegroundColor Green
Start-Service "SLAConfiguration.API" "backend\SLAConfiguration.API" 5001 "Existing"
Start-Service "WorkflowManagement.API" "backend\WorkflowManagement.API" 5000 "Existing"
Start-Service "Workload.API" "backend\Workload.API" 5003 "Existing"

# Start New Microservices
Write-Host ""
Write-Host "[4/9] Starting New Microservices..." -ForegroundColor Cyan
Start-Service "APIGateway" "backend\APIGateway" 5004 "New"
Start-Service "TaskService" "backend\TaskService" 5005 "New"
Start-Service "WorkflowService" "backend\WorkflowService" 5006 "New"
Start-Service "SLAManagerService" "backend\SLAManagerService" 5007 "New"
Start-Service "WorkloadService" "backend\WorkloadService" 5008 "New"

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All Services Started!                " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Existing APIs (Frontend):" -ForegroundColor Green
Write-Host "  ✓ WorkflowManagement.API: http://localhost:5000/swagger" -ForegroundColor White
Write-Host "  ✓ SLAConfiguration.API:    http://localhost:5001/swagger" -ForegroundColor White
Write-Host "  ✓ Workload.API:            http://localhost:5003/swagger" -ForegroundColor White
Write-Host ""
Write-Host "New Microservices (Orchestration):" -ForegroundColor Cyan
Write-Host "  🆕 APIGateway:         http://localhost:5004/swagger" -ForegroundColor White
Write-Host "  🆕 TaskService:         http://localhost:5005/swagger" -ForegroundColor White
Write-Host "  🆕 WorkflowService:     http://localhost:5006/swagger" -ForegroundColor White
Write-Host "  🆕 SLAManagerService:   http://localhost:5007/swagger" -ForegroundColor White
Write-Host "  🆕 WorkloadService:     http://localhost:5008/swagger" -ForegroundColor White
Write-Host ""
Write-Host "RabbitMQ Management:" -ForegroundColor Yellow
Write-Host "  🐇 RabbitMQ UI:        http://localhost:15672 (guest/guest)" -ForegroundColor White
Write-Host ""
Write-Host "Test Orchestration Flow:" -ForegroundColor Magenta
Write-Host "  POST http://localhost:5004/api/tasks" -ForegroundColor White
Write-Host ""
Write-Host "Note: Services are running in separate PowerShell windows." -ForegroundColor Gray
Write-Host "      Close those windows to stop the services." -ForegroundColor Gray
Write-Host ""

