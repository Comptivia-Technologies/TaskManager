# Task Database Diagnostic Guide

## Problem
Workflow details, member details, and SLA details are not showing in the TaskService database.

## Expected Flow

When a task is created, these events should update the task in sequence:

1. **TaskCreatedEvent** → Creates task with basic info (TaskName, Description, Priority, TaskType)
2. **WorkflowSelectedEvent** → Updates task with `WorkflowId`
3. **SLAConfiguredEvent** → Updates task with `SLAStartTime`, `SLADeadline`
4. **TaskAssignedEvent** → Updates task with `MemberId` and sets status to `Assigned`

## Diagnostic Steps

### Step 1: Check TaskService Logs

After creating a task, check TaskService console for these log messages:

#### ✅ Expected Success Flow:
```
info: Task created from TaskCreatedEvent. TaskId: ..., CorrelationId: ...
info: Task workflow assigned. TaskId: ..., WorkflowId: ..., WorkflowName: ..., CorrelationId: ... Task updated in database.
info: Task SLA configured. TaskId: ..., WorkflowId: ..., Priority: ..., ResponseTimeMinutes: ..., Deadline: ..., StartTime: ..., CorrelationId: ... Task updated in database.
info: Task assigned to member. TaskId: ..., MemberId: ..., MemberName: ..., WorkloadScore: ..., CorrelationId: ... Task updated in database.
info: Task synced to WorkflowManagement.API. TaskId: ..., Response: ...
```

#### ❌ Common Error Patterns:

**Error 1: Task not found**
```
warn: Task not found for WorkflowSelectedEvent. TaskId: ..., CorrelationId: ...
warn: Task not found for SLAConfiguredEvent. TaskId: ..., CorrelationId: ...
warn: Task not found for TaskAssignedEvent. TaskId: ..., CorrelationId: ...
```
**Solution:** 
- Check if TaskCreatedEvent was processed: Look for `"Task created from TaskCreatedEvent"`
- Verify TaskService is consuming TaskCreatedEvent from RabbitMQ
- Check if task exists: `SELECT * FROM "Tasks" WHERE "TaskId" = '<TaskId>';`

**Error 2: Event already processed**
```
warn: WorkflowSelectedEvent already processed. TaskId: ..., CorrelationId: ...
warn: SLAConfiguredEvent already processed. TaskId: ..., CorrelationId: ...
warn: TaskAssignedEvent already processed. TaskId: ..., CorrelationId: ...
```
**Solution:** 
- This means the event was processed before, but the update might have failed
- Check the database to see if the fields are actually set
- If fields are NULL, the update failed silently

**Error 3: No log messages at all**
- TaskService is not receiving events from RabbitMQ
- Check RabbitMQ connection
- Verify TaskService is subscribed to the correct queues

### Step 2: Verify Database State

Run these SQL queries in PostgreSQL (TaskService database):

```sql
-- 1. Check if task exists and its current state
SELECT 
    "TaskId", 
    "TaskName", 
    "Status", 
    "WorkflowId", 
    "MemberId", 
    "SLAConfigurationId",
    "SLADeadline", 
    "SLAStartTime", 
    "IsOverdue",
    "WorkflowSelectedEventId",
    "SLAConfiguredEventId",
    "TaskAssignedEventId",
    "CreatedAt", 
    "UpdatedAt" 
FROM "Tasks" 
ORDER BY "CreatedAt" DESC 
LIMIT 5;

-- 2. Check a specific task (replace with your TaskId)
SELECT * FROM "Tasks" WHERE "TaskId" = '<YourTaskId>';
```

**Expected values after full flow:**
- `WorkflowId`: Should be set (integer, e.g., 9)
- `MemberId`: Should be set (integer, e.g., 1)
- `SLADeadline`: Should be set (timestamp, e.g., '2024-01-15 10:30:00')
- `SLAStartTime`: Should be set (timestamp, e.g., '2024-01-15 10:00:00')
- `Status`: Should be `4` (Assigned enum value)
- `WorkflowSelectedEventId`: Should be set (UUID)
- `SLAConfiguredEventId`: Should be set (UUID)
- `TaskAssignedEventId`: Should be set (UUID)

### Step 3: Check Event Processing Order

The events must be processed in order. Check TaskService logs to see the sequence:

1. TaskCreatedEvent should be first
2. WorkflowSelectedEvent should be second
3. SLAConfiguredEvent should be third
4. TaskAssignedEvent should be last

If events are out of order or missing, check:
- RabbitMQ queue status
- Service startup order
- Event publishing from other services

### Step 4: Verify RabbitMQ Events

Check if events are being published and consumed:

1. **WorkflowService** should publish `WorkflowSelectedEvent`
2. **SLAManagerService** should publish `SLAConfiguredEvent`
3. **WorkloadService** should publish `TaskAssignedEvent`
4. **TaskService** should consume all of these

Check each service's logs for:
- `"Published event..."` messages
- `"Received event..."` messages
- Any RabbitMQ connection errors

## Common Fixes

### Fix 1: Task Not Created
If `TaskCreatedEvent` is not being processed:
- Verify TaskService is subscribed to `task.created.queue`
- Check TaskService Program.cs for consumer registration
- Restart TaskService

### Fix 2: Events Not Received
If events are published but not received:
- Check RabbitMQ is running: `docker ps` (should show rabbitmq container)
- Verify queue names match in all services
- Check for RabbitMQ connection errors in logs

### Fix 3: Updates Not Persisted
If logs show updates but database is empty:
- Check database connection string in `appsettings.json`
- Verify database permissions
- Check for transaction rollbacks in logs
- Verify `SaveChangesAsync()` is being called

### Fix 4: Idempotency Blocking Updates
If events show "already processed" but fields are NULL:
- The event was processed but update failed
- Check for exceptions in the event handler
- Manually update the task to test:
  ```sql
  UPDATE "Tasks" 
  SET "WorkflowId" = 9, 
      "MemberId" = 1, 
      "SLADeadline" = NOW() + INTERVAL '1 hour',
      "SLAStartTime" = NOW()
  WHERE "TaskId" = '<YourTaskId>';
  ```

## Quick Test

1. Create a new task:
   ```powershell
   $body = @{ TaskName = "Test Task"; Description = "Test"; Priority = "High"; TaskType = "AIMS" } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" -Method Post -Body $body -ContentType "application/json"
   ```

2. Immediately check TaskService logs for all 4 event processing messages

3. Wait 2-3 seconds, then check database:
   ```sql
   SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
   ```

4. Verify all fields are populated

## Next Steps

After running diagnostics:
1. Identify which event is missing or failing
2. Check the corresponding service logs
3. Fix the issue (connection, configuration, code)
4. Restart affected services
5. Test again

