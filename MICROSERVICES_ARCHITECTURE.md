# Microservices Architecture - Task Orchestration Flow

## 📋 Overview

This document describes the production-ready microservices architecture implementing a task orchestration flow using RabbitMQ event-driven communication.

## 🏗️ Architecture Pattern

**Event-Driven Architecture (Event Choreography)**
- Services communicate **only** via RabbitMQ events
- No synchronous service-to-service HTTP calls
- Each service is independently deployable
- Services react to events and publish new events

## 🔄 Event Flow

```
1. API Gateway receives task creation request
   ↓ Publishes TaskCreatedEvent
   
2. Workflow Service consumes TaskCreatedEvent
   ↓ Selects best workflow
   ↓ Publishes WorkflowSelectedEvent
   
3. SLA Manager Service consumes WorkflowSelectedEvent
   ↓ Configures SLA based on workflow + priority
   ↓ Publishes SLAConfiguredEvent
   
4. Workload Service consumes SLAConfiguredEvent
   ↓ Evaluates all members
   ↓ Assigns task to best member
   ↓ Publishes TaskAssignedEvent
   
5. Task Service consumes all events
   ↓ Updates task status at each step
   
6. SLA Monitor (Background Worker) runs continuously
   ↓ Checks SLA deadlines
   ↓ Publishes TaskOverdueEvent when breached
```

## 🧩 Microservices

### 1. API Gateway
**Port**: `http://localhost:5004`  
**Purpose**: Entry point for task creation  
**Responsibilities**:
- Receives HTTP requests for task creation
- Publishes `TaskCreatedEvent` to RabbitMQ
- No business logic, pure orchestration

**Endpoints**:
- `POST /api/tasks` - Create task (publishes event)
- `GET /api/tasks/health` - Health check

### 2. Task Service
**Port**: `http://localhost:5005`  
**Database**: `TaskService` (PostgreSQL)  
**Purpose**: Manages task lifecycle  
**Responsibilities**:
- Creates tasks with initial status "Created"
- Updates task status based on events:
  - `WorkflowSelectedEvent` → Status: "WorkflowSelected"
  - `SLAConfiguredEvent` → Status: "SLAConfigured"
  - `TaskAssignedEvent` → Status: "Assigned"
  - `TaskOverdueEvent` → Status: "Overdue"
- Publishes `TaskStatusUpdatedEvent` on status changes

**Event Handlers**:
- `WorkflowSelectedEventHandler`
- `SLAConfiguredEventHandler`
- `TaskAssignedEventHandler`
- `TaskOverdueEventHandler`

### 3. Workflow Service
**Port**: `http://localhost:5006`  
**Database**: `WorkflowManagement` (PostgreSQL)  
**Purpose**: Selects workflow for tasks  
**Responsibilities**:
- Consumes `TaskCreatedEvent`
- Selects best workflow based on task parameters
- Persists workflow selection
- Publishes `WorkflowSelectedEvent`

**Event Handlers**:
- `TaskCreatedEventHandler`

### 4. SLA Manager Service
**Port**: `http://localhost:5007`  
**Database**: `SLAConfiguration` (PostgreSQL)  
**Purpose**: Configures SLA for tasks  
**Responsibilities**:
- Consumes `WorkflowSelectedEvent`
- Determines SLA based on workflow + priority
- Persists SLA assignment
- Starts SLA timer
- Publishes `SLAConfiguredEvent`
- **Background Worker**: `SLAMonitorService` monitors deadlines and publishes `TaskOverdueEvent`

**Event Handlers**:
- `WorkflowSelectedEventHandler`

**Background Services**:
- `SLAMonitorService` - Polls every 1 minute for overdue SLAs

### 5. Workload Service
**Port**: `http://localhost:5008`  
**Database**: `WorkflowManagement` (PostgreSQL)  
**Purpose**: Assigns tasks to members  
**Responsibilities**:
- Consumes `SLAConfiguredEvent`
- Evaluates all members using workload calculation:
  - Efficiency (30%)
  - Skill Level (20%)
  - Task Completion Rate (20%)
  - Active Task Load (20%)
  - Availability (10%)
