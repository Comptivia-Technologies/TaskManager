# Troubleshooting Guide - Microservices Event Flow

## Problem: Empty Queues, No Event Processing

### Symptoms
- RabbitMQ Management UI shows 0 queues
- Task created but WorkflowId, MemberId, SLA fields are null
- Events not flowing through the system

### Root Causes

#### 1. Services Not Running
**Check:** Run `check-services.ps1` or manually verify:
```powershell
# Check if services are listening on ports
Test-NetConnection localhost -Port 5004  # API Gateway
Test-NetConnection localhost -Port 5005  # TaskService
Test-NetConnection localhost -Port 5006  # WorkflowService
Test-NetConnection localhost -Port 5007  # SLAManagerService
Test-NetConnection localhost -Port 5008  # WorkloadService
```

**Solution:** Start all services using `start-all.ps1`

#### 2. RabbitMQ Not Running
**Check:**
```powershell
docker ps --filter "name=rabbitmq"
```

**Solution:**
```powershell
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

#### 3. Services Can't Connect to RabbitMQ
**Check:** Look for connection errors in service logs:
- "Failed to connect to RabbitMQ"
- "Connection refused"
- "Authentication failed"

**Solution:** 
- Verify RabbitMQ is running
- Check `appsettings.json` in each service for correct RabbitMQ connection string
- Default: `HostName=localhost`, `Port=5672`, `UserName=guest`, `Password=guest`

#### 4. Queues Not Created
**Why:** Queues are created when `StartConsuming` is called. If queues don't exist, consumers aren't starting.

**Check:** 
- Verify services are calling `StartConsuming` in `Program.cs`
- Check for exceptions during consumer startup in logs

**Solution:** Restart services after ensuring RabbitMQ is running

#### 5. Event Flow Broken
**Expected Flow:**
1. API Gateway → Publishes `TaskCreatedEvent`
2. TaskService → Consumes `TaskCreatedEvent`, creates task
3. WorkflowService → Consumes `TaskCreatedEvent`, selects workflow, publishes `WorkflowSelectedEvent`
4. SLAManagerService → Consumes `WorkflowSelectedEvent`, configures SLA, publishes `SLAConfiguredEvent`
5. WorkloadService → Consumes `SLAConfiguredEvent`, assigns task, publishes `TaskAssignedEvent`
6. TaskService → Consumes `TaskAssignedEvent`, updates task with MemberId

**Check Each Step:**
- Check TaskService logs for "Task created from TaskCreatedEvent"
- Check WorkflowService logs for "Workflow selected for task"
- Check SLAManagerService logs for "SLA configured for task"
- Check WorkloadService logs for "Task assigned to member"

#### 6. No Workflows in Database
**Check:**
```sql
SELECT * FROM "Workflows" LIMIT 10;
```

**Solution:** Create workflows using the WorkflowManagement.API or frontend

#### 7. No SLA Configuration
**Check:**
```sql
SELECT * FROM "SLAConfigurations" LIMIT 10;
```

**Solution:** Create SLA configurations for workflows

#### 8. No Members in Database
**Check:**
```sql
SELECT * FROM "Members" LIMIT 10;
```

**Solution:** Create members using the WorkflowManagement.API or frontend

## Step-by-Step Fix

### Step 1: Verify RabbitMQ
```powershell
# Check if RabbitMQ is running
docker ps --filter "name=rabbitmq"

# If not running, start it
docker start rabbitmq

# Or create new container
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### Step 2: Verify All Services Are Running
```powershell
# Run diagnostic script
.\check-services.ps1

# Or manually check ports
Test-NetConnection localhost -Port 5004
Test-NetConnection localhost -Port 5005
Test-NetConnection localhost -Port 5006
Test-NetConnection localhost -Port 5007
Test-NetConnection localhost -Port 5008
```

### Step 3: Restart All Services
```powershell
# Stop all running services (Ctrl+C in each terminal)
# Then restart using start-all.ps1
.\start-all.ps1
```

### Step 4: Verify Queues Are Created
1. Open RabbitMQ Management UI: http://localhost:15672
2. Login: `guest` / `guest`
3. Go to "Queues" tab
4. You should see:
   - `task.created.queue`
   - `workflow.selected.queue`
   - `sla.configured.queue`
   - `task.assigned.queue`
   - `task.overdue.queue`
   - Plus their DLQ versions

### Step 5: Create a Test Task
```powershell
# Via PowerShell
$body = @{
    taskName = "Test Task"
    description = "Test Description"
    priority = "Critical"
    taskType = "Bug"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" -Method POST -Body $body -ContentType "application/json"
```

### Step 6: Monitor Event Flow
1. Check RabbitMQ Management UI → Queues → Click on a queue → See messages
2. Check service logs for event processing
3. Check database tables:
   - `Tasks` table in TaskService database
   - `WorkflowSelections` table in WorkflowService database
   - `SLAAssignments` table in SLAManagerService database
   - `TaskAssignments` table in WorkloadService database

## Common Error Messages

### "Connection refused"
- RabbitMQ is not running
- Wrong port in connection string

### "Authentication failed"
- Wrong username/password in `appsettings.json`

### "No workflows available"
- No workflows in `Workflows` table
- WorkflowService can't connect to database

### "No SLA configuration found"
- No SLA configurations in `SLAConfigurations` table
- SLA configuration doesn't match workflow

### "No members available"
- No members in `Members` table
- WorkloadService can't connect to database

## Verification Checklist

- [ ] RabbitMQ is running and accessible
- [ ] All 5 services are running (API Gateway, TaskService, WorkflowService, SLAManagerService, WorkloadService)
- [ ] All services can connect to RabbitMQ (check logs)
- [ ] Queues are created in RabbitMQ Management UI
- [ ] At least 1 workflow exists in `Workflows` table
- [ ] At least 1 SLA configuration exists in `SLAConfigurations` table
- [ ] At least 1 member exists in `Members` table
- [ ] TaskService has `TaskCreatedEventHandler` registered
- [ ] All event handlers are registered in respective `Program.cs` files

## Still Not Working?

1. **Check service logs** for detailed error messages
2. **Verify database connections** - each service should connect to its database
3. **Check RabbitMQ connection strings** in all `appsettings.json` files
4. **Ensure TaskService was rebuilt** with the new `TaskCreatedEventHandler`
5. **Restart all services** after making configuration changes

