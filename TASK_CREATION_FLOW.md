# Task Creation Flow - Step by Step

## When You Execute:
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

## Expected Response:
```json
{
  "taskId": "88e6eb3c-f258-45b0-98d0-db3478373e46",
  "correlationId": "55039abe-3595-4805-a28f-a282e2aaa0fa",
  "message": "Task creation initiated. Processing asynchronously."
}
```

---

## Complete Event Flow (What Happens Behind the Scenes)

### Step 1: API Gateway Receives Request ✅
**Service:** APIGateway (Port 5004)
- Receives POST request
- Generates `taskId` and `correlationId`
- Creates `TaskCreatedEvent` object
- **Publishes to RabbitMQ:**
  - Exchange: `task.exchange`
  - Routing Key: `task.created`
  - Queue: `task.created.queue`

**Log Message:**
```
Task creation initiated via API Gateway. TaskId: {TaskId}, CorrelationId: {CorrelationId}
```

**Status:** ✅ Request accepted (HTTP 202)

---

### Step 2: TaskService Consumes TaskCreatedEvent ✅
**Service:** TaskService (Port 5005)
- **Consumes** `TaskCreatedEvent` from `task.created.queue`
- **Creates task** in TaskService database:
  - TaskId: `88e6eb3c-f258-45b0-98d0-db3478373e46`
  - TaskName: "Fix critical bug"
  - Description: "Fix authentication issue"
  - Priority: "Critical"
  - TaskType: "Bug"
  - Status: `Created` (0)
  - WorkflowId: `NULL` (will be set later)
  - MemberId: `NULL` (will be set later)

**Log Message:**
```
Received event TaskCreatedEvent from queue task.created.queue, CorrelationId: {CorrelationId}
Task created from TaskCreatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}
```

**Database:** TaskService → `Tasks` table
- ✅ Task record created

---

### Step 3: WorkflowService Consumes TaskCreatedEvent ✅
**Service:** WorkflowService (Port 5006)
- **Consumes** `TaskCreatedEvent` from `task.created.queue` (same queue, different consumer)
- **Selects appropriate workflow** based on:
  - TaskType (Bug)
  - Priority (Critical)
  - Available workflows in database
- **Creates WorkflowSelection** record
- **Publishes to RabbitMQ:**
  - Exchange: `workflow.exchange`
  - Routing Key: `workflow.selected`
  - Queue: `workflow.selected.queue`
  - Event: `WorkflowSelectedEvent` (contains TaskId, WorkflowId)

**Log Message:**
```
Received TaskCreatedEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}
Workflow selected for task. TaskId: {TaskId}, WorkflowId: {WorkflowId}
Published WorkflowSelectedEvent. TaskId: {TaskId}, WorkflowId: {WorkflowId}
```

**Database:** WorkflowService → `WorkflowSelections` table
- ✅ WorkflowSelection record created

---

### Step 4: TaskService Consumes WorkflowSelectedEvent ✅
**Service:** TaskService (Port 5005)
- **Consumes** `WorkflowSelectedEvent` from `workflow.selected.queue`
- **Updates task** in TaskService database:
  - Sets `WorkflowId` to selected workflow ID
  - Updates `Status` to `WorkflowSelected` (1)

**Log Message:**
```
Received event WorkflowSelectedEvent from queue workflow.selected.queue, CorrelationId: {CorrelationId}
Task updated with workflow. TaskId: {TaskId}, WorkflowId: {WorkflowId}
```

**Database:** TaskService → `Tasks` table
- ✅ WorkflowId populated
- ✅ Status updated

---

### Step 5: SLAManagerService Consumes WorkflowSelectedEvent ✅
**Service:** SLAManagerService (Port 5007)
- **Consumes** `WorkflowSelectedEvent` from `workflow.selected.queue`
- **Retrieves SLA configuration** for the workflow:
  - Priority-based response times
  - SLA rules from database
- **Creates SLAAssignment** record:
  - TaskId
  - WorkflowId
  - Priority: "Critical"
  - ResponseTimeMinutes: (based on priority)
  - SLAStartTime: Now
  - SLADeadline: Now + ResponseTimeMinutes
  - IsOverdue: false
- **Publishes to RabbitMQ:**
  - Exchange: `sla.exchange`
  - Routing Key: `sla.configured`
  - Queue: `sla.configured.queue`
  - Event: `SLAConfiguredEvent` (contains TaskId, WorkflowId, Priority, SLADeadline)

**Log Message:**
```
Received event WorkflowSelectedEvent from queue workflow.selected.queue, CorrelationId: {CorrelationId}
SLA configured for task. TaskId: {TaskId}, WorkflowId: {WorkflowId}, Deadline: {SLADeadline}
Published SLAConfiguredEvent. TaskId: {TaskId}, CorrelationId: {CorrelationId}
```

**Database:** SLAManagerService → `SLAAssignments` table
- ✅ SLAAssignment record created

---

### Step 6: TaskService Consumes SLAConfiguredEvent ✅
**Service:** TaskService (Port 5005)
- **Consumes** `SLAConfiguredEvent` from `sla.configured.queue`
- **Updates task** in TaskService database:
  - Sets `SLAConfigurationId`
  - Sets `SLAStartTime`
  - Sets `SLADeadline`

