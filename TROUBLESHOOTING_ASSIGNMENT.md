# Troubleshooting Task Assignment Issues

## Problem
Tasks are not being assigned to members.

## Diagnostic Steps

### 1. Check WorkloadService Logs
Look for these log messages in the WorkloadService console:

**Expected Flow:**
```
info: Received SLAConfiguredEvent. TaskId: ..., WorkflowId: ..., CorrelationId: ...
info: Found workflow. WorkflowId: ..., WorkflowName: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
info: Filtering members by workflow team. Found X members. WorkflowId: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
info: Evaluating workload for X members. TaskId: ..., CorrelationId: ...
info: Selected best member. MemberId: ..., MemberName: ..., WorkloadScore: ..., Reason: ..., TaskId: ..., CorrelationId: ...
info: Task assigned to member. TaskId: ..., MemberId: ..., WorkloadScore: ..., CorrelationId: ...
```

**Common Issues:**

#### Issue 1: "Workflow not found"
```
error: Workflow not found. WorkflowId: ..., TaskId: ..., CorrelationId: ...
```
**Solution:** 
- Check if the workflow exists in the `Workflows` table in the `WorkflowManagement` database
- Verify the `WorkflowId` in the `SLAConfiguredEvent` matches an existing workflow
- Run: `SELECT * FROM "Workflows" WHERE "WorkflowId" = <WorkflowId>;`

#### Issue 2: "No members available"
```
error: No members available for task assignment. WorkflowId: ..., TeamId: ..., TaskId: ..., CorrelationId: ...
```
**Solution:**
- Check if members exist in the `Members` table
- If workflow has a `TeamId`, verify members belong to that team:
  ```sql
  SELECT * FROM "Members" WHERE "TeamId" = <TeamId>;
  ```
- If workflow has no `TeamId`, check all members:
  ```sql
  SELECT * FROM "Members";
  ```

#### Issue 3: "Workflow has no team assigned"
```
warn: Workflow has no team assigned, using all members. Found X members. WorkflowId: ..., TaskId: ..., CorrelationId: ...
```
**Solution:**
- This is a warning, not an error. The system will use all members.
- If you want team-based assignment, update the workflow to have a `TeamId`:
  ```sql
  UPDATE "Workflows" SET "TeamId" = <TeamId> WHERE "WorkflowId" = <WorkflowId>;
  ```

### 2. Check Database Tables

#### Check Workflows Table
```sql
-- Connect to WorkflowManagement database
SELECT "WorkflowId", "WorkflowName", "TeamId" FROM "Workflows";
```

#### Check Members Table
```sql
-- Connect to WorkflowManagement database
SELECT "MemberId", "FirstName", "LastName", "TeamId", "SkillLevel" FROM "Members";
```

#### Check TaskAssignments Table (WorkloadService database)
```sql
-- Connect to WorkflowManagement database (WorkloadService uses same DB)
SELECT * FROM "TaskAssignments";
```

### 3. Check TaskService Logs
After assignment, check TaskService logs for:
```
info: Task assigned to member. TaskId: ..., MemberId: ..., CorrelationId: ...
info: Task synced to WorkflowManagement.API. TaskId: ..., Response: ...
```

If you see:
```
warn: Task not found for TaskAssignedEvent. TaskId: ..., CorrelationId: ...
```
**Solution:** The task was not created in TaskService. Check TaskService logs for `TaskCreatedEvent` processing.

### 4. Verify RabbitMQ Events

Check if `TaskAssignedEvent` is being published:
- Look for the log message: `"Task assigned to member. TaskId: ..., MemberId: ..., WorkloadScore: ..., CorrelationId: ..."` in WorkloadService
- Check TaskService logs for `TaskAssignedEvent` consumption

### 5. Quick Test Query

Run this query to verify your setup:
```sql
-- Check workflow and its team
SELECT w."WorkflowId", w."WorkflowName", w."TeamId", 
       COUNT(m."MemberId") as "MemberCount"
FROM "Workflows" w
LEFT JOIN "Members" m ON w."TeamId" = m."TeamId"
WHERE w."WorkflowId" = <YourWorkflowId>
GROUP BY w."WorkflowId", w."WorkflowName", w."TeamId";
```

This will show:
- If the workflow exists
- If it has a TeamId
- How many members are in that team

## Common Fixes

### Fix 1: Assign TeamId to Workflow
If your workflow doesn't have a TeamId:
```sql
UPDATE "Workflows" 
SET "TeamId" = <TeamId> 
WHERE "WorkflowId" = <WorkflowId>;
```

### Fix 2: Create Members
If no members exist:
```sql
INSERT INTO "Members" ("FirstName", "LastName", "Email", "TeamId", "SkillLevel", "Role")
VALUES ('John', 'Doe', 'john.doe@example.com', <TeamId>, 3, 'Developer');
```

### Fix 3: Verify WorkflowService is Publishing WorkflowSelectedEvent
Check WorkflowService logs for:
```
info: Workflow selected. TaskId: ..., WorkflowId: ..., WorkflowName: ..., CorrelationId: ...
```

## Next Steps

After checking the logs:
1. Identify which step is failing (workflow lookup, member lookup, assignment, event publishing)
2. Fix the underlying issue (missing data, incorrect configuration, etc.)
3. Restart the affected service(s)
4. Test again with a new task

