# What Happens When a Task Comes In - Complete Flow

## 🎯 Quick Overview

When you send a task creation request, here's **exactly** what happens, step by step:

---

## 📥 Step 1: Task Creation Request Arrives

**You send:**
```bash
POST http://localhost:5004/api/tasks
Content-Type: application/json

{
  "taskName": "Fix critical bug",
  "description": "Fix authentication issue",
  "priority": "High",
  "taskType": "Bug"
}
```

**APIGateway receives it:**
- ✅ Generates a unique `taskId` (e.g., `88e6eb3c-f258-45b0-98d0-db3478373e46`)
- ✅ Generates a unique `correlationId` (e.g., `55039abe-3595-4805-a28f-a282e2aaa0fa`)
- ✅ Creates a `TaskCreatedEvent` object
- ✅ Publishes event to RabbitMQ
- ✅ **Immediately returns HTTP 202 (Accepted)** - doesn't wait for processing

**Response (within milliseconds):**
```json
{
  "taskId": "88e6eb3c-f258-45b0-98d0-db3478373e46",
  "correlationId": "55039abe-3595-4805-a28f-a282e2aaa0fa",
  "message": "Task creation initiated. Processing asynchronously."
}
```

**At this point:** Task is NOT created yet - just the event is published!

---

## 🔄 Step 2: RabbitMQ Distributes Event

**RabbitMQ receives `TaskCreatedEvent`:**
- Exchange: `task.exchange`
- Routing Key: `task.created`
- Queue: `task.created.queue`

**Two services consume this event simultaneously:**

### 2A. TaskService (Port 5005) ✅
**What happens:**
1. Receives `TaskCreatedEvent` from queue
2. Checks if task already exists (idempotency check)
3. **Creates task in database:**
   ```sql
   INSERT INTO "Tasks" (
     "TaskId", "TaskName", "Description", "Priority", "TaskType",
     "Status", "CreatedAt", "UpdatedAt"
   ) VALUES (
     '88e6eb3c-f258-45b0-98d0-db3478373e46',
     'Fix critical bug',
     'Fix authentication issue',
     'High',
     'Bug',
     0,  -- Status: Created
     NOW(),
     NOW()
   )
   ```
4. **Task now exists in database!** ✅
   - Status: `Created` (0)
   - WorkflowId: `NULL` (not set yet)
   - MemberId: `NULL` (not set yet)
   - SLADeadline: `NULL` (not set yet)

**Database:** `TaskService` → `Tasks` table

### 2B. WorkflowService (Port 5006) ✅
**What happens:**
1. Receives `TaskCreatedEvent` from queue (same event, different consumer)
2. Checks if workflow already selected (idempotency check)
3. **Selects best workflow:**
   - Queries `WorkflowManagement` database
   - Looks for workflows matching `TaskType` ("Bug")
   - Example: Finds "Bug Fix Workflow" or "ERP Bug Workflow"
   - Selects workflow based on matching logic
4. **Saves selection:**
   ```sql
   INSERT INTO "WorkflowSelections" (
     "TaskId", "WorkflowId", "WorkflowName", "SelectionReason", "SelectedAt"
   ) VALUES (
     '88e6eb3c-f258-45b0-98d0-db3478373e46',
     1,  -- Example workflow ID
     'Bug Fix Workflow',
     'Selected based on task type: Bug',
     NOW()
   )
   ```
5. **Publishes `WorkflowSelectedEvent`** to RabbitMQ:
   - Exchange: `workflow.exchange`
   - Routing Key: `workflow.selected`
   - Queue: `workflow.selected.queue`

**Database:** `WorkflowManagement` → `WorkflowSelections` table

---

## 🔄 Step 3: Workflow Selected Event

**RabbitMQ distributes `WorkflowSelectedEvent`:**

