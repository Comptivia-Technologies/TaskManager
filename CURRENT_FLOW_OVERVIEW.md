# Current Task Orchestration Flow - Overview

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT / FRONTEND                                │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTP POST
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  API GATEWAY (Port 5004)                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/tasks                                                    │  │
│  │   • Generates taskId & correlationId                              │  │
│  │   • Creates TaskCreatedEvent                                      │  │
│  │   • Publishes to RabbitMQ                                         │  │
│  │   • Returns HTTP 202 (Accepted)                                  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               │ Publishes: TaskCreatedEvent
                               │ Exchange: task.exchange
                               │ Routing Key: task.created
                               ▼
                    ┌──────────────────────┐
                    │   RABBITMQ           │
                    │   (Docker)           │
                    │   Port 5672          │
                    └──────────┬───────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                │ task.created.queue          │
                │                             │
        ┌───────┴────────┐          ┌────────┴────────┐
        │                │          │                 │
        ▼                ▼          ▼                 ▼
┌───────────────┐  ┌──────────────┐
│ TASK SERVICE │  │ WORKFLOW     │
│ (Port 5005)  │  │ SERVICE      │
│              │  │ (Port 5006)  │
│ Consumes:    │  │              │
│ • TaskCreated│  │ Consumes:    │
│              │  │ • TaskCreated│
│ Creates task │  │              │
│ in DB        │  │ Selects      │
│              │  │ workflow     │
│              │  │              │
│              │  │ Publishes:   │
│              │  │ WorkflowSelectedEvent
└──────┬───────┘  └──────┬───────┘
       │                 │
       │                 │ Exchange: workflow.exchange
       │                 │ Routing Key: workflow.selected
       │                 ▼
       │          ┌──────────────┐
       │          │   RABBITMQ   │
       │          └──────┬───────┘
       │                 │
       │                 │ workflow.selected.queue
       │                 │
       │    ┌────────────┴────────────┐
       │    │                         │
       ▼    ▼                         ▼
┌───────────────┐          ┌──────────────────┐
│ TASK SERVICE │          │ SLA MANAGER      │
│ (Port 5005)  │          │ SERVICE          │
│              │          │ (Port 5007)      │
│ Consumes:    │          │                  │
│ • Workflow   │          │ Consumes:        │
│   Selected   │          │ • WorkflowSelected│
│              │          │                  │
│ Updates task │          │ Creates SLA      │
│ with         │          │ assignment       │
│ WorkflowId   │          │                  │
│              │          │ Publishes:       │
│              │          │ SLAConfiguredEvent│
└──────┬───────┘          └──────┬───────────┘
       │                         │
       │                         │ Exchange: sla.exchange
       │                         │ Routing Key: sla.configured
       │                         ▼
       │                  ┌──────────────┐
       │                  │   RABBITMQ   │
       │                  └──────┬───────┘
       │                         │
       │                         │ sla.configured.queue
       │                         │
       │         ┌───────────────┴───────────────┐
       │         │                                │
       ▼         ▼                                ▼
┌───────────────┐          ┌──────────────────┐
│ TASK SERVICE │          │ WORKLOAD         │
│ (Port 5005)  │          │ SERVICE          │
│              │          │ (Port 5008)      │
│ Consumes:    │          │                  │
│ • SLA        │          │ Consumes:        │
│   Configured │          │ • SLAConfigured  │
│              │          │                  │
│ Updates task │          │ Evaluates        │
│ with SLA     │          │ workload         │
│ fields       │          │                  │
│              │          │ Assigns member   │
│              │          │                  │
│              │          │ Publishes:       │
│              │          │ TaskAssignedEvent │
└──────┬───────┘          └──────┬───────────┘
       │                         │
       │                         │ Exchange: workload.exchange
       │                         │ Routing Key: task.assigned
       │                         ▼
       │                  ┌──────────────┐
       │                  │   RABBITMQ   │
       │                  └──────┬───────┘
       │                         │
       │                         │ task.assigned.queue
       │                         │
       │                         │
       ▼                         ▼
