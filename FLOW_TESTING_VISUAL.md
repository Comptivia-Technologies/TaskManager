# Visual Flow Testing Guide - What Happens When a Task Comes In

## 🎯 Quick Overview

When you create a task via API Gateway, here's **exactly** what happens step-by-step:

---

## 📥 Step 1: Create Task (You Do This)

```bash
POST http://localhost:5004/api/tasks
{
  "taskName": "Fix ERP Bug",
  "taskType": "ERP",
  "priority": "Critical",
  "description": "Fix authentication issue"
}
```

**Response (Immediate):**
```json
{
  "taskId": "abc123-def456-...",
  "correlationId": "xyz789-...",
  "message": "Task creation initiated. Processing asynchronously."
}
```

---

## 🔄 What Happens Behind the Scenes (Automatic)

### **Event 1: TaskCreatedEvent Published** ⚡

**Who:** API Gateway  
**Action:** Publishes `TaskCreatedEvent` to RabbitMQ  
**Queue:** `task.created.queue`

**Event Content:**
```json
{
  "taskId": "abc123-def456-...",
  "taskName": "Fix ERP Bug",
  "taskType": "ERP",
  "priority": "Critical",
  "description": "Fix authentication issue",
  "createdAt": "2024-01-15T10:00:00Z",
  "correlationId": "xyz789-..."
}
```

**Log Message:**
```
[API Gateway] Task creation initiated via API Gateway. TaskId: abc123..., CorrelationId: xyz789...
```

---

### **Event 2: TaskService Consumes TaskCreatedEvent** 📝

**Who:** TaskService  
**Action:** Creates task in TaskService database  
**Status:** `Created` (0)

**Database Record Created:**
```sql
INSERT INTO "Tasks" (
  "TaskId", "TaskName", "Description", "Priority", "TaskType", 
  "Status", "CreatedAt", "WorkflowId", "MemberId"
) VALUES (
  'abc123...', 'Fix ERP Bug', 'Fix authentication issue', 
  'Critical', 'ERP', 0, '2024-01-15 10:00:00', NULL, NULL
);
```

**Log Message:**
```
[TaskService] Received event TaskCreatedEvent from queue task.created.queue
[TaskService] Task created from TaskCreatedEvent. TaskId: abc123..., CorrelationId: xyz789...
```

**Current State:**
- ✅ Task exists in database
- ❌ WorkflowId: `NULL`
- ❌ MemberId: `NULL`
- ❌ SLADeadline: `NULL`

---

### **Event 3: WorkflowService Consumes TaskCreatedEvent** 🔍

**Who:** WorkflowService  
**Action:** 
1. Gets all workflows from database
2. **Matches workflow by task type** ("ERP" → "ERP Workflow")
3. Creates WorkflowSelection record
4. Publishes `WorkflowSelectedEvent`

**Matching Logic:**
```
TaskType: "ERP"
↓
Search workflows: ["ERP Workflow", "Bug Workflow", "Feature Workflow"]
↓
Match found: "ERP Workflow" (contains "ERP")
↓
Selected: WorkflowId = 1
```

**Database Record Created:**
```sql
INSERT INTO "WorkflowSelections" (
  "TaskId", "WorkflowId", "WorkflowName", "SelectionReason", "SelectedAt"
) VALUES (
  'abc123...', 1, 'ERP Workflow', 
  'Selected based on task type: ERP', 
  '2024-01-15 10:00:01'
);
```

**Event Published:**
```json
{
  "taskId": "abc123-def456-...",
  "workflowId": 1,
  "workflowName": "ERP Workflow",
  "taskPriority": "Critical",  // ← From task!
  "taskType": "ERP",            // ← From task!
  "teamId": 1,                  // ← From workflow!
  "selectedAt": "2024-01-15T10:00:01Z",
  "correlationId": "xyz789-..."
}
```

**Log Messages:**
```
[WorkflowService] Received TaskCreatedEvent. TaskId: abc123..., CorrelationId: xyz789...
[WorkflowService] Matched workflow by name. TaskType: ERP, WorkflowName: ERP Workflow, WorkflowId: 1
[WorkflowService] Workflow selected for task. TaskId: abc123..., WorkflowId: 1, CorrelationId: xyz789...
```

