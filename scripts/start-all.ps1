# Starts RabbitMQ, every backend microservice, and the frontend in one command.
# Each service gets its own PowerShell window so its logs stay readable.
# Usage: .\scripts\start-all.ps1

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")

# Order matters a little (Gateway/TaskService etc. don't strictly depend on
# each other at startup, but this keeps REST APIs coming up before the
# event-driven services that call them).
$backendServices = @(
    "WorkflowManagement.API",
    "SLAConfiguration.API",
    "PriorityRuleEngine.API",
    "Workload.API",
    "APIGateway",
    "TaskService",
    "WorkflowService",
    "SLAManagerService",
    "WorkloadService"
)

Write-Host "== Starting RabbitMQ ==" -ForegroundColor Cyan
& (Join-Path $scriptDir "start-rabbitmq.ps1")

# All services reference the shared Shared.Contracts / Shared.Messaging
# projects. If we "dotnet run" them all at once, each one tries to compile
# those shared projects into the same obj/ output at the same time and they
# lock each other out (CS2012). Build everything sequentially first so the
# shared DLLs are already up to date, then launch with --no-build so nothing
# tries to compile concurrently.
Write-Host ""
Write-Host "== Building backend services (sequential, avoids shared-project lock conflicts) ==" -ForegroundColor Cyan
foreach ($service in $backendServices) {
    $servicePath = Join-Path $repoRoot "backend\$service"
    if (-not (Test-Path $servicePath)) {
        Write-Host "SKIP: $service (path not found: $servicePath)" -ForegroundColor Yellow
        continue
    }

    Write-Host "Building $service ..." -ForegroundColor Green
    dotnet build $servicePath --nologo -v quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Build failed for $service. Fix the build error above, then re-run this script." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "== Starting backend services ==" -ForegroundColor Cyan
foreach ($service in $backendServices) {
    $servicePath = Join-Path $repoRoot "backend\$service"
    if (-not (Test-Path $servicePath)) {
        continue
    }

    Write-Host "Starting $service ..." -ForegroundColor Green
    $title = $service
    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location '$servicePath'; dotnet run --no-build"
    ) | Out-Null

    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "== Starting frontend ==" -ForegroundColor Cyan
$frontendPath = Join-Path $repoRoot "frontend\workflow"
$nodeModules = Join-Path $frontendPath "node_modules"
$npmCommand = if (Test-Path $nodeModules) { "npm start" } else { "npm install; npm start" }

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-Command",
    "`$Host.UI.RawUI.WindowTitle = 'Frontend'; Set-Location '$frontendPath'; $npmCommand"
) | Out-Null

Write-Host ""
Write-Host "All services launching in separate windows:" -ForegroundColor Cyan
Write-Host "  WorkflowManagement.API  -> http://localhost:5000"
Write-Host "  SLAConfiguration.API    -> http://localhost:5002"
Write-Host "  Workload.API            -> http://localhost:5003"
Write-Host "  APIGateway              -> http://localhost:5004"
Write-Host "  TaskService             -> http://localhost:5005"
Write-Host "  WorkflowService         -> http://localhost:5006"
Write-Host "  SLAManagerService       -> http://localhost:5007"
Write-Host "  WorkloadService         -> http://localhost:5008"
Write-Host "  PriorityRuleEngine.API  -> http://localhost:5010"
Write-Host "  Frontend                -> http://localhost:3000"
Write-Host ""
Write-Host "Close each window to stop that service." -ForegroundColor Yellow
