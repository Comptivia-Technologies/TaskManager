# 📋 How to View Created Tasks

## Task ID from Your Request
- **TaskId**: `03a58a1b-426e-4b10-8ebf-eecbc53427f2`
- **CorrelationId**: `775681ab-a40e-4fb1-96fd-96750bf6fab5`

---

## Method 1: TaskService API (Recommended)

### Using Swagger UI:
1. Open: **http://localhost:5005/swagger**
2. Find the `GET /api/tasks/{id}` endpoint
3. Click "Try it out"
4. Enter task ID: `03a58a1b-426e-4b10-8ebf-eecbc53427f2`
5. Click "Execute"

### Using cURL or Browser:
```bash
# Direct URL
http://localhost:5005/api/tasks/03a58a1b-426e-4b10-8ebf-eecbc53427f2

# Using cURL
curl http://localhost:5005/api/tasks/03a58a1b-426e-4b10-8ebf-eecbc53427f2
```

### Using PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:5005/api/tasks/03a58a1b-426e-4b10-8ebf-eecbc53427f2" -Method Get
```

---

## Method 2: RabbitMQ Management UI

1. Open: **http://localhost:15672**
2. Login: `guest` / `guest`
3. Go to **"Queues"** tab
4. Check these queues for messages:
   - `task.created.queue` - TaskCreatedEvent
   - `workflow.selected.queue` - WorkflowSelectedEvent
   - `sla.configured.queue` - SLAConfiguredEvent
   - `task.assigned.queue` - TaskAssignedEvent
5. Click on a queue to see messages
6. Click "Get message(s)" to view event details

---

## Method 3: Check Service Logs

### TaskService Logs:
Look for log entries showing:
- Task creation
- Event processing
- Status updates

### Other Service Logs:
- **WorkflowService** (port 5006): Workflow selection
- **SLAManagerService** (port 5007): SLA configuration
- **WorkloadService** (port 5008): Task assignment

---

## Method 4: Direct Database Query

### Connect to PostgreSQL:
```bash
psql -h localhost -U postgres -d TaskService
```

### Query the Tasks table:
```sql
SELECT * FROM "Tasks" WHERE "TaskId" = '03a58a1b-426e-4b10-8ebf-eecbc53427f2';
```

### Check all tasks:
```sql
SELECT 
    "TaskId",
    "TaskName",
    "Status",
    "WorkflowId",
    "MemberId",
    "SLADeadline",
    "IsOverdue",
    "CreatedAt"
FROM "Tasks"
ORDER BY "CreatedAt" DESC;
```

---

## Expected Task Status Flow

After creation, the task should progress through these statuses:

1. **Created** → Initial state
2. **WorkflowSelected** → After WorkflowService processes TaskCreatedEvent
3. **SLAConfigured** → After SLAManagerService processes WorkflowSelectedEvent
4. **Assigned** → After WorkloadService processes SLAConfiguredEvent
5. **InProgress** → When member starts working
6. **Completed** → When task is finished
7. **Overdue** → If SLA deadline is breached

---

## Quick Test Commands

### Check if TaskService is running:
```powershell
Invoke-WebRequest -Uri "http://localhost:5005/swagger" -UseBasicParsing
```

### Get task details:
```powershell
$taskId = "03a58a1b-426e-4b10-8ebf-eecbc53427f2"
Invoke-RestMethod -Uri "http://localhost:5005/api/tasks/$taskId" -Method Get | ConvertTo-Json
```

### Check all services health:
```powershell
# API Gateway
Invoke-RestMethod -Uri "http://localhost:5004/api/tasks/health"

# TaskService (if health endpoint exists)
# Check Swagger UI instead
```

---

## Troubleshooting

### If task not found:
1. **Check TaskService is running** on port 5005
2. **Check RabbitMQ is running** (http://localhost:15672)
3. **Check service logs** for errors
4. **Verify event flow** in RabbitMQ queues

### If task status is stuck:
1. Check **WorkflowService** logs (port 5006)
2. Check **SLAManagerService** logs (port 5007)
3. Check **WorkloadService** logs (port 5008)
4. Verify events are being consumed from RabbitMQ queues

---

## Service Ports Reference

- **APIGateway**: http://localhost:5004
- **TaskService**: http://localhost:5005
- **WorkflowService**: http://localhost:5006
- **SLAManagerService**: http://localhost:5007
- **WorkloadService**: http://localhost:5008
- **RabbitMQ Management**: http://localhost:15672

