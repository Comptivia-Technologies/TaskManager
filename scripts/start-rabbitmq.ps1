# Starts local RabbitMQ with the management UI.
# Usage: .\scripts\start-rabbitmq.ps1
#
# Deliberately a plain broker with no delayed-message plugin. The plugin build we
# used before (plugin 4.2.0 on RabbitMQ 4.2.0) accepted the x-delayed-message
# exchange and then silently routed nothing, which stalled every workflow with no
# error anywhere. Without the plugin the app's own fallback takes over and declares
# an ordinary topic exchange, which routes correctly
# (Shared.Messaging/RabbitMQEventBus.DeclareExchange).
#
# The cost is that ScheduleAsync falls back to in-process timers, so delayed events
# do not survive a service restart. SLA breaches are still caught by SLAManagerService's
# 60-second poller, and deployed environments use their cloud provider's scheduler
# instead of this broker.
#
# The version is pinned: a floating tag is what moved under us and caused the outage.

$ErrorActionPreference = "Stop"
$containerName = "rabbitmq"
$image = "rabbitmq:3.13-management"

function Test-DockerInstalled {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Write-Host "ERROR: Docker is not installed or not in PATH." -ForegroundColor Red
        Write-Host "Install Docker Desktop, then run this script again." -ForegroundColor Yellow
        exit 1
    }
}

function Test-DockerRunning {
    # docker.exe can write harmless warnings to stderr (e.g. WSL2 blkio throttle
    # notices). PowerShell 5.1 promotes those to terminating errors when
    # $ErrorActionPreference is "Stop", even though the daemon is fine, so
    # relax it just for this call and rely on $LASTEXITCODE instead.
    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    docker info 1>$null 2>$null
    $ErrorActionPreference = $prevPref
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
    # An existing container built from another image is the trap that hid the broken
    # plugin: the old script reused it and never noticed the image had changed.
    $currentImage = docker inspect $containerName --format "{{.Config.Image}}" 2>$null
    if ($currentImage -ne $image) {
        Write-Host "Existing container uses '$currentImage', expected '$image'. Recreating..." -ForegroundColor Yellow
        docker rm -f $containerName | Out-Null
        $existing = $null
    }
}

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
    Write-Host "Creating RabbitMQ container (AMQP 5672, UI 15672)..." -ForegroundColor Cyan
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
