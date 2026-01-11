# Task Assignment Debugging Guide

## Problem
Workflow selection works correctly, but members from the workflow's team are not being assigned tasks based on workload.

## Diagnostic Steps

### Step 1: Check WorkloadService Logs

After creating a task, check the WorkloadService console for these log messages in order:

#### ✅ Expected Success Flow:
```
info: Received SLAConfiguredEvent. TaskId: ..., WorkflowId: ..., CorrelationId: ...
info: Found workflow. WorkflowId: ..., WorkflowName: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
info: Filtering members by workflow team. Found X members. WorkflowId: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
info: Evaluating workload for X members. TaskId: ..., CorrelationId: ...
info: Evaluated member. MemberId: ..., MemberName: ..., TaskCount: ..., WorkloadScore: ..., TaskId: ..., CorrelationId: ...
info: Selected best member. MemberId: ..., MemberName: ..., WorkloadScore: ..., Reason: ..., TaskId: ..., CorrelationId: ...
info: Task assigned to member. TaskId: ..., MemberId: ..., WorkloadScore: ..., CorrelationId: ...
```

#### ❌ Common Error Patterns:

**Error 1: Workflow not found**
```
error: Workflow not found. WorkflowId: ..., TaskId: ..., CorrelationId: ...
```
**Solution:** 
- Verify the workflow exists: `SELECT * FROM "Workflows" WHERE "WorkflowId" = <WorkflowId>;`
- Check if WorkflowService is reading from the same database

**Error 2: No members found**
```
error: No members available for task assignment. WorkflowId: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
```
**Solution:**
- Check if members exist for the team: `SELECT * FROM "Members" WHERE "TeamId" = <TeamId>;`
- Verify the workflow has a TeamId: `SELECT "WorkflowId", "WorkflowName", "TeamId" FROM "Workflows" WHERE "WorkflowId" = <WorkflowId>;`

**Error 3: No member scores calculated**
```
error: No member scores calculated. All members failed evaluation. TaskId: ..., CorrelationId: ...
```
**Solution:**
- Check for exceptions in the evaluation loop
- Verify the Tasks table is accessible: `SELECT COUNT(*) FROM "Tasks";`

**Error 4: Error evaluating workload**
```
error: Error evaluating workload for member. MemberId: ..., MemberName: ..., TaskId: ..., CorrelationId: ...
```
**Solution:**
- Check the exception details in the logs
- Verify database connection and table access

### Step 2: Verify Database State

Run these SQL queries in PostgreSQL (WorkflowManagement database):

```sql
-- 1. Check workflow and its team
SELECT "WorkflowId", "WorkflowName", "TeamId" 
FROM "Workflows" 
WHERE "WorkflowName" LIKE '%AIMS%';

-- 2. Check members in that team (replace <TeamId> with actual TeamId from step 1)
SELECT "MemberId", "FirstName", "LastName", "TeamId", "SkillLevel" 
FROM "Members" 
WHERE "TeamId" = <TeamId>;

-- 3. Check if TaskAssignments were created (WorkloadService database)
SELECT * FROM "TaskAssignments" 
ORDER BY "AssignedAt" DESC 
LIMIT 5;

-- 4. Check Tasks table for member assignments
SELECT "TaskId", "TaskName", "Status", "AssignedToMemberId", "WorkflowId" 
FROM "Tasks" 
WHERE "AssignedToMemberId" IS NOT NULL 
ORDER BY "CreatedAt" DESC 
LIMIT 5;
```

### Step 3: Check TaskService Logs

After WorkloadService publishes `TaskAssignedEvent`, check TaskService logs:

```
info: Task assigned to member. TaskId: ..., MemberId: ..., CorrelationId: ...
info: Task synced to WorkflowManagement.API. TaskId: ..., Response: ...
```

If you see:
```
warn: Task not found for TaskAssignedEvent. TaskId: ..., CorrelationId: ...
```
**Solution:** The task was not created in TaskService. Check TaskService logs for `TaskCreatedEvent` processing.

### Step 4: Verify RabbitMQ Events

Check if `TaskAssignedEvent` is being published:
- Look for the log: `"Task assigned to member. TaskId: ..., MemberId: ..., WorkloadScore: ..., CorrelationId: ..."` in WorkloadService
- Check TaskService logs for `TaskAssignedEvent` consumption

### Step 5: Check Frontend

If TaskService successfully syncs to WorkflowManagement.API, the task should appear in the frontend:
- Task should have `AssignedToMemberId` set
- Task should show the assigned member's name

## Common Fixes

### Fix 1: Assign TeamId to Workflow
If your workflow doesn't have a TeamId:
```sql
UPDATE "Workflows" 
SET "TeamId" = <TeamId> 
WHERE "WorkflowId" = <WorkflowId>;
```

### Fix 2: Create Members for the Team
If no members exist:
```sql
INSERT INTO "Members" ("FirstName", "LastName", "Email", "TeamId", "SkillLevel", "Role", "CreatedAt", "UpdatedAt")
VALUES ('John', 'Doe', 'john.doe@example.com', <TeamId>, 3, 'Developer', NOW(), NOW());
```

### Fix 3: Verify Database Connection
Check `appsettings.json` in WorkloadService:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=yourpassword"
  }
}
```

### Fix 4: Restart WorkloadService
After making changes:
1. Stop WorkloadService (Ctrl+C)
2. Rebuild: `cd backend\WorkloadService && dotnet build`
3. Restart: `dotnet run`

## Quick Test

Run this to create a test task:
```powershell
$body = @{ 
    TaskName = "Test AIMS Task"; 
    Description = "Test task for AIMS workflow"; 
    Priority = "High"; 
    TaskType = "AIMS" 
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" -Method Post -Body $body -ContentType "application/json"
```

Then immediately check WorkloadService logs for the diagnostic messages above.

