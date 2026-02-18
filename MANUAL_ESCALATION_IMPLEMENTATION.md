# Manual Stage Escalation Implementation

## Overview
Implemented manual stage escalation feature that allows users to escalate tasks to the next stage when they cannot handle them. Unlike automatic timeout-based escalation, manual escalation **does NOT increment the member's completion count**, ensuring accurate performance tracking.

## Key Difference: Completion vs Escalation

### Complete Stage (POST /api/task-service/complete-stage/{id})
- ✅ **Increments completion count** - Member successfully finished work
- ✅ Adds MemberId to `CompletedByMemberIds` in WorkflowManagement.API
- ✅ Counts toward member's productivity metrics
- ✅ Used for workload calculation and assignment algorithm

### Escalate Stage (POST /api/task-service/escalate-stage/{id})
- ❌ **Does NOT increment completion count** - Member passed work to next stage
- ❌ Does NOT update `CompletedByMemberIds`
- ❌ Does NOT count toward productivity metrics
- ✅ Tracks escalation reason for audit purposes
- ✅ Still moves task to next stage (same orchestration logic)

## Changes Made

### 1. Backend - Core Domain

#### TaskStatus Enum
**File:** `backend/TaskService/src/Domain/Enums/TaskStatus.cs`
- Added `Escalated = 8` status

#### Task Entity
**File:** `backend/TaskService/src/Domain/Entities/Task.cs`
- Added `TaskStageEscalatedEventId` property for idempotency

#### Task DbContext
**File:** `backend/TaskService/src/Infrastructure/Persistence/TaskDbContext.cs`
- Added index for `TaskStageEscalatedEventId`

#### Task Repository
**File:** `backend/TaskService/src/Infrastructure/Repositories/TaskRepository.cs`
- Added `TaskStageEscalatedEvent` case to `GetByEventIdAsync` method

### 2. Backend - Events & Contracts

#### New Event Contract
**File:** `backend/Shared/Shared.Contracts/EventContracts/TaskStageEscalatedEvent.cs`
```csharp
public class TaskStageEscalatedEvent
{
    public Guid TaskId { get; set; }
    public int CurrentStageId { get; set; }
    public string CurrentStageName { get; set; }
    public int? NextStageId { get; set; }
    public string? NextStageName { get; set; }
    public int WorkflowId { get; set; }
    public string EscalationReason { get; set; }
    public DateTime EscalatedAt { get; set; }
    public Guid CorrelationId { get; set; }
}
```

#### Event Bus Constants
**File:** `backend/Shared/Shared.Contracts/Constants/EventBusConstants.cs`
- Added `TaskStageEscalated = "TaskStageEscalated"`

#### Event Bus Routing
**File:** `backend/Shared/Shared.Messaging/AwsEventBus.cs`
- Added routing for `TaskStageEscalatedEvent`

### 3. Backend - Application Layer

#### TaskService Interface
**File:** `backend/TaskService/src/Application/Interfaces/ITaskService.cs`
- Added `EscalateStageAsync(Guid taskId, string escalationReason)` method

#### TaskService Implementation
**File:** `backend/TaskService/src/Application/Services/TaskService.cs`
- Implemented `EscalateStageAsync` method
- Validates task status (must be InProgress)
- Validates stage existence
- Publishes `TaskStageEscalatedEvent` (does NOT update CompletedByMemberIds)

### 4. Backend - API Controllers

#### TasksController
**File:** `backend/TaskService/src/Api/Controllers/TasksController.cs`
- Added `POST /api/task-service/escalate-stage/{id}` endpoint
- Added `EscalateStageRequest` DTO with `Reason` property

### 5. Backend - Event Handlers

#### TaskService Event Handler
**File:** `backend/TaskService/src/Application/EventHandlers/TaskStageEscalatedEventHandler.cs`
- Handles `TaskStageEscalatedEvent`
- Updates task stage info
- Implements idempotency check
- Does NOT update `CompletedByMemberIds`

#### WorkflowService Event Handler
**File:** `backend/WorkflowService/src/Application/EventHandlers/TaskStageEscalatedEventHandler.cs`
- Handles `TaskStageEscalatedEvent`
- Converts to `TaskStageCompletedEvent` for orchestration
- Reuses existing stage transition logic

### 6. Backend - Program.cs Registration

#### TaskService Program.cs
**File:** `backend/TaskService/Program.cs`
- Registered `TaskStageEscalatedEventHandler`
- Added event consumer for `TaskStageEscalatedEvent`
- Added `TaskStageEscalatedEventId` column in table creation script
- Added index for `TaskStageEscalatedEventId`

#### WorkflowService Program.cs
**File:** `backend/WorkflowService/Program.cs`
- Registered `TaskStageEscalatedEventHandler`
- Added event consumer for `TaskStageEscalatedEvent`

