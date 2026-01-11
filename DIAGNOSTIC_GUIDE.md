# Microservices Diagnostic Guide

## Problem: Empty Queues, No Workflow Selection, No Member Assignment

If you're seeing:
- **0 queues in RabbitMQ Management UI**
- **Tasks created but WorkflowId, MemberId, SLA fields are null**
- **No workflow selection or member assignment happening**

This guide will help you diagnose and fix the issues.

---

## Step 1: Verify RabbitMQ is Running

### Check if RabbitMQ Container is Running

```powershell
docker ps
```

You should see a container named something like `rabbitmq` or `comptivia-rabbitmq` running on port `5672` and `15672`.

If not running, start it:
```powershell
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### Verify RabbitMQ is Accessible

Open browser: http://localhost:15672
- Username: `guest`
- Password: `guest`

If you can't access this, RabbitMQ is not running or not accessible.

---

## Step 2: Verify All Services Are Running

### Check Service Status

All these services must be running:
1. **APIGateway** (port 5004)
2. **TaskService** (port 5005)
3. **WorkflowService** (port 5006)
4. **SLAManagerService** (port 5007)
5. **WorkloadService** (port 5008)

### Check Service Logs

Look for these log messages in each service:

**TaskService should show:**
```
Successfully connected to RabbitMQ at localhost:5672
Started consuming from queue task.created.queue on exchange task.exchange
Started consuming from queue workflow.selected.queue on exchange workflow.exchange
```

**WorkflowService should show:**
```
Successfully connected to RabbitMQ at localhost:5672
Started consuming from queue task.created.queue on exchange task.exchange
```

**SLAManagerService should show:**
```
Successfully connected to RabbitMQ at localhost:5672
Started consuming from queue workflow.selected.queue on exchange workflow.exchange
```

**WorkloadService should show:**
```
Successfully connected to RabbitMQ at localhost:5672
Started consuming from queue sla.configured.queue on exchange sla.exchange
```

**If you see connection errors:**
```
Failed to connect to RabbitMQ at localhost:5672. Please ensure RabbitMQ is running.
```

This means RabbitMQ is not accessible. Check Step 1.

---

## Step 3: Verify Queues Are Created

After all services start successfully, check RabbitMQ Management UI:

1. Go to http://localhost:15672
2. Click on **"Queues and Streams"** tab
3. You should see these queues:
   - `task.created.queue`
   - `task.created.queue.dlq`
   - `workflow.selected.queue`
   - `workflow.selected.queue.dlq`
   - `sla.configured.queue`
   - `sla.configured.queue.dlq`
   - `task.assigned.queue`
   - `task.assigned.queue.dlq`
   - `task.overdue.queue`
   - `task.overdue.queue.dlq`

**If queues are missing:**
- Services aren't connecting to RabbitMQ
- Services are crashing before declaring queues
- Check service logs for errors

---

## Step 4: Test the Flow

### 1. Create a Task via API Gateway

```powershell
$body = @{
    TaskName = "Test Task"
    Description = "Test Description"
    Priority = "Critical"
    TaskType = "Bug"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" -Method POST -Body $body -ContentType "application/json"
```

### 2. Check TaskService Database

```sql
SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
```

The task should appear with:
- `Status = 0` (Created)
- `WorkflowId = NULL` (will be set by WorkflowService)
- `MemberId = NULL` (will be set by WorkloadService)

### 3. Check RabbitMQ Queues

In RabbitMQ Management UI, go to **"Queues and Streams"**:
- Click on `task.created.queue`
- Check **"Get messages"** section
- You should see messages being consumed (Ready: 0, Unacked: 0 means messages were processed)

### 4. Check WorkflowService Database

```sql
SELECT * FROM "WorkflowSelections" ORDER BY "CreatedAt" DESC LIMIT 1;
```

Should show a workflow selection for the task.

### 5. Check SLAManagerService Database

```sql
SELECT * FROM "SLAAssignments" ORDER BY "CreatedAt" DESC LIMIT 1;
```

Should show an SLA assignment with:
- `WorkflowSelectedEventId` populated
- `IsOverdue = false`

### 6. Check TaskService Database Again

```sql
SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
```

Should now show:
- `WorkflowId` populated
- `Status` updated (if workflow was selected)

### 7. Check WorkloadService

The WorkloadService should:
- Receive `SLAConfiguredEvent`
- Calculate workload for all members
- Assign task to best member
- Publish `TaskAssignedEvent`

### 8. Final Check - TaskService Database

```sql
SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
```

Should show:
- `MemberId` populated
- `Status` updated to assigned

---

## Common Issues and Solutions

### Issue 1: "Failed to connect to RabbitMQ"

**Solution:**
1. Ensure RabbitMQ Docker container is running: `docker ps`
2. If not running: `docker start rabbitmq` or start new container
3. Check firewall isn't blocking port 5672

### Issue 2: "0 queues in RabbitMQ"

**Solution:**
1. Services aren't starting consumers
2. Check service logs for connection errors
3. Restart all services after RabbitMQ is confirmed running
4. Services must successfully connect before queues are declared

### Issue 3: "Tasks created but WorkflowId is null"

**Solution:**
1. Check WorkflowService is running and consuming `TaskCreatedEvent`
2. Check WorkflowService logs for errors
3. Verify WorkflowService database has workflows
4. Check RabbitMQ - `task.created.queue` should have messages being consumed

### Issue 4: "WorkflowId set but MemberId is null"

**Solution:**
1. Check WorkloadService is running and consuming `SLAConfiguredEvent`
2. Check WorkloadService logs for errors
3. Verify there are members in the database
4. Check RabbitMQ - `sla.configured.queue` should have messages being consumed

### Issue 5: "SLAAssignment created but event IDs are null"

**Solution:**
1. This is expected if the event ID fields aren't being populated
2. Check SLAManagerService logs to see if it's processing events
3. The important fields are: `TaskId`, `WorkflowId`, `Priority`, `SLADeadline`

---

## Quick Restart Script

If services aren't working, restart everything:

```powershell
# Stop all services (Ctrl+C in each terminal)
# Then restart RabbitMQ
docker restart rabbitmq

# Wait 5 seconds
Start-Sleep -Seconds 5

# Restart all services using start-all.ps1
.\start-all.ps1
```

---

## Expected Event Flow

1. **API Gateway** publishes `TaskCreatedEvent` → `task.exchange` / `task.created`
2. **TaskService** consumes `TaskCreatedEvent` → Creates task in database
3. **WorkflowService** consumes `TaskCreatedEvent` → Selects workflow → Publishes `WorkflowSelectedEvent`
4. **TaskService** consumes `WorkflowSelectedEvent` → Updates task with WorkflowId
5. **SLAManagerService** consumes `WorkflowSelectedEvent` → Creates SLA → Publishes `SLAConfiguredEvent`
6. **WorkloadService** consumes `SLAConfiguredEvent` → Assigns member → Publishes `TaskAssignedEvent`
7. **TaskService** consumes `TaskAssignedEvent` → Updates task with MemberId

If any step fails, check the logs for that service.

