# 🚀 How to Run the Microservices Architecture

## Prerequisites

1. **PostgreSQL** - Must be running
2. **RabbitMQ** - Required for event-driven microservices
3. **.NET 8.0 SDK** - For building and running services

## Step 1: Start RabbitMQ

Open a terminal and run:

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

**Verify RabbitMQ is running:**
- Management UI: http://localhost:15672
- Username: `guest`
- Password: `guest`

## Step 2: Verify Database Connection

Ensure PostgreSQL is running and accessible with:
- Host: `localhost`
- Port: `5432`
- Username: `postgres`
- Password: `postgres` (or your password)

**Required Databases:**
- `WorkflowManagement` (already exists - used by existing APIs)
- `TaskService` (will be created automatically by TaskService)

## Step 3: Build Shared Libraries First

Open a terminal and build the shared projects:

```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\Shared\Shared.Contracts"
dotnet build

cd ..\Shared.Messaging
dotnet build
```

## Step 4: Start Services

You'll need **8 terminals** (or use a process manager). Here's the order:

### Terminal 1: Existing APIs - SLAConfiguration.API
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\SLAConfiguration.API"
dotnet run
```
**Port:** 5001  
**Status:** ✅ Keep running (frontend uses this)

---

### Terminal 2: Existing APIs - WorkflowManagement.API
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\WorkflowManagement.API"
dotnet run
```
**Port:** 5000  
**Status:** ✅ Keep running (frontend uses this)

---

### Terminal 3: Existing APIs - Workload.API
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\Workload.API"
dotnet run
```
**Port:** 5003  
**Status:** ✅ Keep running (frontend uses this)

---

### Terminal 4: New Microservice - APIGateway
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\APIGateway"
dotnet run
```
**Port:** 5004  
**Status:** 🆕 Entry point for orchestration flow

---

### Terminal 5: New Microservice - TaskService
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\TaskService"
dotnet run
```
**Port:** 5005  
**Status:** 🆕 Manages task lifecycle via events

---

### Terminal 6: New Microservice - WorkflowService
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\WorkflowService"
dotnet run
```
**Port:** 5006  
**Status:** 🆕 Auto-selects workflow for tasks

---

### Terminal 7: New Microservice - SLAManagerService
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\SLAManagerService"
dotnet run
```
**Port:** 5007  
**Status:** 🆕 Auto-configures SLA and monitors deadlines

---

### Terminal 8: New Microservice - WorkloadService
```bash
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\WorkloadService"
dotnet run
```
**Port:** 5008  
**Status:** 🆕 Auto-assigns tasks to best members

---

## Step 5: Verify Services Are Running

### Check Existing APIs:
- ✅ http://localhost:5000/swagger (WorkflowManagement.API)
- ✅ http://localhost:5001/swagger (SLAConfiguration.API)
- ✅ http://localhost:5003/swagger (Workload.API)

### Check New Microservices:
- 🆕 http://localhost:5004/swagger (APIGateway)
- 🆕 http://localhost:5005/swagger (TaskService)
- 🆕 http://localhost:5006/swagger (WorkflowService)
- 🆕 http://localhost:5007/swagger (SLAManagerService)
- 🆕 http://localhost:5008/swagger (WorkloadService)

### Check RabbitMQ:
- 🐇 http://localhost:15672 (Management UI)

## Step 6: Test the Orchestration Flow

### Option A: Using cURL

```bash
curl -X POST http://localhost:5004/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Fix critical bug",
    "description": "Fix authentication issue",
    "priority": "Critical",
    "taskType": "Bug"
  }'
```

**Expected Response:**
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "correlationId": "123e4567-e89b-12d3-a456-426614174001",
  "message": "Task creation initiated. Processing asynchronously."
}
```

### Option B: Using Postman

1. **Method:** POST
2. **URL:** `http://localhost:5004/api/tasks`
3. **Headers:** `Content-Type: application/json`
4. **Body:**
```json
{
  "taskName": "Fix critical bug",
  "description": "Fix authentication issue",
  "priority": "Critical",
  "taskType": "Bug"
}
```

## Step 7: Monitor the Flow

