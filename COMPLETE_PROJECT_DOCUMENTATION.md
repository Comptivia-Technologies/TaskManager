# Complete Project Documentation

## 📋 Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Backend Services](#3-backend-services)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Event-Driven Architecture](#6-event-driven-architecture)
7. [Frontend Application](#7-frontend-application)
8. [Complete Flow Diagrams](#8-complete-flow-diagrams)
9. [Configuration & Setup](#9-configuration--setup)
10. [Technologies Used](#10-technologies-used)

---

## 1. Project Overview

This is a **comprehensive Task Management System** that combines:
- **Workflow Management** (teams, members, stages, tasks)
- **Automated Task Orchestration** via event-driven microservices
- **SLA Configuration and Monitoring**
- **Workload Calculation and Task Assignment**
- **Priority Rule Engine** for automatic priority assignment
- **Modern React Frontend** for user interaction

### Key Features
- ✅ Workflow creation and management
- ✅ Team and member management
- ✅ Task assignment and tracking
- ✅ SLA configuration with dynamic priority levels
- ✅ Automated task orchestration (workflow selection, SLA configuration, member assignment)
- ✅ Workload-based task assignment
- ✅ Priority rule engine with condition-based evaluation
- ✅ Kanban board for task visualization
- ✅ Real-time SLA monitoring
- ✅ Event-driven architecture with RabbitMQ

---

## 2. System Architecture

### Architecture Pattern
**Hybrid Architecture**: REST APIs for CRUD operations + Event-Driven Microservices for orchestration

### Two-Tier Architecture

#### **Tier 1: REST APIs (Data Management)**
- **SLAConfiguration.API** (Port 5001) - SLA CRUD operations
- **WorkflowManagement.API** (Port 5000) - Core workflow CRUD
- **Workload.API** (Port 5003) - Workload queries
- **PriorityRuleEngine.API** (Port 5002) - Priority rules management

#### **Tier 2: Event-Driven Microservices (Orchestration)**
- **APIGateway** (Port 5004) - Entry point for task creation
- **TaskService** (Port 5005) - Task lifecycle management
- **WorkflowService** (Port 5006) - Automated workflow selection
- **SLAManagerService** (Port 5007) - SLA configuration and monitoring
- **WorkloadService** (Port 5008) - Automated task assignment

### Communication Patterns
- **REST APIs**: HTTP/REST for frontend communication
- **Microservices**: RabbitMQ for event-driven communication
- **Databases**: PostgreSQL (multiple databases)

---

## 3. Backend Services

### 3.1 REST APIs

#### 3.1.1 WorkflowManagement.API (Port 5000)
**Purpose**: Core workflow management

**Controllers**:
- `TeamsController` - Team CRUD operations
- `MembersController` - Member CRUD operations
- `WorkflowsController` - Workflow CRUD operations
- `StagesController` - Stage CRUD operations
- `TasksController` - Task CRUD operations

**Services**:
- `TeamService` - Team business logic
- `MemberService` - Member business logic
- `WorkflowService` - Workflow business logic
- `StageService` - Stage business logic
- `TaskService` - Task business logic

**Database**: `WorkflowManagement`
**Tables**: Teams, Members, Workflows, Stages, Tasks

#### 3.1.2 SLAConfiguration.API (Port 5001)
**Purpose**: SLA configuration management

**Controllers**:
- `SLAConfigurationsController` - SLA CRUD operations

**Services**:
- `SLAService` - SLA business logic, JSON serialization/deserialization

**Database**: `WorkflowManagement`
**Tables**: SLAConfigurations

#### 3.1.3 Workload.API (Port 5003)
**Purpose**: Workload calculation and queries

**Controllers**:
- `WorkloadController` - Workload queries

**Services**:
- `WorkloadService` - Workload calculation logic

**Database**: `WorkflowManagement`
**Tables**: Workloads (history), Members, Tasks (reference)

#### 3.1.4 PriorityRuleEngine.API (Port 5002)
**Purpose**: Priority rule management

**Controllers**:
- `PriorityRulesController` - Priority rule CRUD operations

**Services**:
- `PriorityRuleService` - Rule evaluation and priority assignment
- `RuleEvaluator` - Condition evaluation engine

**Database**: `PriorityRuleEngine`
**Tables**: PriorityRules

**Event Handlers**:
- `WorkflowSelectedEventHandler` - Evaluates rules when workflow is selected

### 3.2 Event-Driven Microservices

#### 3.2.1 APIGateway (Port 5004)
**Purpose**: Entry point for automated task creation

**Controllers**:
- `TasksController` - Receives task creation requests

**Responsibilities**:
- Receives HTTP POST requests for task creation
- Generates TaskId and CorrelationId
- Publishes `TaskCreatedEvent` to RabbitMQ
- Returns HTTP 202 (Accepted) immediately

**Database**: None (stateless)

#### 3.2.2 TaskService (Port 5005)
**Purpose**: Task lifecycle management via events

**Database**: `TaskService`
**Tables**: Tasks

**Event Handlers**:
- `TaskCreatedEventHandler` - Creates task when TaskCreatedEvent received
- `WorkflowSelectedEventHandler` - Updates task with WorkflowId
- `SLAConfiguredEventHandler` - Updates task with SLA fields
- `TaskAssignedEventHandler` - Updates task with MemberId and status
- `TaskOverdueEventHandler` - Marks task as overdue

**Services**:
- `TaskService` - Task business logic and event handling

#### 3.2.3 WorkflowService (Port 5006)
**Purpose**: Automated workflow selection

**Database**: `WorkflowManagement` (read), `WorkflowManagement` (write to WorkflowSelections)

**Tables**:
- Reads: Workflows
- Writes: WorkflowSelections

**Event Handlers**:
- `TaskCreatedEventHandler` - Selects workflow based on task type

**Services**:
- `WorkflowSelectionService` - Workflow selection logic

**Publishes**: `WorkflowSelectedEvent`

#### 3.2.4 SLAManagerService (Port 5007)
**Purpose**: SLA configuration and deadline monitoring

**Database**: `SLAConfiguration` (read), `SLAConfiguration` (write to SLAAssignments)

**Tables**:
- Reads: SLAConfigurations
- Writes: SLAAssignments

**Event Handlers**:
- `WorkflowSelectedEventHandler` - Configures SLA when workflow is selected
- `PriorityAssignedEventHandler` - Updates SLA with assigned priority

**Services**:
- `SLAService` - SLA configuration logic
- `SLAMonitorService` - Background worker that monitors SLA deadlines

**Background Services**:
- `SLAMonitorService` - Polls every 1 minute for overdue tasks, publishes `TaskOverdueEvent`

**Publishes**: `SLAConfiguredEvent`

#### 3.2.5 WorkloadService (Port 5008)
**Purpose**: Automated task assignment based on workload

**Database**: `WorkflowManagement` (read), `WorkflowManagement` (write to TaskAssignments)

**Tables**:
- Reads: Members, Tasks
- Writes: TaskAssignments

**Event Handlers**:
- `SLAConfiguredEventHandler` - Assigns task to best member when SLA is configured

**Services**:
- `WorkloadEvaluationService` - Workload calculation and member selection

**Publishes**: `TaskAssignedEvent`

---

## 4. Database Schema

### 4.1 WorkflowManagement Database

#### Teams Table
```sql
CREATE TABLE "Teams" (
    "TeamId" SERIAL PRIMARY KEY,
    "TeamName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL
);
```

#### Members Table
```sql
CREATE TABLE "Members" (
    "MemberId" SERIAL PRIMARY KEY,
    "FirstName" VARCHAR(100) NOT NULL,
    "LastName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(200) NOT NULL,
    "TeamId" INTEGER NOT NULL,
    "Role" VARCHAR(100) NOT NULL,
    "SkillLevel" INTEGER NOT NULL,  -- 1-5 (1=Beginner, 5=Expert)
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId")
);
```

#### Workflows Table
```sql
CREATE TABLE "Workflows" (
    "WorkflowId" SERIAL PRIMARY KEY,
    "WorkflowName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "TeamId" INTEGER,  -- Optional workflow-level team
    "WorkflowJson" JSONB,  -- Complete workflow snapshot
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId")
);
```

#### Stages Table
```sql
CREATE TABLE "Stages" (
    "StageId" SERIAL PRIMARY KEY,
    "StageName" VARCHAR(200) NOT NULL,
    "StageOrder" INTEGER NOT NULL,
    "WorkflowId" INTEGER NOT NULL,
    "TeamId" INTEGER NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("WorkflowId") REFERENCES "Workflows"("WorkflowId"),
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId")
);
```

#### Tasks Table
```sql
CREATE TABLE "Tasks" (
    "TaskId" SERIAL PRIMARY KEY,
    "TaskName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "Status" VARCHAR(50) NOT NULL,  -- "Pending", "In Progress", "Completed", etc.
    "Priority" VARCHAR(50) NOT NULL,
    "DueDate" TIMESTAMP,
    "WorkflowId" INTEGER NOT NULL,
    "StageId" INTEGER,  -- Nullable
    "AssignedToMemberId" INTEGER,  -- Nullable
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("WorkflowId") REFERENCES "Workflows"("WorkflowId"),
    FOREIGN KEY ("StageId") REFERENCES "Stages"("StageId"),
    FOREIGN KEY ("AssignedToMemberId") REFERENCES "Members"("MemberId")
);
```

#### SLAConfigurations Table
```sql
CREATE TABLE "SLAConfigurations" (
    "SLAConfigurationId" SERIAL PRIMARY KEY,
    "WorkflowId" INTEGER NOT NULL UNIQUE,
    "PriorityLevelsJson" JSONB NOT NULL,  -- { "Critical": { "responseTime": 30 }, ... }
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("WorkflowId") REFERENCES "Workflows"("WorkflowId")
);
```

#### Workloads Table
```sql
CREATE TABLE "Workloads" (
    "WorkloadId" SERIAL PRIMARY KEY,
    "MemberId" INTEGER NOT NULL,
    "WorkloadScore" DOUBLE PRECISION NOT NULL,  -- 0-100
    "WorkloadStatus" VARCHAR(50) NOT NULL,  -- "Available", "PartiallyLoaded", "FullyLoaded", "Overloaded"
    "Efficiency" DOUBLE PRECISION NOT NULL,  -- 0-1
    "SkillLevel" INTEGER NOT NULL,
    "TaskCompletionRate" DOUBLE PRECISION NOT NULL,  -- 0-100%
    "ActiveTaskCount" INTEGER NOT NULL,
    "PendingTaskCount" INTEGER NOT NULL,
    "IsAvailable" BOOLEAN NOT NULL,
    "CalculatedAt" TIMESTAMP NOT NULL,
    "CreatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("MemberId") REFERENCES "Members"("MemberId")
);
```

### 4.2 TaskService Database

#### Tasks Table (Microservice)
```sql
CREATE TABLE "Tasks" (
    "TaskId" UUID PRIMARY KEY,
    "TaskName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "Priority" VARCHAR(50) NOT NULL,
    "TaskType" VARCHAR(50) NOT NULL,
    "Status" INTEGER NOT NULL,  -- 0=Created, 1=WorkflowSelected, 2=SLAConfigured, 3=Assigned, etc.
    "WorkflowId" INTEGER,
    "MemberId" INTEGER,
    "SLAConfigurationId" UUID,
    "SLAStartTime" TIMESTAMP,
    "SLADeadline" TIMESTAMP,
    "IsOverdue" BOOLEAN NOT NULL DEFAULT false,
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    -- Event tracking for idempotency
    "WorkflowSelectedEventId" UUID,
    "SLAConfiguredEventId" UUID,
    "TaskAssignedEventId" UUID,
    "TaskOverdueEventId" UUID
);
```

### 4.3 WorkflowManagement Database (Microservice Tables)

#### WorkflowSelections Table
```sql
CREATE TABLE "WorkflowSelections" (
    "SelectionId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL UNIQUE,
    "WorkflowId" INTEGER NOT NULL,
    "WorkflowName" VARCHAR(200) NOT NULL,
    "SelectionReason" VARCHAR(500),
    "SelectedAt" TIMESTAMP NOT NULL
);
```

#### TaskAssignments Table
```sql
CREATE TABLE "TaskAssignments" (
    "AssignmentId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL UNIQUE,
    "MemberId" INTEGER NOT NULL,
    "WorkloadScore" DOUBLE PRECISION NOT NULL,
    "AssignmentReason" VARCHAR(500),
    "AssignedAt" TIMESTAMP NOT NULL
);
```

### 4.4 SLAConfiguration Database

#### SLAAssignments Table
```sql
CREATE TABLE "SLAAssignments" (
    "SLAAssignmentId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL UNIQUE,
    "WorkflowId" INTEGER NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,
    "ResponseTimeMinutes" INTEGER NOT NULL,
    "SLAStartTime" TIMESTAMP NOT NULL,
    "SLADeadline" TIMESTAMP NOT NULL,
    "IsOverdue" BOOLEAN NOT NULL DEFAULT false
);
```

### 4.5 PriorityRuleEngine Database

#### PriorityRules Table
```sql
CREATE TABLE "PriorityRules" (
    "RuleId" SERIAL PRIMARY KEY,
    "RuleName" VARCHAR(200) NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,  -- "Critical", "High", "Medium", "Low"
    "Salience" INTEGER NOT NULL DEFAULT 0,  -- Rule priority (higher = evaluated first)
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "ConditionsJson" TEXT NOT NULL,  -- JSON structure for rule evaluation
    "MaxWorkloadScore" INTEGER,  -- Only apply if member workload < this
    "TeamName" VARCHAR(200),  -- Only for specific team
    "WorkflowId" INTEGER,  -- NULL = global rule, specific ID = workflow-specific
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. API Endpoints

### 5.1 WorkflowManagement.API (Port 5000)

#### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/{id}` - Get team by ID
- `POST /api/teams` - Create team
- `PUT /api/teams/{id}` - Update team
- `DELETE /api/teams/{id}` - Delete team
- `GET /api/teams/{id}/members` - Get team members
- `GET /api/teams/{id}/workflows` - Get team workflows

#### Members
- `GET /api/members` - Get all members
- `GET /api/members/{id}` - Get member by ID
- `POST /api/members` - Create member
- `PUT /api/members/{id}` - Update member
- `DELETE /api/members/{id}` - Delete member
- `GET /api/members/{id}/tasks` - Get member's tasks

#### Workflows
- `GET /api/workflows` - Get all workflows
- `GET /api/workflows/{id}` - Get workflow by ID
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow
- `GET /api/workflows/{id}/stages` - Get workflow stages
- `GET /api/workflows/{id}/tasks` - Get workflow tasks
- `GET /api/workflows/{id}/json` - Get workflow JSON
- `POST /api/workflows/{id}/update-json` - Update workflow JSON

#### Stages
- `GET /api/stages` - Get all stages
- `GET /api/stages/{id}` - Get stage by ID
- `POST /api/stages` - Create stage
- `PUT /api/stages/{id}` - Update stage
- `DELETE /api/stages/{id}` - Delete stage
- `GET /api/stages/workflow/{workflowId}` - Get stages by workflow

#### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{id}` - Get task by ID
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/workflow/{workflowId}` - Get tasks by workflow
- `GET /api/tasks/stage/{stageId}` - Get tasks by stage
- `GET /api/tasks/member/{memberId}` - Get tasks by member

### 5.2 SLAConfiguration.API (Port 5001)

#### SLA Configurations
- `GET /api/sla-configurations` - Get all SLA configurations
- `GET /api/sla-configurations/workflow/{workflowId}` - Get SLA for specific workflow
- `POST /api/sla-configurations` - Create new SLA configuration
- `PUT /api/sla-configurations/workflow/{workflowId}` - Update SLA configuration
- `DELETE /api/sla-configurations/workflow/{workflowId}` - Delete SLA configuration

### 5.3 Workload.API (Port 5003)

#### Workload
- `GET /api/workload/{memberId}` - Get workload summary for a member

### 5.4 PriorityRuleEngine.API (Port 5002)

#### Priority Rules
- `GET /api/priority-rules` - Get all priority rules
- `GET /api/priority-rules/{id}` - Get priority rule by ID
- `POST /api/priority-rules` - Create priority rule
- `PUT /api/priority-rules/{id}` - Update priority rule
- `DELETE /api/priority-rules/{id}` - Delete priority rule
- `GET /api/priority-rules/workflow/{workflowId}` - Get rules for workflow

### 5.5 APIGateway (Port 5004)

#### Tasks (Event-Driven)
- `POST /api/tasks` - Create task (triggers orchestration flow)
  - Returns HTTP 202 (Accepted) immediately
  - Publishes `TaskCreatedEvent` to RabbitMQ

---

## 6. Event-Driven Architecture

### 6.1 RabbitMQ Configuration

#### Exchanges (Direct, Durable)
- `task.exchange` - Task-related events
- `workflow.exchange` - Workflow-related events
- `sla.exchange` - SLA-related events
- `workload.exchange` - Workload-related events

#### Queues (Durable, with DLQ)
- `task.created.queue` → `task.created.dlq`
- `task.created.forpriority.queue` → DLQ (Priority Rule Engine)
- `task.created.workflow.queue` → DLQ (Workflow Service)
- `priority.assigned.queue` → DLQ
- `priority.assigned.task.queue` → DLQ (Task Service)
- `priority.assigned.sla.queue` → DLQ (SLA Manager Service)
- `workflow.selected.queue` → `workflow.selected.dlq`
- `workflow.selected.priority.queue` → DLQ (Priority Rule Engine)
- `sla.configured.queue` → `sla.configured.dlq`
- `sla.configured.workload.queue` → DLQ (Workload Service)
- `task.assigned.queue` → `task.assigned.dlq`
- `task.overdue.queue` → `task.overdue.dlq`
- `task.status.updated.queue` → `task.status.updated.dlq`

#### Routing Keys
- `task.created` - Task created event
- `task.created.forpriority` - Task created for priority evaluation
- `priority.assigned` - Priority assigned event
- `workflow.selected` - Workflow selected event
- `sla.configured` - SLA configured event
- `task.assigned` - Task assigned event
- `task.overdue` - Task overdue event
- `task.status.updated` - Task status updated event

### 6.2 Event Contracts

#### TaskCreatedEvent
```csharp
{
    TaskId: Guid,
    TaskName: string,
    Description: string?,
    Priority: string,  // Will be assigned by rule engine
    TaskType: string,
    TaskData: Dictionary<string, object>?,
    PriorityAssigned: bool,
    CreatedAt: DateTime,
    CorrelationId: Guid
}
```

#### WorkflowSelectedEvent
```csharp
{
    TaskId: Guid,
    WorkflowId: int,
    WorkflowName: string,
    SelectedAt: DateTime,
    CorrelationId: Guid,
    TaskData: Dictionary<string, object>?
}
```

#### PriorityAssignedEvent
```csharp
{
    TaskId: Guid,
    WorkflowId: int,
    Priority: string,
    AssignedBy: string,  // "RuleEngine"
    RuleId: int?,
    RuleName: string?,
    OriginalTaskData: Dictionary<string, object>?,
    CorrelationId: Guid,
    AssignedAt: DateTime
}
```

#### SLAConfiguredEvent
```csharp
{
    TaskId: Guid,
    WorkflowId: int,
    Priority: string,
    ResponseTimeMinutes: int,
    SLAStartTime: DateTime,
    SLADeadline: DateTime,
    CorrelationId: Guid
}
```

#### TaskAssignedEvent
```csharp
{
    TaskId: Guid,
    MemberId: int,
    MemberName: string,
    MemberEmail: string,
    WorkloadScore: double,
    AssignedAt: DateTime,
    CorrelationId: Guid
}
```

#### TaskOverdueEvent
```csharp
{
    TaskId: Guid,
    MemberId: int,
    SLADeadline: DateTime,
    BreachedAt: DateTime,
    MinutesOverdue: int,
    CorrelationId: Guid
}
```

### 6.3 Event Flow

```
1. APIGateway receives POST /api/tasks
   ↓ Publishes TaskCreatedEvent

2. TaskService consumes TaskCreatedEvent
   ↓ Creates task in database (Status: Created)

3. WorkflowService consumes TaskCreatedEvent
   ↓ Selects workflow
   ↓ Publishes WorkflowSelectedEvent

4. PriorityRuleEngine consumes WorkflowSelectedEvent
   ↓ Evaluates priority rules
   ↓ Publishes PriorityAssignedEvent

5. TaskService consumes PriorityAssignedEvent
   ↓ Updates task priority

6. SLAManagerService consumes PriorityAssignedEvent
   ↓ Configures SLA
   ↓ Publishes SLAConfiguredEvent

7. TaskService consumes SLAConfiguredEvent
   ↓ Updates task with SLA fields (Status: SLAConfigured)

8. WorkloadService consumes SLAConfiguredEvent
   ↓ Evaluates workload for all members
   ↓ Assigns to best member
   ↓ Publishes TaskAssignedEvent

9. TaskService consumes TaskAssignedEvent
   ↓ Updates task with MemberId (Status: Assigned)

10. SLAMonitorService (Background Worker)
    ↓ Polls every 1 minute
    ↓ Checks for overdue tasks
    ↓ Publishes TaskOverdueEvent if deadline breached

11. TaskService consumes TaskOverdueEvent
    ↓ Marks task as overdue (Status: Overdue)
```

### 6.4 Idempotency

Each event handler implements idempotency:
1. Checks if event was already processed (using event ID stored in database)
2. If processed, logs warning and returns early
3. If not processed, processes event and stores event ID

**Event ID Storage**:
- `WorkflowSelectedEventId` in Task entity
- `SLAConfiguredEventId` in Task entity
- `TaskAssignedEventId` in Task entity
- `TaskOverdueEventId` in Task entity

---

## 7. Frontend Application

### 7.1 Technology Stack
- **React** 18.2.0 with TypeScript
- **React Router DOM** 6.21.1
- **Axios** 1.6.2
- **Tailwind CSS** 3.4.0
- **React Icons** 4.12.0
- **React Toastify** 9.1.3
- **@dnd-kit** (Drag and Drop) 6.1.0
- **React Hook Form** 7.49.2

### 7.2 Project Structure

```
frontend/workflow/src/
├── components/          # Reusable UI components
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── LoadingSpinner.tsx
│   ├── SLAConfigure.tsx      # SLA configuration form
│   ├── WorkflowCreate.tsx    # Create workflow form
│   ├── WorkflowEdit.tsx      # Edit workflow & stages
│   ├── WorkflowStagesView.tsx # Stage visualization
│   ├── WorkflowWizard.tsx    # Multi-step workflow creation
│   ├── KanbanBoard.tsx       # Kanban board for tasks
│   ├── KanbanColumn.tsx      # Kanban column component
│   ├── TaskCard.tsx          # Task card component
│   └── ConditionBuilder.tsx # Priority rule condition builder
│
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Workflows.tsx   # Workflows list
│   ├── WorkflowDetail.tsx # Workflow detail view
│   ├── Teams.tsx       # Teams management
│   ├── Members.tsx     # Members management
│   ├── Tasks.tsx       # Tasks management
│   ├── SLAConfiguration.tsx # SLA configuration page
│   ├── WorkloadConfiguration.tsx # Workload monitoring
│   └── PriorityRules.tsx # Priority rules management
│
├── services/           # API service clients
│   ├── api.ts         # Base API client (WorkflowManagement API)
│   ├── slaApi.ts      # SLA API client
│   ├── workloadService.ts # Workload API client
│   ├── priorityRulesApi.ts # Priority Rules API client
│   ├── workflowService.ts
│   ├── teamService.ts
│   ├── memberService.ts
│   ├── stageService.ts
│   └── taskService.ts
│
├── hooks/              # Custom React hooks
│   ├── useWorkflows.ts
│   ├── useTeams.ts
│   └── useMembers.ts
│
├── types/              # TypeScript type definitions
│   └── index.ts
│
└── App.tsx            # Main app component with routing
```

### 7.3 Routes

- `/` - Redirects to `/workflows`
- `/workflows` - Workflows list page
- `/workflows/:id` - Workflow detail page
- `/teams` - Teams management page
- `/members` - Members management page
- `/tasks` - Tasks management page
- `/sla-configuration` - SLA configuration page
- `/workload-configuration` - Workload monitoring page
- `/priority-rules` - Priority rules management page

### 7.4 API Service Configuration

**Base URLs**:
- WorkflowManagement API: `http://localhost:5000`
- SLA Configuration API: `http://localhost:5001`
- Priority Rules API: `http://localhost:5002`
- Workload API: `http://localhost:5003`

### 7.5 Key Components

#### WorkflowWizard
Multi-step workflow creation:
1. Workflow Name
2. Description
3. Add Stages
4. Select Team
5. Add Tasks

#### KanbanBoard
Drag-and-drop Kanban board for task management:
- Columns represent stages
- Tasks can be dragged between stages
- Real-time updates

#### SLAConfigure
SLA configuration form:
- Dynamic priority levels
- Response time configuration
- Workflow selection

#### PriorityRules
Priority rule management:
- Create/edit/delete rules
- Condition builder
- Salience configuration
- Workflow-specific or global rules

---

## 8. Complete Flow Diagrams

### 8.1 Task Creation Flow (Event-Driven)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/tasks
       ▼
┌─────────────┐
│ APIGateway  │ Generates TaskId, CorrelationId
│  (Port 5004)│ Publishes TaskCreatedEvent
└──────┬──────┘ Returns HTTP 202
       │
       ▼
┌─────────────────────────────────────┐
│         RabbitMQ                     │
│    task.exchange / task.created      │
└──────┬──────────────────┬────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│TaskService  │    │WorkflowService│
│(Port 5005)  │    │(Port 5006)  │
└──────┬──────┘    └──────┬───────┘
       │                  │
       │ Creates Task     │ Selects Workflow
       │ Status: Created  │ Publishes WorkflowSelectedEvent
       │                  │
       │                  ▼
       │            ┌─────────────────────┐
       │            │    RabbitMQ          │
       │            │ workflow.exchange    │
       │            └──────┬───────────────┘
       │                  │
       │                  ▼
       │            ┌─────────────┐
       │            │PriorityRule │
       │            │Engine (5002)│
       │            └──────┬──────┘
       │                  │
       │                  │ Evaluates Rules
       │                  │ Publishes PriorityAssignedEvent
       │                  │
       │                  ▼
       │            ┌─────────────┐
       │            │TaskService  │ Updates Priority
       │            └──────┬───────┘
       │                  │
       │                  ▼
       │            ┌─────────────┐
       │            │SLAManager   │
       │            │Service(5007) │
       │            └──────┬───────┘
       │                  │
       │                  │ Configures SLA
       │                  │ Publishes SLAConfiguredEvent
       │                  │
       │                  ▼
       │            ┌─────────────┐
       │            │TaskService │ Updates SLA Fields
       │            └──────┬───────┘
       │                  │
       │                  ▼
       │            ┌─────────────┐
       │            │WorkloadService│
       │            │(Port 5008) │
       │            └──────┬───────┘
       │                  │
       │                  │ Evaluates Workload
       │                  │ Assigns to Best Member
       │                  │ Publishes TaskAssignedEvent
       │                  │
       │                  ▼
       └──────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │TaskService  │ Updates MemberId
                  │             │ Status: Assigned
                  └─────────────┘
```

### 8.2 SLA Monitoring Flow

```
┌─────────────────────┐
│ SLAMonitorService   │ Background Worker
│ (Port 5007)         │ Runs every 1 minute
└──────────┬──────────┘
           │
           │ Polls SLAAssignments table
           │ Checks: SLADeadline < Now AND IsOverdue = false
           │
           ▼
    ┌─────────────┐
    │ Found       │
    │ Overdue?    │
    └──┬──────┬───┘
       │      │
    Yes│      │No
       │      │
       ▼      │
┌─────────────┐│
│ Mark as     ││
│ Overdue     ││
│ Publish     ││
│TaskOverdueEvent│
└──────┬──────┘│
       │      │
       └──────┘
           │
           ▼
    ┌─────────────┐
    │  RabbitMQ   │
    │ sla.exchange│
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │TaskService │ Updates Status to Overdue
    └────────────┘
```

### 8.3 Workload Calculation Flow

```
┌─────────────┐
│ Workload    │
│ Service     │
└──────┬──────┘
       │
       │ Receives SLAConfiguredEvent
       │
       ▼
┌─────────────┐
│ Query       │
│ Members     │
│ from DB     │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│ For each member, calculate:         │
│ 1. Efficiency (30% weight)          │
│ 2. Skill Level (20% weight)          │
│ 3. Task Completion Rate (20% weight) │
│ 4. Active Task Load (20% weight)     │
│ 5. Availability (10% weight)         │
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────┐
│ Calculate   │
│ Workload    │
│ Score       │
│ (Weighted)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Select      │
│ Member with │
│ Lowest      │
│ Score       │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Save to     │
│ TaskAssignments│
│ Publish     │
│TaskAssignedEvent│
└─────────────┘
```

### 8.4 Priority Rule Evaluation Flow

```
┌─────────────────────┐
│ WorkflowSelected    │
│ Event Received      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ PriorityRuleEngine │
│ Service             │
└──────────┬──────────┘
           │
           │ Get active rules for workflow
           │ (Ordered by salience DESC)
           ▼
    ┌─────────────┐
    │ For each    │
    │ rule:       │
    └──┬──────┬───┘
       │      │
       ▼      │
┌─────────────┐│
│ Evaluate    ││
│ Conditions  ││
│ JSON        ││
└──┬──────┬───┘│
   │      │   │
Match│  No│   │
   │      │   │
   ▼      │   │
┌─────────────┐││
│ Assign      │││
│ Priority    │││
│ Publish     │││
│PriorityAssignedEvent││
└──────┬──────┘││
       │      ││
       └──────┘│
           │   │
           └───┘
```

---

## 9. Configuration & Setup

### 9.1 Prerequisites
- .NET 8 SDK
- Node.js 16+ and npm
- PostgreSQL 12+
- RabbitMQ (Docker or installed)

### 9.2 Database Setup

#### Create Databases
```sql
CREATE DATABASE "WorkflowManagement";
CREATE DATABASE "TaskService";
CREATE DATABASE "SLAConfiguration";
CREATE DATABASE "PriorityRuleEngine";
```

#### Connection Strings
All services use connection strings in `appsettings.json`:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=password"
  }
}
```

### 9.3 RabbitMQ Setup

#### Docker (Recommended)
```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

#### Access Management UI
- URL: `http://localhost:15672`
- Username: `guest`
- Password: `guest`

### 9.4 Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| WorkflowManagement.API | 5000 | Core workflow CRUD |
| SLAConfiguration.API | 5001 | SLA CRUD |
| PriorityRuleEngine.API | 5002 | Priority rules CRUD |
| Workload.API | 5003 | Workload queries |
| APIGateway | 5004 | Task orchestration entry |
| TaskService | 5005 | Task lifecycle |
| WorkflowService | 5006 | Workflow selection |
| SLAManagerService | 5007 | SLA management |
| WorkloadService | 5008 | Task assignment |
| Frontend | 3000 | React app |

### 9.5 Running Services

#### Backend Services
```bash
# Start each service
cd backend/WorkflowManagement.API && dotnet run
cd backend/SLAConfiguration.API && dotnet run
cd backend/PriorityRuleEngine.API && dotnet run
cd backend/Workload.API && dotnet run
cd backend/APIGateway && dotnet run
cd backend/TaskService && dotnet run
cd backend/WorkflowService && dotnet run
cd backend/SLAManagerService && dotnet run
cd backend/WorkloadService && dotnet run
```

#### Frontend
```bash
cd frontend/workflow
npm install
npm start
```

### 9.6 CORS Configuration
All backend APIs are configured to allow requests from `http://localhost:3000`.

---

## 10. Technologies Used

### Backend
- **.NET 8** - Framework
- **ASP.NET Core Web API** - Web framework
- **Entity Framework Core** - ORM
- **PostgreSQL** - Database
- **RabbitMQ** - Message broker
- **AutoMapper** - Object mapping
- **Microsoft.Extensions.Logging** - Logging

### Frontend
- **React** 18.2.0 - UI framework
- **TypeScript** 4.9.5 - Type safety
- **Tailwind CSS** 3.4.0 - Styling
- **React Router DOM** 6.21.1 - Routing
- **Axios** 1.6.2 - HTTP client
- **React Icons** 4.12.0 - Icons
- **React Toastify** 9.1.3 - Notifications
- **@dnd-kit** 6.1.0 - Drag and Drop
- **React Hook Form** 7.49.2 - Form handling

### Infrastructure
- **PostgreSQL** 12+ - Database
- **RabbitMQ** 3.x - Message broker
- **Docker** (optional) - Containerization

---

## Summary

This system provides:
1. **REST APIs** for CRUD operations (frontend interaction)
2. **Event-driven microservices** for automated orchestration
3. **Priority rule engine** for automatic priority assignment
4. **SLA configuration and monitoring** for deadline tracking
5. **Workload-based task assignment** for optimal resource utilization
6. **Modern React frontend** for user interaction

The architecture supports both **manual operations** (via REST APIs) and **automated orchestration** (via event-driven microservices), providing flexibility and scalability.

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: System Documentation