- Selects member with lowest workload score
- Persists task assignment
- Publishes `TaskAssignedEvent`

**Event Handlers**:
- `SLAConfiguredEventHandler`

## 🐇 RabbitMQ Configuration

### Exchanges (Direct, Durable)
- `task.exchange` - Task-related events
- `workflow.exchange` - Workflow-related events
- `sla.exchange` - SLA-related events
- `workload.exchange` - Workload-related events

### Queues (Durable, with DLQ)
- `task.created.queue` → `task.created.dlq`
- `workflow.selected.queue` → `workflow.selected.dlq`
- `sla.configured.queue` → `sla.configured.dlq`
- `task.assigned.queue` → `task.assigned.dlq`
- `task.overdue.queue` → `task.overdue.dlq`
- `task.status.updated.queue` → `task.status.updated.dlq`

### Routing Keys
- `task.created`
- `workflow.selected`
- `sla.configured`
- `task.assigned`
- `task.overdue`
- `task.status.updated`

### Features
- **Message Durability**: All messages are persistent
- **Dead Letter Queues**: Failed messages after max retries go to DLQ
- **Retry Logic**: 3 retry attempts with exponential backoff
- **Idempotency**: Event handlers check for duplicate processing

## 📊 Database Schema

### TaskService Database
**Table**: `Tasks`
- `TaskId` (Guid, PK)
- `TaskName`, `Description`, `Priority`, `TaskType`
- `Status` (enum: Created, WorkflowSelected, SLAConfigured, Assigned, InProgress, Completed, Overdue, Cancelled)
- `WorkflowId`, `MemberId`, `SLAConfigurationId` (nullable)
- `SLAStartTime`, `SLADeadline` (nullable)
- `IsOverdue` (bool)
- Event tracking fields for idempotency

### WorkflowService Database
**Table**: `WorkflowSelections`
- `SelectionId` (Guid, PK)
- `TaskId` (Guid, unique)
- `WorkflowId` (int)
- `WorkflowName`
- `SelectionReason`
- `SelectedAt`
- References `Workflows` table from `WorkflowManagement` database

### SLAManagerService Database
**Table**: `SLAAssignments`
- `SLAAssignmentId` (Guid, PK)
- `TaskId` (Guid, unique)
- `WorkflowId` (int)
- `Priority`
- `ResponseTimeMinutes`
- `SLAStartTime`, `SLADeadline`
- `IsOverdue` (bool)
- References `SLAConfigurations` table from `SLAConfiguration` database

### WorkloadService Database
**Table**: `TaskAssignments`
- `AssignmentId` (Guid, PK)
- `TaskId` (Guid, unique)
- `MemberId` (int)
- `WorkloadScore` (double)
- `AssignmentReason`
- `AssignedAt`
- References `Members` and `Tasks` tables from `WorkflowManagement` database

## 🔐 Idempotency Strategy

Each event handler implements idempotency by:
1. Checking if event was already processed (using event ID stored in database)
2. If processed, logging warning and returning early
3. If not processed, processing event and storing event ID

**Event ID Storage**:
- `WorkflowSelectedEventId` in Task entity
- `SLAConfiguredEventId` in Task entity
- `TaskAssignedEventId` in Task entity
- `TaskOverdueEventId` in Task entity

## 🔄 Correlation ID

All events include a `CorrelationId` (Guid) that:
- Is generated at task creation
- Flows through all events in the orchestration
- Enables end-to-end tracing
- Logged in all service operations

## ⏱️ SLA Monitoring

**SLAMonitorService** (Background Worker):
- Runs continuously
- Polls every 1 minute
- Checks `SLAAssignments` table for overdue tasks
- Publishes `TaskOverdueEvent` when deadline is breached
- Marks assignment as overdue

## 🚀 Deployment

### Prerequisites
1. **RabbitMQ**: Running on `localhost:5672` (or configured)
2. **PostgreSQL**: Multiple databases:
   - `TaskService`
   - `WorkflowManagement` (shared by WorkflowService and WorkloadService)
   - `SLAConfiguration` (shared by SLAManagerService)