┌───────────────────────────────────────┐
│ TASK SERVICE (Port 5005)              │
│                                       │
│ Consumes:                             │
│ • TaskAssigned                        │
│                                       │
│ Updates task with MemberId            │
│ Status: Assigned                      │
│                                       │
│ ✅ TASK COMPLETE                      │
└───────────────────────────────────────┘
```

---

## 📋 Complete Event Sequence

### 1️⃣ **API Gateway** → Publishes `TaskCreatedEvent`
- **Event:** `TaskCreatedEvent`
- **Exchange:** `task.exchange`
- **Routing Key:** `task.created`
- **Queue:** `task.created.queue`
- **Consumers:** TaskService, WorkflowService

### 2️⃣ **TaskService** → Consumes `TaskCreatedEvent`
- Creates task in `Tasks` table
- Status: `Created` (0)
- Fields: TaskId, TaskName, Description, Priority, TaskType
- WorkflowId: `NULL` (will be set later)
- MemberId: `NULL` (will be set later)

### 3️⃣ **WorkflowService** → Consumes `TaskCreatedEvent`
- Selects workflow based on TaskType and Priority
- Creates record in `WorkflowSelections` table
- **Publishes:** `WorkflowSelectedEvent`
  - Exchange: `workflow.exchange`
  - Routing Key: `workflow.selected`
  - Queue: `workflow.selected.queue`

### 4️⃣ **TaskService** → Consumes `WorkflowSelectedEvent`
- Updates task with `WorkflowId`
- Status: `WorkflowSelected` (1)

### 5️⃣ **SLAManagerService** → Consumes `WorkflowSelectedEvent`
- Retrieves SLA configuration for workflow
- Creates record in `SLAAssignments` table
- Calculates deadline based on priority
- **Publishes:** `SLAConfiguredEvent`
  - Exchange: `sla.exchange`
  - Routing Key: `sla.configured`
  - Queue: `sla.configured.queue`

### 6️⃣ **TaskService** → Consumes `SLAConfiguredEvent`
- Updates task with SLA fields:
  - `SLAConfigurationId`
  - `SLAStartTime`
  - `SLADeadline`

### 7️⃣ **WorkloadService** → Consumes `SLAConfiguredEvent`
- Evaluates workload for all members
- Calculates workload scores
- Selects best member (lowest workload)
- **Publishes:** `TaskAssignedEvent`
  - Exchange: `workload.exchange`
  - Routing Key: `task.assigned`
  - Queue: `task.assigned.queue`

### 8️⃣ **TaskService** → Consumes `TaskAssignedEvent`
- Updates task with `MemberId`
- Status: `Assigned` (2)
- ✅ **Task orchestration complete!**

---

## 🔄 Background Process

### **SLAMonitorService** (Background Worker)
- **Service:** SLAManagerService (Port 5007)
- **Runs:** Every 1 minute
- **Checks:** All tasks with `SLADeadline < Now` and `IsOverdue = false`
- **Action:** 
  - Marks task as overdue
  - **Publishes:** `TaskOverdueEvent`
    - Exchange: `sla.exchange`
    - Routing Key: `task.overdue`
    - Queue: `task.overdue.queue`

### **TaskService** → Consumes `TaskOverdueEvent`
- Updates task status to `Overdue` (3)

---

## 📊 Database Tables

### **TaskService Database** (`TaskService`)
- **Table:** `Tasks`
  - Stores complete task information
  - Updated by multiple events
  - Final source of truth for task state

### **WorkflowService Database** (`WorkflowManagement`)
- **Table:** `WorkflowSelections`
  - Tracks which workflow was selected for each task

### **SLAManagerService Database** (`SLAConfiguration`)
- **Table:** `SLAAssignments`
  - Tracks SLA assignments and deadlines
  - Used by background monitor

### **WorkloadService Database** (`WorkflowManagement`)
- **Table:** `TaskAssignments` (if exists)
  - Tracks task assignments to members

---

## 🔌 RabbitMQ Queues

### **Queues Created:**
1. `task.created.queue` - TaskService, WorkflowService consume
2. `workflow.selected.queue` - TaskService, SLAManagerService consume
3. `sla.configured.queue` - TaskService, WorkloadService consume
4. `task.assigned.queue` - TaskService consumes
5. `task.overdue.queue` - TaskService consumes

### **Dead Letter Queues (DLQ):**
- Each queue has a corresponding `.dlq` queue
- Failed messages (after retries) go to DLQ
- Example: `task.created.queue.dlq`

---

## ✅ Key Features

### **1. Event-Driven Architecture**
- Services communicate via events (decoupled)
- No direct HTTP calls between services
- Asynchronous processing

### **2. Idempotency**
- Each event handler checks if task already exists/updated
- Prevents duplicate processing

### **3. Correlation ID**
- Every event includes `correlationId`
- Tracks entire flow for a single task
- Useful for logging and debugging

### **4. Retry & Dead Letter Queues**
- Failed messages retry automatically
- After max retries, moved to DLQ
- Prevents message loss

### **5. Scoped Service Resolution**
- Each event handler creates its own scope
- Properly resolves scoped services (repositories, DbContext)
- Prevents dependency injection errors

---

## 🚀 How to Verify Flow

### **1. Check TaskService Database:**
```sql
SELECT * FROM "Tasks" 
WHERE "TaskId" = '88e6eb3c-f258-45b0-98d0-db3478373e46';
```

**Expected:**
- ✅ TaskName: "Fix critical bug"
- ✅ WorkflowId: [populated]
- ✅ MemberId: [populated]
- ✅ SLADeadline: [populated]
- ✅ Status: `2` (Assigned)

### **2. Check RabbitMQ Management UI:**
- Go to: http://localhost:15672
- Username: `guest`
- Password: `guest`
- Check "Queues" tab
- Should see messages being consumed

### **3. Check Service Logs:**
Each service logs:
- Event received
- Event processed
- Event published (if applicable)
- Database operations

---

## 🔧 Current Status

### **✅ Fixed Issues:**
1. ✅ TaskService now consumes `TaskCreatedEvent` (was missing)
2. ✅ Scoped service resolution (was causing DI errors)
3. ✅ Async consumer implementation (was using sync consumer)
4. ✅ Database initialization (tables created automatically)
5. ✅ RabbitMQ connection error handling

### **✅ Working:**
- API Gateway publishes events
- TaskService creates tasks
- WorkflowService selects workflows
- SLAManagerService configures SLA
- WorkloadService assigns members
- TaskService updates task with all fields

---

## 📝 Next Steps

1. **Test the flow:**
   ```bash
   curl -X POST http://localhost:5004/api/tasks \
     -H "Content-Type: application/json" \
     -d '{
       "taskName": "Test task",
       "description": "Test description",
       "priority": "High",
       "taskType": "Feature"
     }'
   ```

2. **Verify in database:**
   ```sql
   SELECT * FROM "Tasks" ORDER BY "CreatedAt" DESC LIMIT 1;
   ```

3. **Check logs:**
   - Each service should show event processing logs
   - No errors should appear

4. **Monitor RabbitMQ:**
   - Check queues are created
   - Messages are being consumed
   - No messages stuck in queues

---

## 🎯 Summary

The flow is **fully event-driven** and **asynchronous**:
- ✅ API Gateway receives request → Publishes event
- ✅ Multiple services consume same event (fan-out)
- ✅ Each service publishes next event in chain
- ✅ TaskService aggregates all updates
- ✅ Final state: Task is fully configured and assigned

All services are **decoupled** and communicate only through **RabbitMQ events**.