---

### **Event 4: TaskService Consumes WorkflowSelectedEvent** ✅

**Who:** TaskService  
**Action:** Updates task with WorkflowId  
**Status:** `WorkflowSelected` (1)

**Database Update:**
```sql
UPDATE "Tasks"
SET 
  "WorkflowId" = 1,
  "Status" = 1,
  "UpdatedAt" = '2024-01-15 10:00:01'
WHERE "TaskId" = 'abc123...';
```

**Log Message:**
```
[TaskService] Received event WorkflowSelectedEvent from queue workflow.selected.queue
[TaskService] Task updated with workflow. TaskId: abc123..., WorkflowId: 1
```

**Current State:**
- ✅ Task exists
- ✅ WorkflowId: `1`
- ❌ MemberId: `NULL`
- ❌ SLADeadline: `NULL`

---

### **Event 5: SLAManagerService Consumes WorkflowSelectedEvent** ⏱️

**Who:** SLAManagerService  
**Action:**
1. Gets SLA configuration for WorkflowId = 1
2. **Uses actual task priority** ("Critical" from event, not hardcoded!)
3. Finds matching priority in SLA config
4. Calculates deadline
5. Creates SLAAssignment record
6. Publishes `SLAConfiguredEvent`

**SLA Configuration Lookup:**
```json
{
  "workflowId": 1,
  "priorityLevelsJson": {
    "Critical": { "responseTime": 60 },  // ← Matches task priority!
    "High": { "responseTime": 120 },
    "Medium": { "responseTime": 240 },
    "Low": { "responseTime": 480 }
  }
}
```

**Calculation:**
```
Task Priority: "Critical"
↓
SLA Config: Critical → 60 minutes
↓
SLAStartTime: 2024-01-15 10:00:01
SLADeadline: 2024-01-15 11:00:01 (60 minutes later)
```

**Database Record Created:**
```sql
INSERT INTO "SLAAssignments" (
  "TaskId", "WorkflowId", "Priority", "ResponseTimeMinutes",
  "SLAStartTime", "SLADeadline", "IsOverdue"
) VALUES (
  'abc123...', 1, 'Critical', 60,
  '2024-01-15 10:00:01', '2024-01-15 11:00:01', false
);
```

**Event Published:**
```json
{
  "taskId": "abc123-def456-...",
  "workflowId": 1,
  "priority": "Critical",
  "responseTimeMinutes": 60,
  "slaStartTime": "2024-01-15T10:00:01Z",
  "slaDeadline": "2024-01-15T11:00:01Z",
  "correlationId": "xyz789-..."
}
```

**Log Messages:**
```
[SLAManagerService] Received event WorkflowSelectedEvent from queue workflow.selected.queue
[SLAManagerService] SLA configured for task. TaskId: abc123..., Priority: Critical, ResponseTime: 60min, Deadline: 2024-01-15 11:00:01
```

---

### **Event 6: TaskService Consumes SLAConfiguredEvent** 📅

**Who:** TaskService  
**Action:** Updates task with SLA fields

**Database Update:**
```sql
UPDATE "Tasks"
SET 
  "SLAConfigurationId" = 1,
  "SLAStartTime" = '2024-01-15 10:00:01',
  "SLADeadline" = '2024-01-15 11:00:01',
  "UpdatedAt" = '2024-01-15 10:00:02'
WHERE "TaskId" = 'abc123...';
```

**Log Message:**
```
[TaskService] Received event SLAConfiguredEvent from queue sla.configured.queue
[TaskService] Task updated with SLA configuration. TaskId: abc123..., Deadline: 2024-01-15 11:00:01
```

**Current State:**
- ✅ Task exists
- ✅ WorkflowId: `1`
- ✅ SLADeadline: `2024-01-15 11:00:01`
- ❌ MemberId: `NULL`

---

### **Event 7: WorkloadService Consumes SLAConfiguredEvent** 👥