### Running Services
```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Start each service
cd backend/APIGateway && dotnet run
cd backend/TaskService && dotnet run
cd backend/WorkflowService && dotnet run
cd backend/SLAManagerService && dotnet run
cd backend/WorkloadService && dotnet run
```

### Ports
- API Gateway: `5004`
- Task Service: `5005`
- Workflow Service: `5006`
- SLA Manager Service: `5007`
- Workload Service: `5008`

## 📝 Sample Event Payloads

### TaskCreatedEvent
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "taskName": "Fix critical bug",
  "description": "Fix authentication issue",
  "priority": "Critical",
  "taskType": "Bug",
  "createdAt": "2025-12-31T11:00:00Z",
  "correlationId": "123e4567-e89b-12d3-a456-426614174001"
}
```

### WorkflowSelectedEvent
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "workflowId": 1,
  "workflowName": "Development Workflow",
  "selectedAt": "2025-12-31T11:00:01Z",
  "correlationId": "123e4567-e89b-12d3-a456-426614174001"
}
```

### SLAConfiguredEvent
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "workflowId": 1,
  "priority": "Critical",
  "responseTimeMinutes": 30,
  "slaStartTime": "2025-12-31T11:00:02Z",
  "slaDeadline": "2025-12-31T11:30:02Z",
  "correlationId": "123e4567-e89b-12d3-a456-426614174001"
}
```

### TaskAssignedEvent
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "memberId": 5,
  "memberName": "John Doe",
  "memberEmail": "john.doe@example.com",
  "workloadScore": 25.5,
  "assignedAt": "2025-12-31T11:00:03Z",
  "correlationId": "123e4567-e89b-12d3-a456-426614174001"
}
```

### TaskOverdueEvent
```json
{
  "taskId": "123e4567-e89b-12d3-a456-426614174000",
  "memberId": 5,
  "slaDeadline": "2025-12-31T11:30:02Z",
  "breachedAt": "2025-12-31T11:31:00Z",
  "minutesOverdue": 1,
  "correlationId": "123e4567-e89b-12d3-a456-426614174001"
}
```

## 🎯 Design Decisions

### Event Choreography vs Orchestration
**Chosen**: Event Choreography
- **Reason**: Better scalability, loose coupling, services are independent
- Each service reacts to events and publishes new events
- No central orchestrator needed

### SLA Timer Handling
**Chosen**: Background Worker with Polling
- **Reason**: Simple, reliable, easy to debug
- Alternative considered: Delayed RabbitMQ messages (TTL + DLX)
- Polling interval: 1 minute (configurable)

### Workload Scoring Logic
**Formula**: Weighted sum of 5 factors
- Efficiency: 30%
- Skill Level: 20%
- Task Completion Rate: 20%
- Active Task Load: 20%
- Availability: 10%
- **Lower score = Better availability**

### Idempotency and Retries
- **Idempotency**: Event ID stored in database, checked before processing
- **Retries**: 3 attempts with exponential backoff
- **DLQ**: Messages that fail after max retries go to Dead Letter Queue

## 🔍 Monitoring & Logging

- All services log with CorrelationId for tracing
- Structured logging with Microsoft.Extensions.Logging
- Log levels: Information, Warning, Error
- CorrelationId flows through all events for end-to-end tracing

## ✅ Testing Strategy

1. **Unit Tests**: Test business logic in services
2. **Integration Tests**: Test event handlers with in-memory RabbitMQ
3. **End-to-End Tests**: Test full orchestration flow
4. **Idempotency Tests**: Verify duplicate events are handled correctly

## 📚 Next Steps

1. Add API Gateway health checks for downstream services
2. Implement circuit breaker pattern
3. Add distributed tracing (OpenTelemetry)
4. Implement event sourcing for audit trail
5. Add metrics collection (Prometheus)
6. Enhance workflow selection with ML/AI
7. Add retry policies with exponential backoff
8. Implement saga pattern for complex workflows