### 7. Database Migration

#### Migration Script
**File:** `backend/TaskService/Migrations/AddTaskStageEscalatedEventId.sql`
- Adds `TaskStageEscalatedEventId` column to Tasks table
- Creates index for idempotency checks

## Usage

### API Endpoint

**Escalate Stage:**
```http
POST /api/task-service/escalate-stage/{taskId}
Content-Type: application/json

{
  "reason": "Requires senior developer expertise"
}
```

**Response:**
```json
{
  "message": "Stage escalated successfully. Task will transition to the next stage."
}
```

### Error Responses

**Task Not Found (404):**
```json
{
  "error": "Task {taskId} not found"
}
```

**Invalid Status (400):**
```json
{
  "error": "Task must be in progress to escalate. Current status: {status}"
}
```

**No Stage (400):**
```json
{
  "error": "Task is not in any stage"
}
```

## Event Flow

### Manual Escalation Flow
```
1. User calls POST /api/task-service/escalate-stage/{id}
   ↓
2. TaskService validates task (InProgress, has stage)
   ↓
3. TaskService publishes TaskStageEscalatedEvent
   ↓
4. TaskService.TaskStageEscalatedEventHandler updates task
   (Does NOT update CompletedByMemberIds)
   ↓
5. WorkflowService.TaskStageEscalatedEventHandler receives event
   ↓
6. Converts to TaskStageCompletedEvent for orchestration
   ↓
7. StageOrchestrationService.HandleStageCompletionAsync
   ↓
8. If more stages: TaskStageStartedEvent → next stage
   If no more stages: TaskCompletedEvent → task completed
```

### Comparison with Completion Flow
```
COMPLETION:                          ESCALATION:
POST /complete-stage/{id}           POST /escalate-stage/{id}
        ↓                                    ↓
TaskStageCompletedEvent             TaskStageEscalatedEvent
        ↓                                    ↓
Update CompletedByMemberIds ✅      Skip CompletedByMemberIds ❌
        ↓                                    ↓
        Stage Orchestration (same logic)
        ↓                                    ↓
        Next Stage / Task Completed
```

## Performance Tracking Impact

### Workload Calculation
The existing workload calculation in `Workload.API/Services/WorkloadService.cs` uses `CompletedByMemberIds`:

```csharp
// Line 60-67
var stageCompletedCount = stageCompletedTasksQuery
    .Count(t => t.CompletedByMemberIds!.Split(',').Contains(memberIdStr));

// Line 138
var completedCount = completedTasks.Count + stageCompletedCount;
```

**Result:**
- ✅ Completed stages: Member ID added → count increases
- ❌ Escalated stages: Member ID NOT added → count stays same

### Metrics Affected
1. **Efficiency Score** - Based on completion rate
2. **Task Completion Rate** - Percentage of completed work
3. **Workload Score** - Used for assignment algorithm
4. **Member Performance Reports** - Accurate productivity tracking

## Testing Checklist

- [ ] Create task and assign to member
- [ ] Start task (InProgress status)
- [ ] Complete stage → verify CompletedByMemberIds updated
- [ ] Create another task and assign
- [ ] Escalate stage → verify CompletedByMemberIds NOT updated
- [ ] Verify task moved to next stage in both cases
- [ ] Check workload metrics show different completion counts
- [ ] Verify escalation reason stored in logs
- [ ] Test idempotency (send same escalation event twice)
- [ ] Test error cases (invalid status, no stage, etc.)

## Future Enhancements

1. **Escalation Analytics Dashboard**
   - Track escalation frequency per member
   - Identify skill gaps
   - Monitor escalation patterns

2. **Escalation Limits**
   - Max escalations per member per day
   - Require manager approval for multiple escalations

3. **Escalation Notifications**
   - Notify next stage team when task is escalated
   - Alert manager if member escalates frequently

4. **UI Improvements**
   - Add "Escalate" button next to "Complete" button
   - Show escalation history in task details
   - Display escalation reason in task timeline

## Migration Steps

1. **Run Database Migration:**
   ```bash
   psql -U postgres -d taskmanager -f backend/TaskService/Migrations/AddTaskStageEscalatedEventId.sql
   ```

2. **Restart Services:**
   - TaskService
   - WorkflowService

3. **Verify Event Consumers:**
   - Check logs for "TaskStageEscalatedEvent consumer started successfully"

4. **Test API:**
   - Create test task
   - Escalate stage
   - Verify in logs and database

## Notes

- Manual escalation is independent of automatic timeout-based escalation
- Both mechanisms can coexist in the same workflow
- Escalation reason is logged but not currently stored in database (can be added if needed)
- The `Escalated` status (8) is available but not currently used in the flow (task stays `InProgress`)