**Who:** WorkloadService  
**Action:**
1. Gets workflow by ID (WorkflowId = 1)
2. **Filters members by workflow's team** (TeamId = 1)
3. Evaluates workload for each team member
4. Selects best member (lowest workload score)
5. Creates TaskAssignment record
6. Publishes `TaskAssignedEvent`

**Team Filtering:**
```
WorkflowId: 1
↓
Get Workflow: TeamId = 1
↓
Get Members: WHERE TeamId = 1
↓
Members: [John Doe (MemberId: 1), Jane Smith (MemberId: 2)]
↓
NOT considered: Members from other teams
```

**Workload Evaluation:**
```
Member 1 (John Doe):
  - ActiveTasks: 2
  - SkillLevel: 4
  - WorkloadScore: 15.5

Member 2 (Jane Smith):
  - ActiveTasks: 0
  - SkillLevel: 3
  - WorkloadScore: 8.2  ← Lowest (best choice)
↓
Selected: MemberId = 2 (Jane Smith)
```

**Database Record Created:**
```sql
INSERT INTO "TaskAssignments" (
  "TaskId", "MemberId", "WorkloadScore", "AssignmentReason", "AssignedAt"
) VALUES (
  'abc123...', 2, 8.2,
  'WorkloadScore: 8.20, ActiveTasks: 0, SkillLevel: 3',
  '2024-01-15 10:00:02'
);
```

**Event Published:**
```json
{
  "taskId": "abc123-def456-...",
  "memberId": 2,
  "memberName": "Jane Smith",
  "memberEmail": "jane.smith@example.com",
  "workloadScore": 8.2,
  "assignedAt": "2024-01-15T10:00:02Z",
  "correlationId": "xyz789-..."
}
```

**Log Messages:**
```
[WorkloadService] Received event SLAConfiguredEvent from queue sla.configured.queue
[WorkloadService] Filtering members by workflow team. WorkflowId: 1, WorkflowName: ERP Workflow, TeamId: 1, TaskId: abc123...
[WorkloadService] Task assigned to member. TaskId: abc123..., MemberId: 2, WorkloadScore: 8.2
```

---

### **Event 8: TaskService Consumes TaskAssignedEvent** ✅

**Who:** TaskService  
**Action:** Updates task with MemberId  
**Status:** `Assigned` (2)

**Database Update:**
```sql
UPDATE "Tasks"
SET 
  "MemberId" = 2,
  "Status" = 2,
  "UpdatedAt" = '2024-01-15 10:00:02'
WHERE "TaskId" = 'abc123...';
```

**Log Message:**
```
[TaskService] Received event TaskAssignedEvent from queue task.assigned.queue
[TaskService] Task updated with member assignment. TaskId: abc123..., MemberId: 2
```

**Final State:**
- ✅ Task exists
- ✅ WorkflowId: `1`
- ✅ MemberId: `2` (from Team 1)
- ✅ SLADeadline: `2024-01-15 11:00:01`
- ✅ Status: `2` (Assigned)

---

## 📊 Complete Flow Timeline

```
Time    Service              Action
─────────────────────────────────────────────────────────
10:00:00  API Gateway        → Publishes TaskCreatedEvent
10:00:00  TaskService        → Creates task (Status: Created)
10:00:00  WorkflowService    → Matches workflow ("ERP" → "ERP Workflow")
10:00:01  TaskService        → Updates task (WorkflowId: 1, Status: WorkflowSelected)
10:00:01  SLAManagerService  → Configures SLA (Priority: Critical, 60min)
10:00:02  TaskService        → Updates task (SLADeadline: 11:00:01)
10:00:02  WorkloadService    → Filters by team, assigns to MemberId: 2
10:00:02  TaskService        → Updates task (MemberId: 2, Status: Assigned)
─────────────────────────────────────────────────────────
Total Time: ~2 seconds
```

---

## ✅ How to Verify Each Step

### **1. Check API Gateway Logs**
Look for:
```
Task creation initiated via API Gateway. TaskId: {TaskId}, CorrelationId: {CorrelationId}
```