### 3A. TaskService (Port 5005) ✅
**What happens:**
1. Receives `WorkflowSelectedEvent`
2. Finds task by `TaskId`
3. **Updates task:**
   ```sql
   UPDATE "Tasks"
   SET 
     "WorkflowId" = 1,
     "Status" = 1,  -- WorkflowSelected
     "UpdatedAt" = NOW()
   WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46'
   ```
4. **Task now has WorkflowId!** ✅

### 3B. SLAManagerService (Port 5007) ✅
**What happens:**
1. Receives `WorkflowSelectedEvent`
2. Checks if SLA already configured (idempotency check)
3. **Retrieves SLA configuration:**
   - Queries `SLAConfiguration` database
   - Gets SLA config for `WorkflowId` = 1
   - Example: Finds SLA config with priority levels:
     ```json
     {
       "High": { "responseTime": 60 },
       "Medium": { "responseTime": 120 },
       "Low": { "responseTime": 240 }
     }
     ```
4. **Calculates SLA deadline:**
   - Task priority: "High"
   - Response time: 60 minutes
   - Start time: `NOW()`
   - Deadline: `NOW() + 60 minutes`
5. **Saves SLA assignment:**
   ```sql
   INSERT INTO "SLAAssignments" (
     "TaskId", "WorkflowId", "Priority", "ResponseTimeMinutes",
     "SLAStartTime", "SLADeadline", "IsOverdue"
   ) VALUES (
     '88e6eb3c-f258-45b0-98d0-db3478373e46',
     1,
     'High',
     60,
     NOW(),
     NOW() + INTERVAL '60 minutes',
     false
   )
   ```
6. **Publishes `SLAConfiguredEvent`** to RabbitMQ:
   - Exchange: `sla.exchange`
   - Routing Key: `sla.configured`
   - Queue: `sla.configured.queue`

**Database:** `SLAConfiguration` → `SLAAssignments` table

---

## 🔄 Step 4: SLA Configured Event

**RabbitMQ distributes `SLAConfiguredEvent`:**

### 4A. TaskService (Port 5005) ✅
**What happens:**
1. Receives `SLAConfiguredEvent`
2. Finds task by `TaskId`
3. **Updates task with SLA fields:**
   ```sql
   UPDATE "Tasks"
   SET 
     "SLAConfigurationId" = '...',
     "SLAStartTime" = '2024-01-15 10:00:00',
     "SLADeadline" = '2024-01-15 11:00:00',  -- 60 minutes later
     "UpdatedAt" = NOW()
   WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46'
   ```
4. **Task now has SLA deadline!** ✅

### 4B. WorkloadService (Port 5008) ✅
**What happens:**
1. Receives `SLAConfiguredEvent`
2. Checks if task already assigned (idempotency check)
3. **Evaluates workload for all members:**
   - Queries `WorkflowManagement` database
   - Gets all members in the workflow's team
   - For each member, calculates workload score:
     - Efficiency (30%)
     - Skill Level (20%)
     - Task Completion Rate (20%)
     - Active Task Load (20%)
     - Availability (10%)
   - Example scores:
     ```
     Member A: 25.5 (lowest = best)
     Member B: 45.2
     Member C: 38.7
     ```
4. **Selects best member:**
   - Chooses Member A (lowest workload score = 25.5)
5. **Saves assignment:**
   ```sql
   INSERT INTO "TaskAssignments" (
     "TaskId", "MemberId", "WorkloadScore", "AssignmentReason", "AssignedAt"
   ) VALUES (
     '88e6eb3c-f258-45b0-98d0-db3478373e46',
     5,  -- Member A's ID
     25.5,
     'Lowest workload score',
     NOW()
   )
   ```
6. **Publishes `TaskAssignedEvent`** to RabbitMQ:
   - Exchange: `workload.exchange`
   - Routing Key: `task.assigned`
   - Queue: `task.assigned.queue`

**Database:** `WorkflowManagement` → `TaskAssignments` table

---

## 🔄 Step 5: Task Assigned Event

**RabbitMQ distributes `TaskAssignedEvent`:**

