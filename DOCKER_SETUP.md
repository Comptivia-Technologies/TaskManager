# Docker Setup Guide for RabbitMQ

## Option 1: Install Docker Desktop (Recommended)

### Step 1: Download Docker Desktop

1. Go to: https://www.docker.com/products/docker-desktop/
2. Click **"Download for Windows"**
3. Download the installer (`Docker Desktop Installer.exe`)

### Step 2: Install Docker Desktop

1. Run the installer
2. Follow the installation wizard
3. **Important**: Check "Use WSL 2 instead of Hyper-V" (if available)
4. Restart your computer when prompted

### Step 3: Start Docker Desktop

1. After restart, open **Docker Desktop** from Start Menu
2. Wait for Docker to start (whale icon in system tray)
3. You'll see "Docker Desktop is running" when ready

### Step 4: Verify Installation

Open PowerShell and run:
```powershell
docker --version
```

You should see something like:
```
Docker version 24.0.0, build abc123
```

### Step 5: Start RabbitMQ

Once Docker is running, execute:
```powershell
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**Verify RabbitMQ is running:**
```powershell
docker ps
```

You should see the `rabbitmq` container in the list.

**Access RabbitMQ Management UI:**
- URL: http://localhost:15672
- Username: `guest`
- Password: `guest`

---

## Option 2: Install RabbitMQ Directly on Windows (Alternative)

If you don't want to install Docker, you can install RabbitMQ directly on Windows:

### Step 1: Install Erlang

1. Download Erlang from: https://www.erlang.org/downloads
2. Download **Windows Installer** (64-bit)
3. Run the installer
4. Follow the installation wizard
5. Restart your computer

### Step 2: Install RabbitMQ

1. Download RabbitMQ from: https://www.rabbitmq.com/download.html
2. Download **Windows Installer** (`.exe` file)
3. Run the installer
4. Follow the installation wizard
5. RabbitMQ will be installed as a Windows service

### Step 3: Enable Management Plugin

Open PowerShell as Administrator and run:
```powershell
cd "C:\Program Files\RabbitMQ Server\rabbitmq_server-3.x.x\sbin"
.\rabbitmq-plugins enable rabbitmq_management
```

### Step 4: Start RabbitMQ Service

```powershell
# Start the service
Start-Service RabbitMQ

# Or use RabbitMQ service manager
net start RabbitMQ
```

### Step 5: Verify Installation

- Management UI: http://localhost:15672
- Username: `guest`
- Password: `guest`

---

## Option 3: Use RabbitMQ Cloud (Free Tier)

If you don't want to install anything locally:

1. Sign up at: https://www.cloudamqp.com/ (free tier available)
2. Create a free instance
3. Get connection details
4. Update `appsettings.json` in all microservices with cloud connection string

**Update connection strings:**
```json
{
  "RabbitMQ": {
    "HostName": "your-cloud-instance.rmq.cloudamqp.com",
    "Port": 5672,
    "UserName": "your-username",
    "Password": "your-password",
    "VirtualHost": "your-vhost"
  }
}
```

---

## Quick Test After Installation

### If using Docker:

```powershell
# Check Docker is running
docker ps

# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Check RabbitMQ is running
docker ps | Select-String rabbitmq

# Access Management UI
Start-Process "http://localhost:15672"
```

### If using Windows installation:

```powershell
# Check RabbitMQ service
Get-Service RabbitMQ

# Start service if not running
Start-Service RabbitMQ

# Access Management UI
Start-Process "http://localhost:15672"
```

---

## Troubleshooting

### Docker Issues:

**Problem:** "Docker daemon is not running"
- **Solution:** Open Docker Desktop and wait for it to start

**Problem:** "Port 5672 already in use"
- **Solution:** 
  ```powershell
  # Find what's using the port
  netstat -ano | findstr :5672
  
  # Stop RabbitMQ container
  docker stop rabbitmq
  docker rm rabbitmq
  
  # Start again
  docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
  ```

**Problem:** "WSL 2 installation is incomplete"
- **Solution:** 
  1. Install WSL 2: https://docs.microsoft.com/en-us/windows/wsl/install
  2. Or use Hyper-V instead (uncheck WSL 2 option during Docker installation)

### RabbitMQ Windows Installation Issues:

**Problem:** "RabbitMQ service won't start"
- **Solution:** Check Windows Event Viewer for errors
- Verify Erlang is installed correctly
- Run RabbitMQ service as Administrator

**Problem:** "Management plugin not accessible"
- **Solution:** 
  ```powershell
  cd "C:\Program Files\RabbitMQ Server\rabbitmq_server-*\sbin"
  .\rabbitmq-plugins enable rabbitmq_management
  .\rabbitmq-server restart
  ```

---

## Recommendation

**For Development:** Use **Docker Desktop** (Option 1)
- ✅ Easy to set up
- ✅ Easy to remove/restart
- ✅ Isolated from system
- ✅ Works on any OS

**For Production:** Use **Windows Service** (Option 2) or **Cloud** (Option 3)

---

## Next Steps

Once RabbitMQ is running:

1. **Verify it's accessible:**
   - Open: http://localhost:15672
   - Login: `guest` / `guest`

2. **Run the start script:**
   ```powershell
   .\start-all.ps1
   ```

3. **Or start services manually** (see `RUN_INSTRUCTIONS.md`)

---

## Quick Reference

### Docker Commands:
```powershell
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Stop RabbitMQ
docker stop rabbitmq

# Start existing RabbitMQ container
docker start rabbitmq

# Remove RabbitMQ container
docker rm rabbitmq

# View logs
docker logs rabbitmq

# List running containers
docker ps
```

### Windows Service Commands:
```powershell
# Start service
Start-Service RabbitMQ

# Stop service
Stop-Service RabbitMQ

# Check status
Get-Service RabbitMQ
```