### **2. Check RabbitMQ Management UI**
- Go to: http://localhost:15672
- Login: guest / guest
- Click "Queues"
- Check `task.created.queue` - should show messages being consumed

### **3. Check TaskService Database**
```sql
SELECT * FROM "Tasks" WHERE "TaskId" = 'abc123...';
```
**Should show:**
- WorkflowId: `1` ✅
- MemberId: `2` ✅
- SLADeadline: `2024-01-15 11:00:01` ✅
- Status: `2` (Assigned) ✅

### **4. Check WorkflowService Database**
```sql
SELECT * FROM "WorkflowSelections" WHERE "TaskId" = 'abc123...';
```
**Should show:**
- WorkflowId: `1` ✅
- WorkflowName: "ERP Workflow" ✅
- SelectionReason: "Selected based on task type: ERP" ✅

### **5. Check SLAManagerService Database**
```sql
SELECT * FROM "SLAAssignments" WHERE "TaskId" = 'abc123...';
```
**Should show:**
- Priority: "Critical" ✅ (not "Medium"!)
- ResponseTimeMinutes: `60` ✅

### **6. Check WorkloadService Database**
```sql
SELECT * FROM "TaskAssignments" WHERE "TaskId" = 'abc123...';
```
**Should show:**
- MemberId: `2` ✅
- Verify member is from Team 1 ✅

---

## 🧪 Quick Test Script

Save as `test-task-flow.ps1`:

```powershell
# Create a test task
$task = @{
    taskName = "Test ERP Task"
    taskType = "ERP"
    priority = "Critical"
    description = "Testing the complete flow"
} | ConvertTo-Json

Write-Host "Creating task..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST `
    -ContentType "application/json" `
    -Body $task

$taskId = $response.taskId
Write-Host "✅ Task Created!" -ForegroundColor Green
Write-Host "TaskId: $taskId" -ForegroundColor Cyan
Write-Host "CorrelationId: $($response.correlationId)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Waiting 5 seconds for processing..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host ""
Write-Host "📋 Check the following:" -ForegroundColor Magenta
Write-Host "1. TaskService database - Task should have WorkflowId, MemberId, SLADeadline" -ForegroundColor White
Write-Host "2. Service logs - Should show workflow matching, SLA config, member assignment" -ForegroundColor White
Write-Host "3. RabbitMQ UI - Queues should show messages being consumed" -ForegroundColor White
```

Run it:
```powershell
.\test-task-flow.ps1
```

---

## 🎯 Key Points to Verify

1. **Workflow Matching:** ✅
   - TaskType "ERP" → Matches "ERP Workflow"
   - Log shows: "Matched workflow by name"

2. **Priority Usage:** ✅
   - SLA uses "Critical" (from task)
   - NOT hardcoded "Medium"
   - Log shows: "Priority: Critical"

3. **Team Filtering:** ✅
   - Only members from workflow's team considered
   - Log shows: "Filtering members by workflow team. TeamId: 1"

4. **Complete Flow:** ✅
   - All events processed
   - Task fully configured
   - Status: Assigned

---

## 🐛 Common Issues

### **Issue: Task created but WorkflowId is NULL**
- **Cause:** WorkflowService not running or no matching workflow
- **Fix:** Check WorkflowService logs, verify workflow exists

### **Issue: SLA Priority is "Medium" instead of "Critical"**
- **Cause:** Old code still running
- **Fix:** Rebuild and restart SLAManagerService

### **Issue: Task assigned to member from wrong team**
- **Cause:** Workflow has no TeamId or WorkloadService not filtering
- **Fix:** Check workflow TeamId, verify WorkloadService logs

---

## 📝 Summary

**When a task comes in:**

1. ✅ **Created** in database (Status: Created)
2. ✅ **Workflow matched** by task type
3. ✅ **SLA configured** with actual priority
4. ✅ **Member assigned** from workflow's team
5. ✅ **Task complete** (Status: Assigned)

**Total time:** ~2-5 seconds  
**All automatic:** No manual intervention needed!