### TaskService (Port 5005) ✅
**What happens:**
1. Receives `TaskAssignedEvent`
2. Finds task by `TaskId`
3. **Final update:**
   ```sql
   UPDATE "Tasks"
   SET 
     "MemberId" = 5,
     "Status" = 2,  -- Assigned
     "UpdatedAt" = NOW()
   WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46'
   ```
4. **✅ TASK COMPLETE!** 🎉

**Final task state:**
- ✅ TaskName: "Fix critical bug"
- ✅ Description: "Fix authentication issue"
- ✅ Priority: "High"
- ✅ TaskType: "Bug"
- ✅ WorkflowId: 1 ✅
- ✅ MemberId: 5 ✅
- ✅ SLADeadline: `2024-01-15 11:00:00` ✅
- ✅ Status: `2` (Assigned) ✅

---

## ⏱️ Timeline

**Total time:** Usually **1-3 seconds** (all asynchronous)

```
Time 0ms:   Request arrives at APIGateway
Time 5ms:   APIGateway publishes TaskCreatedEvent → Returns HTTP 202
Time 10ms:  TaskService creates task in database
Time 12ms:  WorkflowService selects workflow → Publishes WorkflowSelectedEvent
Time 15ms:  TaskService updates task with WorkflowId
Time 18ms:  SLAManagerService configures SLA → Publishes SLAConfiguredEvent
Time 20ms:  TaskService updates task with SLA fields
Time 25ms:  WorkloadService assigns member → Publishes TaskAssignedEvent
Time 28ms:  TaskService updates task with MemberId → Status = Assigned
Time 30ms:  ✅ COMPLETE!
```

---

## 🔍 How to Verify

### 1. Check TaskService Database:
```sql
SELECT * FROM "Tasks" 
WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected:**
- ✅ All fields populated
- ✅ Status = 2 (Assigned)
- ✅ WorkflowId, MemberId, SLADeadline all set

### 2. Check WorkflowService Database:
```sql
SELECT * FROM "WorkflowSelections" 
WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected:**
- ✅ WorkflowId selected
- ✅ SelectionReason recorded

### 3. Check SLAManagerService Database:
```sql
SELECT * FROM "SLAAssignments" 
WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected:**
- ✅ SLA deadline calculated
- ✅ Priority and response time set

### 4. Check WorkloadService Database:
```sql
SELECT * FROM "TaskAssignments" 
WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected:**
- ✅ MemberId assigned
- ✅ WorkloadScore recorded

### 5. Check RabbitMQ Management UI:
- Go to: http://localhost:15672
- Username: `guest`, Password: `guest`
- Check "Queues" tab
- Should see messages being consumed quickly

---

## 🎯 Key Points

1. **Asynchronous:** Everything happens in the background
2. **Event-Driven:** Services communicate via RabbitMQ events
3. **Idempotent:** Each handler checks if already processed
4. **Decoupled:** Services don't call each other directly
5. **Fast:** Usually completes in 1-3 seconds
6. **Reliable:** Failed messages go to Dead Letter Queue

---

## 🔄 Background Process (Ongoing)

**SLAMonitorService** runs every minute:
- Checks all tasks with `SLADeadline < Now` and `IsOverdue = false`
- If deadline passed:
  - Marks as overdue
  - Publishes `TaskOverdueEvent`
  - TaskService updates status to `Overdue` (3)

---

## ✅ Summary

**When a task comes in:**

1. **APIGateway** receives request → Publishes event → Returns immediately
2. **TaskService** creates task in database
3. **WorkflowService** selects workflow → Publishes event
4. **TaskService** updates with WorkflowId
5. **SLAManagerService** configures SLA → Publishes event
6. **TaskService** updates with SLA fields
7. **WorkloadService** assigns member → Publishes event
8. **TaskService** updates with MemberId → Status = Assigned
9. **✅ DONE!** Task is fully configured and assigned

**All happens automatically in 1-3 seconds!** 🚀