### 1. Check RabbitMQ Queues
- Go to http://localhost:15672
- Login: `guest` / `guest`
- Navigate to **Queues** tab
- You should see:
  - `task.created.queue`
  - `workflow.selected.queue`
  - `sla.configured.queue`
  - `task.assigned.queue`

### 2. Check Task Status
```bash
# Replace {taskId} with the taskId from the response
curl http://localhost:5005/api/tasks/{taskId}
```

**Expected Status Progression:**
1. `Created` → Task created
2. `WorkflowSelected` → Workflow assigned
3. `SLAConfigured` → SLA configured
4. `Assigned` → Member assigned

### 3. Check Service Logs
Watch each terminal for log messages showing:
- Event publishing
- Event consumption
- Task status updates
- CorrelationId tracking

## 🎯 Quick Start Script (PowerShell)

Save this as `start-all.ps1`:

```powershell
# Start RabbitMQ
Write-Host "Starting RabbitMQ..." -ForegroundColor Green
docker start rabbitmq 2>$null
if ($LASTEXITCODE -ne 0) {
    docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
}

# Build shared libraries
Write-Host "Building shared libraries..." -ForegroundColor Green
cd "backend\Shared\Shared.Contracts"
dotnet build | Out-Null
cd "..\Shared.Messaging"
dotnet build | Out-Null
cd "..\..\.."

# Start services in background
Write-Host "Starting services..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\SLAConfiguration.API'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\WorkflowManagement.API'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\Workload.API'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\APIGateway'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\TaskService'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\WorkflowService'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\SLAManagerService'; dotnet run" -WindowStyle Minimized
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'backend\WorkloadService'; dotnet run" -WindowStyle Minimized

Write-Host "All services starting..." -ForegroundColor Green
Write-Host "Check RabbitMQ: http://localhost:15672" -ForegroundColor Yellow
Write-Host "Check Swagger UIs for each service" -ForegroundColor Yellow
```

**Run it:**
```powershell
.\start-all.ps1
```

## 🐛 Troubleshooting

### Issue: RabbitMQ Connection Failed
**Solution:**
```bash
# Check if RabbitMQ is running
docker ps | grep rabbitmq

# If not running, start it
docker start rabbitmq

# Or recreate it
docker rm rabbitmq
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### Issue: Database Connection Failed
**Solution:**
- Verify PostgreSQL is running
- Check connection strings in `appsettings.json`
- Ensure databases exist (TaskService will create its own)

### Issue: Port Already in Use
**Solution:**
- Check which process is using the port:
  ```powershell
  netstat -ano | findstr :5000
  ```
- Kill the process or change the port in `appsettings.json` or `launchSettings.json`

### Issue: Build Errors
**Solution:**
```bash
# Clean and rebuild
dotnet clean
dotnet restore
dotnet build
```

### Issue: Events Not Processing
**Solution:**
1. Check RabbitMQ queues in management UI
2. Verify consumers are started (check service logs)
3. Check for errors in service logs
4. Verify all services are running

## 📊 Service Status Checklist

- [ ] RabbitMQ running (http://localhost:15672)
- [ ] PostgreSQL running
- [ ] SLAConfiguration.API (Port 5001)
- [ ] WorkflowManagement.API (Port 5000)
- [ ] Workload.API (Port 5003)
- [ ] APIGateway (Port 5004)
- [ ] TaskService (Port 5005)
- [ ] WorkflowService (Port 5006)
- [ ] SLAManagerService (Port 5007)
- [ ] WorkloadService (Port 5008)

## 🎉 Success Indicators

When everything is working, you should see:

1. **All services start without errors**
2. **RabbitMQ shows queues created**
3. **Creating a task via API Gateway triggers the full flow**
4. **Task status progresses through: Created → WorkflowSelected → SLAConfigured → Assigned**
5. **Logs show CorrelationId flowing through all services**

## 📝 Next Steps

1. **Test the orchestration flow** with a sample task
2. **Monitor RabbitMQ** to see events flowing
3. **Check task status** in TaskService
4. **Integrate with frontend** (optional - add API Gateway endpoint to frontend)

---

**Need Help?** Check the logs in each terminal for detailed error messages.

