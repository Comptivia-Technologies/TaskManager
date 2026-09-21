# Starts local RabbitMQ with management UI and delayed-message plugin.
# Usage: .\scripts\start-rabbitmq.ps1

$ErrorActionPreference = "Stop"
$containerName = "rabbitmq"
$image = "heidiks/rabbitmq-delayed-message-exchange:latest"

function Test-DockerInstalled {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Write-Host "ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
        Write-Host "Install Docker Desktop, then run this script again." -ForegroundColor Yellow
        exit 1
    }
}

function Test-DockerRunning {
    docker info 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Docker is installed but the daemon is not running." -ForegroundColor Red
        Write-Host "Start Docker Desktop, then run this script again." -ForegroundColor Yellow
        exit 1
    }
}

function Wait-RabbitMq {
    Write-Host "Waiting for RabbitMQ on localhost:5672..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5672)
            $tcp.Close()
            return $true
        }
        catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

Test-DockerInstalled
Test-DockerRunning

$existing = docker ps -a --filter "name=^/${containerName}$" --format "{{.Names}}" 2>$null
if ($existing -eq $containerName) {
    $running = docker ps --filter "name=^/${containerName}$" --filter "status=running" --format "{{.Names}}" 2>$null
    if ($running -eq $containerName) {
        Write-Host "RabbitMQ container is already running." -ForegroundColor Green
    }
    else {
        Write-Host "Starting existing RabbitMQ container..." -ForegroundColor Cyan
        docker start $containerName | Out-Null
    }
}
else {
    Write-Host "Pulling $image ..." -ForegroundColor Cyan
    docker pull $image
    Write-Host "Creating RabbitMQ container (AMQP 5672, UI 15672, delayed-message plugin)..." -ForegroundColor Cyan
    docker run -d --name $containerName `
        -p 5672:5672 `
        -p 15672:15672 `
        $image | Out-Null
}

if (-not (Wait-RabbitMq)) {
    Write-Host "ERROR: RabbitMQ did not become ready on port 5672." -ForegroundColor Red
    docker logs $containerName
    exit 1
}

Write-Host "RabbitMQ is ready." -ForegroundColor Green
Write-Host "  AMQP:  localhost:5672 (guest/guest)" -ForegroundColor Cyan
Write-Host "  UI:    http://localhost:15672" -ForegroundColor Cyan