**Log Message:**
```
Received event SLAConfiguredEvent from queue sla.configured.queue, CorrelationId: {CorrelationId}
Task updated with SLA configuration. TaskId: {TaskId}, Deadline: {SLADeadline}
```

**Database:** TaskService → `Tasks` table
- ✅ SLA fields populated

---

### Step 7: WorkloadService Consumes SLAConfiguredEvent ✅
**Service:** WorkloadService (Port 5008)
- **Consumes** `SLAConfiguredEvent` from `sla.configured.queue`
- **Evaluates workload** for all members:
  - Calculates workload scores
  - Considers: efficiency, skill level, task completion rate, active tasks, availability
- **Selects best member** (lowest workload score = most available)
- **Publishes to RabbitMQ:**
  - Exchange: `workload.exchange`
  - Routing Key: `task.assigned`
  - Queue: `task.assigned.queue`
  - Event: `TaskAssignedEvent` (contains TaskId, MemberId)

**Log Message:**
```
Received event SLAConfiguredEvent from queue sla.configured.queue, CorrelationId: {CorrelationId}
Task assigned to member. TaskId: {TaskId}, MemberId: {MemberId}
Published TaskAssignedEvent. TaskId: {TaskId}, MemberId: {MemberId}
```

**Database:** WorkloadService → `TaskAssignments` table (if exists)
- ✅ Task assignment record created

---

### Step 8: TaskService Consumes TaskAssignedEvent ✅
**Service:** TaskService (Port 5005)
- **Consumes** `TaskAssignedEvent` from `task.assigned.queue`
- **Updates task** in TaskService database:
  - Sets `MemberId` to assigned member ID
  - Updates `Status` to `Assigned` (2)

**Log Message:**
```
Received event TaskAssignedEvent from queue task.assigned.queue, CorrelationId: {CorrelationId}
Task updated with member assignment. TaskId: {TaskId}, MemberId: {MemberId}
```

**Database:** TaskService → `Tasks` table
- ✅ MemberId populated
- ✅ Status updated to Assigned

---

## Final State

### TaskService Database (`Tasks` table):
```sql
SELECT * FROM "Tasks" WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected Result:**
- ✅ TaskId: `88e6eb3c-f258-45b0-98d0-db3478373e46`
- ✅ TaskName: "Fix critical bug"
- ✅ Description: "Fix authentication issue"
- ✅ Priority: "Critical"
- ✅ TaskType: "Bug"
- ✅ Status: `2` (Assigned)
- ✅ WorkflowId: `[Workflow ID]` (populated)
- ✅ MemberId: `[Member ID]` (populated)
- ✅ SLAConfigurationId: `[SLA ID]` (populated)
- ✅ SLAStartTime: `[Timestamp]` (populated)
- ✅ SLADeadline: `[Timestamp]` (populated)

### WorkflowService Database (`WorkflowSelections` table):
```sql
SELECT * FROM "WorkflowSelections" WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected Result:**
- ✅ TaskId: `88e6eb3c-f258-45b0-98d0-db3478373e46`
- ✅ WorkflowId: `[Workflow ID]`
- ✅ SelectedAt: `[Timestamp]`

### SLAManagerService Database (`SLAAssignments` table):
```sql
SELECT * FROM "SLAAssignments" WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected Result:**
- ✅ TaskId: `88e6eb3c-f258-45b0-98d0-db3478373e46`
- ✅ WorkflowId: `[Workflow ID]`
- ✅ Priority: "Critical"
- ✅ ResponseTimeMinutes: `[Number]`
- ✅ SLAStartTime: `[Timestamp]`
- ✅ SLADeadline: `[Timestamp]`
- ✅ IsOverdue: `false`

---

## How to Verify Each Step

### 1. Check API Gateway Logs
Look for: `"Task creation initiated via API Gateway"`

### 2. Check RabbitMQ Management UI
- Go to http://localhost:15672
- Click "Queues and Streams"
- Check `task.created.queue` - should show messages being consumed

### 3. Check TaskService Database
```sql
SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
```

### 4. Check WorkflowService Database
```sql
SELECT * FROM "WorkflowSelections" ORDER BY "SelectedAt" DESC LIMIT 1;
```

### 5. Check SLAManagerService Database
```sql
SELECT * FROM "SLAAssignments" ORDER BY "CreatedAt" DESC LIMIT 1;
```

### 6. Check TaskService Database Again
```sql
SELECT * FROM "Tasks" WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```
Should show all fields populated.

---

## Troubleshooting

### If Task is Created but WorkflowId is NULL:
- ❌ WorkflowService is not running
- ❌ WorkflowService is not consuming `TaskCreatedEvent`
- ❌ No workflows exist in database
- ✅ Check WorkflowService logs

### If WorkflowId is Set but MemberId is NULL:
- ❌ WorkloadService is not running
- ❌ WorkloadService is not consuming `SLAConfiguredEvent`
- ❌ No members exist in database
- ✅ Check WorkloadService logs

### If Queues are Empty in RabbitMQ:
- ❌ Services are not connecting to RabbitMQ
- ❌ Services are crashing before declaring queues
- ✅ Check service logs for connection errors
- ✅ Verify RabbitMQ is running: `docker ps`

### If Events are Published but Not Consumed:
- ❌ Consumers are not started
- ❌ Queue bindings are incorrect
- ❌ Routing keys don't match
- ✅ Check service logs for consumer startup messages

