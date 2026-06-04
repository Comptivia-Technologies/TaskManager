# Complete Project Documentation

## 📋 Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Backend Services](#3-backend-services)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Event-Driven Architecture](#6-event-driven-architecture)
7. [Stage Orchestration System](#7-stage-orchestration-system)
8. [Automatic Reassignment System](#8-automatic-reassignment-system)
9. [Frontend Application](#9-frontend-application)
10. [Complete Flow Diagrams](#10-complete-flow-diagrams)
11. [Configuration & Setup](#11-configuration--setup)
12. [Technologies Used](#12-technologies-used)
13. [Implementation Status](#13-implementation-status)
14. [Multi-Cloud Event Bus Architecture](#14-multi-cloud-event-bus-architecture)
15. [Migration Guide: RabbitMQ to AWS EventBridge](#15-migration-guide-rabbitmq-to-aws-eventbridge)

---

## 1. Project Overview

This is a **comprehensive Task Management System** with **Generic Workflow Orchestration** that combines:
- **Workflow Management** (teams, members, stages, tasks)
- **Automated Task Orchestration** via event-driven microservices
- **Stage-Based Workflow Orchestration** (Process and Escalation workflows)
- **SLA Configuration and Monitoring**
- **Workload Calculation and Task Assignment**
- **Automatic Team Reassignment** when tasks move between stages
- **Priority Rule Engine** for automatic priority assignment
- **Modern React Frontend** for user interaction

### Key Features
- ✅ Workflow creation and management
- ✅ Team and member management
- ✅ Task assignment and tracking
- ✅ **Stage-based orchestration** (Process & Escalation workflows)
- ✅ **Automatic reassignment** when stages change teams
- ✅ SLA configuration with dynamic priority levels
- ✅ Automated task orchestration (workflow selection, SLA configuration, member assignment)
- ✅ Workload-based task assignment
- ✅ Priority rule engine with condition-based evaluation
- ✅ Kanban board for task visualization
- ✅ **Task work-history audit** (per-task timeline API + UI modal)
- ✅ **Member task view** (assigned + past stage work in one table)
- ✅ Real-time SLA monitoring
- ✅ **Multi-cloud event bus architecture** (AWS EventBridge, Azure Service Bus, GCP Pub/Sub)
- ✅ **Factory pattern for cloud provider abstraction**
- ✅ **EventBridge Scheduler for SLA deadlines and escalation timeouts**

### Workflow Types Supported

| Type | Transition | Use Case |
|------|------------|----------|
| **Process** | On completion (manual/API) | ERP-style workflows where tasks progress on user action |
| **Escalation** | On timeout (automatic) | Ticketing systems where tasks escalate if not handled |

---

## 2. System Architecture

### Architecture Pattern
**Hybrid Architecture**: REST APIs for CRUD operations + Event-Driven Microservices for orchestration

### Two-Tier Architecture

#### **Tier 1: REST APIs (Data Management)**
- **SLAConfiguration.API** (Port 5002) - SLA CRUD operations
- **WorkflowManagement.API** (Port 5000) - Core workflow CRUD
- **Workload.API** (Port 5003) - Workload queries
- **PriorityRuleEngine.API** (Port 5010) - Priority rules management

#### **Tier 2: Event-Driven Microservices (Orchestration)**
- **APIGateway** (Port 5004) - **Single entry point** for all frontend requests
  - Reverse proxy routing (YARP) to all backend services
  - Pure routing layer (no business logic, no event publishing)
- **TaskService** (Port 5005) - Task lifecycle management + Task creation orchestration + Stage completion API
- **WorkflowService** (Port 5006) - Automated workflow selection + Stage orchestration
- **SLAManagerService** (Port 5007) - SLA configuration and monitoring
- **WorkloadService** (Port 5008) - Automated task assignment + Stage reassignment

### Communication Patterns
- **Frontend → API Gateway**: All HTTP requests route through API Gateway (Port 5004)
- **API Gateway → Backend Services**: Reverse proxy routing using YARP
- **Task Creation**: API Gateway → TaskService → Event Bus (event-driven)
- **Other CRUD**: API Gateway → Direct proxy to respective services
- **Microservices**: Event Bus (AWS/Azure/GCP) for event-driven communication
- **Databases**: PostgreSQL (multiple databases)

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                                │
│                              Port 3000                                       │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTP (All requests)
                                  │
                    ┌─────────────▼─────────────┐
                    │      API GATEWAY          │
                    │      (Port 5004)          │
                    │  - Reverse Proxy (YARP)   │
                    │  - Task Creation → Queue  │
                    └─────────────┬─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────────────┐
          │                       │                               │
          ▼                       ▼                               ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────────────┐
│ WorkflowMgmt    │   │ SLAConfig       │   │ Other REST APIs                 │
│ API (5000)      │   │ API (5002)      │   │ PriorityRule(5010) Workload(5003)│
└─────────────────┘   └─────────────────┘   └─────────────────────────────────┘
          │                       │                               │
          └───────────────────────┼───────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │        PostgreSQL         │
                    │   (Multiple Databases)    │
                    └───────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        EVENT-DRIVEN MICROSERVICES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │APIGateway│───▶│TaskService  │◀──▶│WorkflowSvc  │◀──▶│WorkloadSvc  │     │
│   │  (5004) │    │   (5005)    │    │   (5006)    │    │   (5008)    │     │
│   └─────────┘    └─────────────┘    └─────────────┘    └─────────────┘     │
│        │              ▲ │                │ ▲                │ ▲             │
│        │              │ │                │ │                │ │             │
│        │              │ │    ┌───────────┘ │                │ │             │
│        └──────────────┼─┼────┼─────────────┼────────────────┼─┘             │
│                       │ │    │             │                │               │
│                       │ ▼    ▼             │                ▼               │
│                    ┌──┴──────────────────────────────────────┐              │
│                    │              RabbitMQ                   │              │
│                    │         (Message Broker)                │              │
│                    └─────────────────────────────────────────┘              │
│                                    ▲                                        │
│                                    │                                        │
│                       ┌────────────┴────────────┐                          │
│                       │      SLAManagerSvc      │                          │
│                       │         (5007)          │                          │
│                       └─────────────────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Backend Services

### 3.1 REST APIs

#### 3.1.1 WorkflowManagement.API (Port 5000)
**Purpose**: Core workflow management

**Controllers**:
- `TeamsController` - Team CRUD operations
- `MembersController` - Member CRUD operations
- `WorkflowsController` - Workflow CRUD operations
- `StagesController` - Stage CRUD operations (with StageType, TransitionPolicy)
- `TasksController` - Task CRUD operations, task audit read/write, member task summary

**Services**:
- `TeamService` - Team business logic
- `MemberService` - Member business logic (supports null TeamId)
- `WorkflowService` - Workflow business logic
- `StageService` - Stage business logic
- `TaskService` - Task business logic
- `TaskAuditService` - Task work-history timeline (read + idempotent write)

**Database**: `WorkflowManagement`
**Tables**: Teams, Members, Workflows, Stages, Tasks, TaskAuditEntries

**Task audit (Option B)**:
- `GET /api/tasks/{id}/audit` — ordered timeline (`tasks.view`)
- `POST /api/tasks/{id}/audit` — idempotent append by `eventId` (`tasks.manage`; TaskService)
- Writes from TaskService `TaskAuditRecorder` after stage complete/escalate, assignment, task completed
- Action types: `Assigned`, `Reassigned`, `StageCompleted`, `StageEscalated`, `TaskCompleted`
- Not recorded: overdue (`TaskOverdue` handler unchanged)

**DTO enrichment**: `TaskReadDtoEnricher` fills `stageName`, `workflowName`, `assignedToMemberName` for all task list endpoints (including `GET /api/members/{id}/tasks`)

#### 3.1.2 SLAConfiguration.API (Port 5002)
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

**Schema note**: Member/Task reference models do not use `OrganizationId` (column removed from shared WorkflowManagement DB via bootstrap). Workload.API EF models align with this schema.

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
**Purpose**: Single entry point for all frontend requests (pure routing layer)

**Controllers**:
- `TasksController` - Task details retrieval (GET endpoints only, enriches data from both TaskService and WorkflowManagement.API)

**Reverse Proxy Configuration** (YARP):
- Routes all frontend requests to backend services:
  - `/api/workflows/*` → WorkflowManagement.API (5000)
  - `/api/teams/*` → WorkflowManagement.API (5000)
  - `/api/members/*` → WorkflowManagement.API (5000)
  - `/api/stages/*` → WorkflowManagement.API (5000)
  - `/api/tasks/*` (GET/PUT/DELETE) → WorkflowManagement.API (5000)
  - `/api/task-service/*` (POST/GET/PUT/DELETE) → TaskService (5005)
  - `/api/sla-configurations/*` → SLAConfiguration.API (5002)
  - `/api/priority-rules/*` → PriorityRuleEngine.API (5010)
  - `/api/workload/*` → Workload.API (5003)

**Auth proxy** (AuthController): Proxies auth-related requests to external Auth service (`AuthService:BaseUrl`). For `GET /api/auth/organizationuser`, gateway reads `tenant_id` from JWT (claims `tenant_id` or `firebase.tenant`, or `firebase` JSON claim) and forwards request with `product_id` (query) and `tenant_id` to Auth service.

**Implementation note**: `Auth:ExcludedPathPrefixes` must exclude only paths that do not require JWT (e.g. `/api/auth/tenant`, `/api/roles/all`), not the entire `/api/auth` prefix. That way `/api/auth/organizationuser` is not excluded and the middleware runs for it, setting `TenantId` from the JWT so the controller can add `tenant_id` to the downstream request.

**Responsibilities**:
- **Reverse Proxy**: Routes all requests to appropriate backend services
- **No Business Logic**: Gateway is a thin routing layer only
- **No Event Publishing**: All orchestration handled by microservices
- **Single Entry Point**: All frontend services point to API Gateway (port 5004)

**Database**: None (stateless)

**Technology**: YARP (Yet Another Reverse Proxy) for routing

#### 3.2.2 TaskService (Port 5005)
**Purpose**: Task lifecycle management via events + Task creation orchestration + Stage completion API

**Database**: `TaskService`
**Tables**: Tasks

**Event Handlers**:
- `TaskCreatedEventHandler` - Creates task when TaskCreatedEvent received
- `WorkflowSelectedEventHandler` - Updates task with WorkflowId
- `PriorityAssignedEventHandler` - Updates task priority
- `SLAConfiguredEventHandler` - Updates task with SLA fields
- `TaskAssignedEventHandler` - Updates task with MemberId and status
- `TaskOverdueEventHandler` - Marks task as overdue
- `TaskStageStartedEventHandler` - Updates task with stage info, triggers reassignment if team changes
- `TaskStageCompletedEventHandler` - Updates task when stage completed
- `TaskStageEscalationTriggeredEventHandler` - Updates task when escalation triggered
- `TaskStageEscalatedEventHandler` - Updates task when manually escalated
- `TaskCompletedEventHandler` - Marks task as fully completed

**Services**:
- `TaskService` - Task business logic, task creation orchestration, stage completion API
- `TaskAuditRecorder` - Best-effort HTTP POST to WorkflowManagement audit API after lifecycle actions

**Event Publishing**:
- `TaskCreatedEvent` - Published when task is created (entry point for orchestration flow)

**API Endpoints**:
- `POST /api/task-service` - Create task (orchestrates task creation, returns taskId only)
- `POST /api/task-service/complete-stage/{id}` - Complete current stage and transition to next
- `POST /api/task-service/escalate-stage/{id}` - Manually escalate task to next stage

#### 3.2.3 WorkflowService (Port 5006)
**Purpose**: Automated workflow selection + Stage orchestration

**Database**: `WorkflowManagement` (read), WorkflowSelections (write)

**Tables**:
- Reads: Workflows, Stages
- Writes: WorkflowSelections

**Event Handlers**:
- `TaskCreatedEventHandler` - Selects workflow based on task type
- `TaskAssignedEventHandler` - Starts task in first stage
- `TaskStageCompletedEventHandler` - Handles stage completion, transitions to next
- `TaskStageEscalationTriggeredEventHandler` - Handles escalation timeout

**Services**:
- `WorkflowSelectionService` - Workflow selection logic
- `StageOrchestrationService` - Stage transition logic

**Background Services**: 
- Primary: Scheduled events via EventBridge Scheduler (no polling)
- Fallback: `StageEscalationMonitorService` - Polls every 60 seconds as backup (if scheduled events fail)

**Publishes**: `WorkflowSelectedEvent`, `TaskStageStartedEvent`, `TaskCompletedEvent`

#### 3.2.4 SLAManagerService (Port 5007)
**Purpose**: SLA configuration and deadline monitoring

**Database**: `WorkflowManagement` (read and write)

**Tables**:
- Reads: SLAConfigurations
- Writes: SLAAssignments

**Event Handlers**:
- `WorkflowSelectedEventHandler` - Configures SLA when workflow is selected
- `PriorityAssignedEventHandler` - Updates SLA with assigned priority

**Services**:
- `SLAService` - SLA configuration logic

**Background Services**: 
- Primary: Scheduled events via EventBridge Scheduler (no polling)
- Fallback: `SLAMonitorService` - Polls every 1 minute as backup (if scheduled events fail)

**Publishes**: `SLAConfiguredEvent`, `TaskOverdueEvent`

#### 3.2.5 WorkloadService (Port 5008)
**Purpose**: Automated task assignment based on workload + Stage reassignment

**Database**: `WorkflowManagement` (read), TaskAssignments (write)

**Tables**:
- Reads: Members, Tasks, Workflows, Stages
- Writes: TaskAssignments

**Event Handlers**:
- `SLAConfiguredEventHandler` - Assigns task to best member when SLA is configured
- `TaskStatusUpdatedEventHandler` - Updates workload when task status changes
- `TaskStageReassignmentNeededEventHandler` - Reassigns task when stage changes to different team

**Services**:
- `WorkloadEvaluationService` - Workload calculation, member selection, reassignment

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
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

#### Members Table
```sql
CREATE TABLE "Members" (
    "MemberId" SERIAL PRIMARY KEY,
    "FirstName" VARCHAR(100) NOT NULL,
    "LastName" VARCHAR(100) NOT NULL,
    "Email" VARCHAR(200) NOT NULL,
    "TeamId" INTEGER,  -- Nullable: members can exist without team assignment
    "Role" VARCHAR(100) NOT NULL,
    "SkillLevel" INTEGER NOT NULL,  -- 1-5 (1=Beginner, 5=Expert)
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId") ON DELETE RESTRICT
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
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId")
);
```

#### Stages Table (Enhanced for Stage Orchestration)
```sql
CREATE TABLE "Stages" (
    "StageId" SERIAL PRIMARY KEY,
    "StageName" VARCHAR(200) NOT NULL,
    "StageOrder" INTEGER NOT NULL,
    "WorkflowId" INTEGER NOT NULL,
    "TeamId" INTEGER NOT NULL,
    "StageType" INTEGER NOT NULL DEFAULT 0,  -- 0=Process, 1=Escalation
    "TransitionPolicy" INTEGER NOT NULL DEFAULT 0,  -- 0=OnComplete, 1=OnTimeout, 2=Manual
    "TimeoutMinutes" INTEGER,  -- Required for Escalation stages
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY ("WorkflowId") REFERENCES "Workflows"("WorkflowId"),
    FOREIGN KEY ("TeamId") REFERENCES "Teams"("TeamId")
);
```

#### Tasks Table (WorkflowManagement)
```sql
CREATE TABLE "Tasks" (
    "TaskId" SERIAL PRIMARY KEY,
    "TaskName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "Status" VARCHAR(50) NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,
    "DueDate" TIMESTAMP WITH TIME ZONE,
    "WorkflowId" INTEGER NOT NULL,
    "StageId" INTEGER,
    "AssignedToMemberId" INTEGER,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
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
    "PriorityLevelsJson" JSONB NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY ("WorkflowId") REFERENCES "Workflows"("WorkflowId")
);
```

#### Workloads Table
```sql
CREATE TABLE "Workloads" (
    "WorkloadId" SERIAL PRIMARY KEY,
    "MemberId" INTEGER NOT NULL,
    "WorkloadScore" DOUBLE PRECISION NOT NULL,
    "WorkloadStatus" VARCHAR(50) NOT NULL,
    "Efficiency" DOUBLE PRECISION NOT NULL,
    "SkillLevel" INTEGER NOT NULL,
    "TaskCompletionRate" DOUBLE PRECISION NOT NULL,
    "ActiveTaskCount" INTEGER NOT NULL,
    "PendingTaskCount" INTEGER NOT NULL,
    "IsAvailable" BOOLEAN NOT NULL,
    "CalculatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    FOREIGN KEY ("MemberId") REFERENCES "Members"("MemberId")
);
```

#### TaskAuditEntries Table (WorkflowManagement)
```sql
CREATE TABLE "TaskAuditEntries" (
    "AuditId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL REFERENCES "Tasks"("TaskId") ON DELETE CASCADE,
    "EventId" UUID NOT NULL UNIQUE,
    "ActionType" VARCHAR(50) NOT NULL,
    "MemberId" UUID NULL,
    "FromMemberId" UUID NULL,
    "ToMemberId" UUID NULL,
    "StageId" UUID NULL,
    "StageName" VARCHAR(200) NULL,
    "NextStageId" UUID NULL,
    "NextStageName" VARCHAR(200) NULL,
    "Reason" VARCHAR(500) NULL,
    "CorrelationId" UUID NOT NULL,
    "OccurredAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### 4.2 TaskService Database

#### Tasks Table (Microservice - Enhanced with Stage Tracking)
```sql
CREATE TABLE "Tasks" (
    "TaskId" UUID PRIMARY KEY,
    "TaskName" VARCHAR(200) NOT NULL,
    "Description" VARCHAR(1000),
    "Priority" VARCHAR(50) NOT NULL,
    "TaskType" VARCHAR(50) NOT NULL,
    "Status" INTEGER NOT NULL,  -- 0=Created, 1=WorkflowSelected, 2=SLAConfigured, 3=Assigned, 4=InProgress, 5=Completed, 6=Overdue, 7=Cancelled
    "WorkflowId" INTEGER,
    "MemberId" INTEGER,
    "SLAConfigurationId" UUID,
    "SLAStartTime" TIMESTAMP WITH TIME ZONE,
    "SLADeadline" TIMESTAMP WITH TIME ZONE,
    "IsOverdue" BOOLEAN NOT NULL DEFAULT false,
    -- Stage tracking fields
    "CurrentStageId" INTEGER,
    "CurrentStageStartedAt" TIMESTAMP WITH TIME ZONE,
    "StageTimeoutAt" TIMESTAMP WITH TIME ZONE,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    -- Event tracking for idempotency
    "WorkflowSelectedEventId" UUID,
    "SLAConfiguredEventId" UUID,
    "TaskAssignedEventId" UUID,
    "TaskOverdueEventId" UUID,
    "TaskStageStartedEventId" UUID,
    "TaskStageCompletedEventId" UUID,
    "TaskStageEscalationTriggeredEventId" UUID,
    "TaskCompletedEventId" UUID
);

-- Indexes for performance
CREATE INDEX "IX_Tasks_CurrentStageId" ON "Tasks" ("CurrentStageId");
CREATE INDEX "IX_Tasks_StageTimeoutAt" ON "Tasks" ("StageTimeoutAt") WHERE "StageTimeoutAt" IS NOT NULL;
```

**Task Status Enum Values**:
- `0` = Created
- `1` = WorkflowSelected
- `2` = SLAConfigured
- `3` = Assigned
- `4` = InProgress
- `5` = Completed
- `6` = Overdue
- `7` = Cancelled
```

### 4.3 Microservice Support Tables

#### WorkflowSelections Table
```sql
CREATE TABLE "WorkflowSelections" (
    "SelectionId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL UNIQUE,
    "WorkflowId" INTEGER NOT NULL,
    "WorkflowName" VARCHAR(200) NOT NULL,
    "SelectionReason" VARCHAR(500),
    "SelectedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);
```

#### TaskAssignments Table
```sql
CREATE TABLE "TaskAssignments" (
    "AssignmentId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL,
    "MemberId" INTEGER NOT NULL,
    "WorkloadScore" DOUBLE PRECISION NOT NULL,
    "AssignmentReason" VARCHAR(500),
    "AssignedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "SLAConfiguredEventId" UUID
);

CREATE UNIQUE INDEX "IX_TaskAssignments_TaskId" ON "TaskAssignments" ("TaskId");
CREATE INDEX "IX_TaskAssignments_MemberId" ON "TaskAssignments" ("MemberId");
```

#### SLAAssignments Table
```sql
CREATE TABLE "SLAAssignments" (
    "SLAAssignmentId" UUID PRIMARY KEY,
    "TaskId" UUID NOT NULL UNIQUE,
    "WorkflowId" INTEGER NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,
    "ResponseTimeMinutes" INTEGER NOT NULL,
    "SLAStartTime" TIMESTAMP WITH TIME ZONE NOT NULL,
    "SLADeadline" TIMESTAMP WITH TIME ZONE NOT NULL,
    "IsOverdue" BOOLEAN NOT NULL DEFAULT false
);
```

### 4.4 PriorityRuleEngine Database

#### PriorityRules Table
```sql
CREATE TABLE "PriorityRules" (
    "RuleId" SERIAL PRIMARY KEY,
    "RuleName" VARCHAR(200) NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,
    "Salience" INTEGER NOT NULL DEFAULT 0,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "ConditionsJson" TEXT NOT NULL,
    "MaxWorkloadScore" INTEGER,
    "TeamName" VARCHAR(200),
    "WorkflowId" INTEGER,
    "CreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. API Endpoints

### 5.1 WorkflowManagement.API (Port 5000)

#### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | Get all teams |
| GET | `/api/teams/{id}` | Get team by ID |
| POST | `/api/teams` | Create team |
| PUT | `/api/teams/{id}` | Update team |
| DELETE | `/api/teams/{id}` | Delete team |
| GET | `/api/teams/{id}/members` | Get team members |
| GET | `/api/teams/{id}/workflows` | Get team workflows |

#### Members
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/members` | Get all members |
| GET | `/api/members/{id}` | Get member by ID |
| POST | `/api/members` | Create member (TeamId optional) |
| PUT | `/api/members/{id}` | Update member |
| DELETE | `/api/members/{id}` | Delete member |
| GET | `/api/members/{id}/tasks` | Get tasks currently assigned to member (enriched TaskReadDto) |

#### Workflows
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workflows` | Get all workflows |
| GET | `/api/workflows/{id}` | Get workflow by ID |
| POST | `/api/workflows` | Create workflow |
| PUT | `/api/workflows/{id}` | Update workflow |
| DELETE | `/api/workflows/{id}` | Delete workflow |
| GET | `/api/workflows/{id}/stages` | Get workflow stages |
| GET | `/api/workflows/{id}/tasks` | Get workflow tasks |
| GET | `/api/workflows/{id}/json` | Get workflow JSON |
| POST | `/api/workflows/{id}/update-json` | Update workflow JSON |

#### Stages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stages` | Get all stages |
| GET | `/api/stages/{id}` | Get stage by ID |
| POST | `/api/stages` | Create stage (includes StageType, TransitionPolicy, TimeoutMinutes) |
| PUT | `/api/stages/{id}` | Update stage |
| DELETE | `/api/stages/{id}` | Delete stage |
| GET | `/api/stages/workflow/{workflowId}` | Get stages by workflow |

#### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks |
| GET | `/api/tasks/{id}` | Get task by ID |
| PUT | `/api/tasks/{id}` | Update task |
| DELETE | `/api/tasks/{id}` | Delete task |
| GET | `/api/tasks/workflow/{workflowId}` | Get tasks by workflow |
| GET | `/api/tasks/stage/{stageId}` | Get tasks by stage |
| GET | `/api/tasks/member/{memberId}` | Get tasks assigned to member (enriched TaskReadDto) |
| GET | `/api/tasks/member/summary/{memberId}` | Member task summary: `assignedToMe`, `completedByMe`, `escalatedByMe` |
| GET | `/api/tasks/{id}/audit` | Get task work-history timeline (`tasks.view`) |
| POST | `/api/tasks/{id}/audit` | Record audit entry — idempotent on `eventId` (`tasks.manage`; TaskService) |
| GET | `/api/tasks/assigned/me` | Tasks assigned to member resolved from JWT email |

#### Roles
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/roles/all` | Get all roles (unfiltered). **API key only**: requires `X-Api-Key` header; no JWT. Gateway path `/api/roles/all` is in `Auth:ExcludedPathPrefixes`; WorkflowManagement.API validates `ApiKeys:GetAllRoles`. |
| GET | `/api/roles/organization/{organizationId}` | Get roles by organization (JWT) |
| GET | `/api/roles/{id}` | Get role by ID |
| POST | `/api/roles` | Create role |
| PUT | `/api/roles/{id}` | Update role |
| DELETE | `/api/roles/{id}` | Delete role |

**Note**: Task creation is handled exclusively through `POST /api/task-service` (TaskService) for proper event-driven orchestration. Direct task creation via WorkflowManagement.API is not supported.

### 5.2 SLAConfiguration.API (Port 5002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sla-configurations` | Get all SLA configurations |
| GET | `/api/sla-configurations/workflow/{workflowId}` | Get SLA for workflow |
| POST | `/api/sla-configurations` | Create SLA configuration |
| PUT | `/api/sla-configurations/workflow/{workflowId}` | Update SLA configuration |
| DELETE | `/api/sla-configurations/workflow/{workflowId}` | Delete SLA configuration |

### 5.3 Workload.API (Port 5003)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workload/{memberId}` | Get workload summary for member |

### 5.4 PriorityRuleEngine.API (Port 5010)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/priority-rules` | Get all priority rules |
| GET | `/api/priority-rules/{id}` | Get rule by ID |
| POST | `/api/priority-rules` | Create priority rule |
| PUT | `/api/priority-rules/{id}` | Update priority rule |
| DELETE | `/api/priority-rules/{id}` | Delete priority rule |
| GET | `/api/priority-rules/workflow/{workflowId}` | Get rules for workflow |

### 5.5 APIGateway (Port 5004)

**Direct Endpoints**:
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks/{id}` | Get task details (proxied to WorkflowManagement.API) |

**Auth Proxy Endpoints** (proxied to external Auth service; require Bearer token):
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/organizationuser?product_id={product_id}` | Get active organization users. Gateway adds `tenant_id` from JWT (claim `tenant_id` or `firebase.tenant`). Proxies to Auth service `GET /api/organizationuser?product_id=...&tenant_id=...`. Used by Users, Members, and Workflow Wizard pages. |
| GET | `/api/auth/users/organization/{organizationId}?status=active\|pending` | Get users by organization and status (legacy; pending invitations still use this). |
| GET | `/api/auth/invitations/organization/{organizationId}?status=pending` | Get pending invitations by organization. |
| GET | `/api/auth/tenant/{email}` | Tenant lookup by email. |

**Reverse Proxy Routes** (All requests are proxied to backend services):
- `/api/workflows/*` → WorkflowManagement.API:5000
- `/api/teams/*` → WorkflowManagement.API:5000
- `/api/members/*` → WorkflowManagement.API:5000
- `/api/roles/*` → WorkflowManagement.API:5000 (including `/api/roles/all`, which is API-key-only; see `Auth:ExcludedPathPrefixes`)
- `/api/stages/*` → WorkflowManagement.API:5000
- `/api/tasks/*` (GET/PUT/DELETE) → WorkflowManagement.API:5000
- `/api/task-service/*` (POST/GET/PUT/DELETE) → TaskService:5005
- `/api/sla-configurations/*` → SLAConfiguration.API:5002
- `/api/priority-rules/*` → PriorityRuleEngine.API:5010
- `/api/workload/*` → Workload.API:5003

**Note**: Gateway is a pure routing layer. All business logic and orchestration handled by microservices.

### 5.6 TaskService (Port 5005)

**Note**: All TaskService endpoints are accessed via API Gateway at `/api/task-service/*`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/task-service/{id}` | Get task by ID |
| POST | `/api/task-service` | Create task (entry point for orchestration flow, returns taskId only) |
| PUT | `/api/task-service/status/{id}` | Update task status (accepts string status values: "Created", "WorkflowSelected", "SLAConfigured", "Assigned", "InProgress", "Completed", "Overdue", "Cancelled", "Escalated" or numeric 0-8) |
| DELETE | `/api/task-service/{id}` | Delete task |
| POST | `/api/task-service/complete-stage/{id}` | Complete current stage and transition to next |
| POST | `/api/task-service/escalate-stage/{id}` | Manually escalate task to next stage |
| POST | `/api/task-service/sync-overdue` | Sync all overdue tasks to WorkflowManagement.API |
| POST | `/api/task-service/sync-from-workflow-management` | Sync all tasks from WorkflowManagement.API to TaskService |
| POST | `/api/task-service/cleanup-orphaned` | Cleanup orphaned tasks from WorkflowManagement.API |

### 5.7 Error Handling

All services implement consistent error handling via `ExceptionHandlingMiddleware`:

**Error Response Format**:
```json
{
  "error": "Error message"
}
```

**HTTP Status Codes**:
- `400 Bad Request` - Invalid input (ArgumentException)
- `404 Not Found` - Resource not found (KeyNotFoundException)
- `500 Internal Server Error` - Server errors

**Services with ExceptionHandlingMiddleware**:
- WorkflowManagement.API
- SLAConfiguration.API
- Workload.API
- TaskService (via try-catch in controllers)

---

## 6. Event-Driven Architecture

### 6.1 Multi-Cloud Event Bus Architecture

The system uses a **provider-agnostic event bus abstraction** that supports multiple cloud providers:
- **AWS**: EventBridge + SQS + SNS + EventBridge Scheduler
- **Azure**: Service Bus + Event Grid + Service Bus Scheduled Messages
- **GCP**: Cloud Pub/Sub + Cloud Scheduler

#### Event Bus Abstraction Layer

**Interface**: `IEventBus`
- `PublishAsync<T>()` - Immediate event publishing
- `ScheduleAsync<T>(DateTime)` - Schedule event at specific time
- `ScheduleAsync<T>(TimeSpan)` - Schedule event after delay
- `StartConsuming<T>()` - Start consuming from queue
- `StopConsuming()` - Stop all consumers

**Factory Pattern**: `EventBusFactory`
- Reads `EventBus:Provider` from configuration
- Resolves appropriate implementation at runtime
- Supports switching providers via configuration only

#### Provider Selection

Configure in `appsettings.json`:
```json
{
  "EventBus": {
    "Provider": "AWS",  // Options: "AWS", "Azure", "GCP"
    "AWS": { ... },
    "Azure": { ... },
    "GCP": { ... }
  }
}
```

#### AWS Implementation (Default)

**Services Used**:
- **EventBridge**: Central event bus (replaces RabbitMQ exchanges)
- **SQS**: Per-service queues (replaces RabbitMQ queues)
- **SNS**: Fan-out for multiple consumers (optional)
- **EventBridge Scheduler**: Delayed events (replaces RabbitMQ delayed exchange)

**Event Sources** (replaces exchanges):
- `task-manager.task` - Task-related events
- `task-manager.workflow` - Workflow and stage events
- `task-manager.sla` - SLA-related events
- `task-manager.workload` - Workload and assignment events
- `task-manager.priority` - Priority assignment events

**Detail Types** (replaces routing keys):
- `TaskCreated`, `WorkflowSelected`, `PriorityAssigned`, `SLAConfigured`, `TaskAssigned`, `TaskOverdue`, `TaskStageStarted`, `TaskStageCompleted`, `TaskStageEscalationTriggered`, `TaskStageReassignmentNeeded`, `TaskCompleted`, `TaskStatusUpdated`

**Queue Names** (per service):
- `task-service` - TaskService queue
- `workflow-service` - WorkflowService queue
- `sla-service` - SLAManagerService queue
- `workload-service` - WorkloadService queue
- `priority-service` - PriorityRuleEngine queue

#### Azure Implementation

**Services Used**:
- **Azure Service Bus**: Messaging and queues
- **Azure Event Grid**: Event routing (optional)
- **Service Bus Scheduled Messages**: Delayed events

**Configuration**:
```json
{
  "EventBus": {
    "Provider": "Azure",
    "Azure": {
      "ServiceBusConnectionString": "Endpoint=sb://...",
      "EventGridTopicEndpoint": "https://...",
      "EventGridAccessKey": "...",
      "ServicePrefix": "task-manager"
    }
  }
}
```

#### GCP Implementation

**Services Used**:
- **Cloud Pub/Sub**: Messaging and subscriptions
- **Cloud Scheduler**: Delayed events

**Configuration**:
```json
{
  "EventBus": {
    "Provider": "GCP",
    "GCP": {
      "ProjectId": "your-project-id",
      "CredentialsPath": "path/to/service-account-key.json",
      "ServicePrefix": "task-manager",
      "SchedulerLocation": "us-central1"
    }
  }
}
```

#### Scheduled Events (Replaces Polling)

**Before (RabbitMQ)**:
- `SLAMonitorService` - Polled every 1 minute for overdue tasks
- `StageEscalationMonitorService` - Polled every 1 minute for escalation timeouts

**After (EventBridge Scheduler)**:
- SLA deadlines: Scheduled via `ScheduleAsync()` when SLA is configured
- Escalation timeouts: Scheduled via `ScheduleAsync()` when escalation stage starts
- **No polling required** - Events fire exactly at scheduled time

#### Benefits of Multi-Cloud Architecture

1. **Cloud Agnostic**: Switch providers via configuration
2. **No Vendor Lock-in**: Abstraction layer allows migration
3. **Native Cloud Services**: Leverages managed services (no infrastructure management)
4. **Scalability**: Cloud-native services auto-scale
5. **Reliability**: Managed services with built-in redundancy
6. **Cost Optimization**: Choose provider based on cost/requirements

### 6.2 Event Contracts

**Note**: `TaskCreatedForPriority` is defined in EventBusConstants but is currently unused (reserved for future priority-first workflow selection).

#### TaskCreatedEvent
```csharp
{
    TaskId: Guid,
    TaskName: string,
    Description: string?,
    Priority: string,
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
    AssignedBy: string,
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
    SLAAssignmentId: Guid,
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
    AssignmentId: Guid,
    TaskId: Guid,
    MemberId: int,
    MemberName: string,
    MemberEmail: string,
    WorkloadScore: double,
    AssignedAt: DateTime,
    CorrelationId: Guid
}
```

#### TaskStageStartedEvent
```csharp
{
    TaskId: Guid,
    StageId: int,
    StageName: string,
    StageOrder: int,
    StageType: string,  // "Process" or "Escalation"
    WorkflowId: int,
    TeamId: int,
    StartedAt: DateTime,
    StageTimeoutAt: DateTime?,  // For escalation stages
    CorrelationId: Guid
}
```

#### TaskStageCompletedEvent
```csharp
{
    TaskId: Guid,
    StageId: int,
    StageName: string,
    WorkflowId: int,
    NextStageId: int?,
    NextStageName: string?,
    CompletedAt: DateTime,
    CorrelationId: Guid
}
```

#### TaskStageEscalationTriggeredEvent
```csharp
{
    TaskId: Guid,
    CurrentStageId: int,
    CurrentStageName: string,
    WorkflowId: int,
    NextStageId: int?,
    NextStageName: string?,
    EscalatedAt: DateTime,
    CorrelationId: Guid
}
```

#### TaskStageReassignmentNeededEvent
```csharp
{
    TaskId: Guid,
    StageId: int,
    StageName: string,
    StageOrder: int,
    WorkflowId: int,
    NewTeamId: int,
    PreviousMemberId: int?,
    PreviousTeamId: int?,
    TaskPriority: string?,
    RequestedAt: DateTime,
    CorrelationId: Guid
}
```

#### TaskCompletedEvent
```csharp
{
    TaskId: Guid,
    WorkflowId: int,
    FinalStageId: int,
    FinalStageName: string,
    CompletedAt: DateTime,
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

#### TaskStatusUpdatedEvent
```csharp
{
    TaskId: Guid,
    PreviousStatus: string,
    NewStatus: string,
    UpdatedAt: DateTime,
    CorrelationId: Guid
}
```

### 6.3 Idempotency

Each event handler implements idempotency:
1. Checks if event was already processed (using event ID stored in database)
2. If processed, logs warning and returns early
3. If not processed, processes event and stores event ID

**Event ID Storage in Task entity**:
- `WorkflowSelectedEventId`
- `SLAConfiguredEventId`
- `TaskAssignedEventId`
- `TaskOverdueEventId`
- `TaskStageStartedEventId`
- `TaskStageCompletedEventId`
- `TaskStageEscalationTriggeredEventId`
- `TaskCompletedEventId`

---

## 7. Stage Orchestration System

### 7.1 Stage Types

| Type | Value | Description |
|------|-------|-------------|
| **Process** | 0 | ERP-style workflows where tasks progress on user action |
| **Escalation** | 1 | Ticketing systems where tasks escalate automatically on timeout |

### 7.2 Transition Policies

| Policy | Value | Description |
|--------|-------|-------------|
| **OnComplete** | 0 | Transition when stage is explicitly completed |
| **OnTimeout** | 1 | Transition automatically when timeout expires |
| **Manual** | 2 | Manual transition only (API call required) |

### 7.3 Stage Orchestration Service

The `StageOrchestrationService` in WorkflowService handles:

**`StartTaskInFirstStageAsync`**
- Called when `TaskAssignedEvent` is received
- Gets workflow stages ordered by StageOrder
- Calculates timeout for escalation stages
- Publishes `TaskStageStartedEvent`

**`HandleStageCompletionAsync`**
- Called when `TaskStageCompletedEvent` is received
- Determines if there's a next stage
- If next stage exists: publishes `TaskStageStartedEvent`
- If no next stage: publishes `TaskCompletedEvent`

**`HandleEscalationTimeoutAsync`**
- Called when `TaskStageEscalationTriggeredEvent` is received
- Transitions task to next stage automatically
- Works same as completion but triggered by timeout

### 7.4 Stage Escalation Scheduling

**Before (Polling)**:
- `StageEscalationMonitorService` background service polled every 60 seconds

**After (Scheduled Events)**:
- When escalation stage starts, `ScheduleAsync()` is called with timeout duration
- EventBridge Scheduler (or equivalent) fires event at exact timeout time
- No polling required - event fires exactly when needed

### 7.5 Process Workflow Flow
```
1. TaskAssignedEvent received
   ↓
2. StageOrchestrationService.StartTaskInFirstStageAsync
   ↓
3. TaskStageStartedEvent published
   ↓
4. TaskService updates task (Status: InStage, CurrentStageId set)
   ↓
5. User calls POST /api/task-service/complete-stage/{id}
   ↓
6. TaskService publishes TaskStageCompletedEvent
   ↓
7. WorkflowService.HandleStageCompletionAsync
   ↓
8. If more stages: TaskStageStartedEvent → back to step 4
   If no more stages: TaskCompletedEvent → task completed
```

### 7.6 Escalation Workflow Flow
```
1. TaskAssignedEvent received
   ↓
2. StageOrchestrationService.StartTaskInFirstStageAsync (with timeout)
   ↓
3. TaskStageStartedEvent published (includes StageTimeoutAt)
   ↓
4. ScheduleAsync() called to schedule escalation timeout event
   ↓
5. TaskService updates task (Status: InStage, StageTimeoutAt set)
   ↓
6. EventBridge Scheduler fires at timeout
   ↓
7. TaskStageEscalationTriggeredEvent published
   ↓
8. WorkflowService.HandleEscalationTimeoutAsync
   ↓
9. If more stages: TaskStageStartedEvent → back to step 4
   If no more stages: TaskCompletedEvent → task completed
```

---

## 8. Automatic Reassignment System

### 8.1 Overview

When a task moves from one stage to another, and the new stage's team is different from the current assignee's team, the system automatically reassigns the task to the best available member of the new team.

### 8.2 Reassignment Flow

```
Stage 1 (Team ESG) → Stage 2 (Team DEV)
         ↓
TaskStageStartedEvent (TeamId: DEV)
         ↓
TaskStageStartedEventHandler (TaskService)
  - Updates task with Stage 2 info
  - Gets current member's team (ESG)
  - Detects: ESG ≠ DEV
         ↓
TaskStageReassignmentNeededEvent
         ↓
WorkloadService.TaskStageReassignmentNeededEventHandler
         ↓
WorkloadEvaluationService.ReassignTaskToTeamMemberAsync
  - Gets all DEV team members
  - Calculates workload scores for each
  - Selects member with lowest workload
  - Updates or creates assignment
         ↓
TaskAssignedEvent (new DEV member)
         ↓
TaskService updates task.MemberId
```

### 8.3 Workload Calculation

The workload score is calculated using weighted factors (0-100, lower is better):

| Factor | Weight | Description |
|--------|--------|-------------|
| Efficiency | 30% | Completed tasks / Total tasks |
| Skill Level | 20% | Member's skill level (1-5) |
| Task Completion Rate | 20% | Historical completion rate |
| Active Task Load | 20% | Current active tasks count |
| Availability | 10% | Is member available (< 5 active tasks) |

### 8.4 Member Selection Criteria

1. **Filter by team**: Only members in the target team
2. **Evaluate workload**: Calculate score for each member
3. **Priority conflict check**: Prefer members without same-priority active tasks
4. **Select best**: Member with lowest workload score wins

### 8.5 Key Benefits

- **Seamless handoffs**: Tasks automatically go to the right team
- **Load balancing**: Prevents overloading individual team members
- **Audit trail**: Assignment history tracked in TaskAssignments table
- **Event-driven**: Fully asynchronous, no blocking calls

---

## 9. Frontend Application

### 9.1 Technology Stack
- **React** 18.2.0 with TypeScript
- **React Router DOM** 6.21.1
- **Axios** 1.6.2
- **Tailwind CSS** 3.4.0
- **React Icons** 4.12.0
- **React Toastify** 9.1.3
- **@dnd-kit** (Drag and Drop) 6.1.0
- **React Hook Form** 7.49.2

### 9.2 Project Structure

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
│   ├── TaskAuditModal.tsx    # Task work-history timeline modal
│   ├── AppShell.tsx          # Layout: fixed sidebar, scrollable main
│   └── ConditionBuilder.tsx  # Priority rule condition builder
│
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Workflows.tsx   # Workflows list
│   ├── WorkflowDetail.tsx # Workflow detail view
│   ├── Teams.tsx       # Teams management
│   ├── Members.tsx     # Members management
│   ├── MemberDetail.tsx  # Member profile + unified tasks table + audit
│   ├── Tasks.tsx       # Tasks management (audit clock per row)
│   ├── SLAConfiguration.tsx # SLA configuration page
│   ├── WorkloadConfiguration.tsx # Workload monitoring
│   └── PriorityRules.tsx # Priority rules management
│
├── services/           # API service clients
│   ├── api.ts         # Base API client
│   ├── slaApi.ts      # SLA API client
│   ├── workloadService.ts
│   ├── priorityRulesApi.ts
│   ├── workflowService.ts
│   ├── teamService.ts
│   ├── memberService.ts
│   ├── stageService.ts
│   └── taskService.ts   # includes getAudit, getMemberSummary
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

### 9.3 Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Redirects to `/workflows` | - |
| `/workflows` | Workflows | Workflows list page |
| `/workflows/:id` | WorkflowDetail | Workflow detail page |
| `/teams` | Teams | Teams management |
| `/members` | Members | Members management |
| `/members/:id` | MemberDetail | Member profile; single Tasks table (assigned + past work) |
| `/tasks` | Tasks | Tasks management |
| `/sla-configuration` | SLAConfiguration | SLA configuration |
| `/workload-configuration` | WorkloadConfiguration | Workload monitoring |
| `/priority-rules` | PriorityRules | Priority rules management |

### 9.4 Key TypeScript Types

```typescript
// Stage types for orchestration
export type StageType = 'Process' | 'Escalation';
export type TransitionPolicy = 'OnComplete' | 'OnTimeout' | 'Manual';

export interface Stage {
  stageId: number;
  stageName: string;
  stageOrder: number;
  workflowId: number;
  teamId: number;
  teamName?: string;
  stageType: StageType;
  transitionPolicy: TransitionPolicy;
  timeoutMinutes?: number;
  createdAt: string;
}

export interface Member {
  memberId: number;
  firstName: string;
  lastName: string;
  email: string;
  teamId?: number;      // Nullable
  teamName?: string;    // Nullable
  role: string;
  skillLevel: number;
  createdAt: string;
  updatedAt: string;
}
```

### 9.5 API Service Configuration

**All frontend services route through API Gateway**:

| Frontend Service | Base URL | Proxied To |
|------------------|----------|------------|
| Main API (`api.ts`) | `http://localhost:5004/api` | WorkflowManagement.API:5000 |
| SLA API (`slaApi.ts`) | `http://localhost:5004/api` | SLAConfiguration.API:5002 |
| Priority Rules API (`priorityRulesApi.ts`) | `http://localhost:5004/api` | PriorityRuleEngine.API:5010 |
| Workload API (`workloadService.ts`) | `http://localhost:5004/api` | Workload.API:5003 |
| User/organization users (`userService.getActiveOrganizationUsers`) | `GET /api/auth/organizationuser?product_id=...` | Auth service (via API Gateway; gateway adds `tenant_id` from JWT) |

**Frontend environment variables** (build-time; e.g. `.env.development`, `.env.production`):
| Variable | Purpose |
|----------|---------|
| `REACT_APP_API_URL` | API Gateway base URL |
| `REACT_APP_PRODUCT_ID` | Product ID for active organization users API (`/api/auth/organizationuser`). Required for Users, Members, and Workflow Wizard pages. Set in GitHub Secrets as `REACT_APP_PRODUCT_ID` for CI build. |
| `REACT_APP_FIREBASE_*` | Firebase config (API key, project ID, auth domain) |

**Backend API key (WorkflowManagement.API)**:
| Config / env | Purpose |
|--------------|---------|
| `ApiKeys:GetAllRoles` | API key for `GET /api/roles/all`. Set via env `ApiKeys__GetAllRoles`; in deploy use GitHub Secret `ROLES_API_KEY` (see `deploy-backend.yml`). |

**Backend Service Ports** (accessed via API Gateway):
| Service | Port | Purpose |
|--------|------|----------|
| WorkflowManagement.API | 5000 | Core workflow CRUD |
| SLAConfiguration.API | 5002 | SLA CRUD |
| PriorityRuleEngine.API | 5010 | Priority rules CRUD |
| Workload.API | 5003 | Workload queries |

---

## 10. Complete Flow Diagrams

### 10.1 Task Creation Flow (Event-Driven)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/task-service
       │ (via API Gateway:5004)
       ▼
┌─────────────┐
│ APIGateway  │ Routes request to TaskService
│  (Port 5004)│ (Pure routing, no business logic)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│TaskService  │ Generates TaskId, CorrelationId
│  (Port 5005)│ Creates task in database
│  Controller │ Publishes TaskCreatedEvent
│             │ Returns HTTP 202 (taskId only)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Event Bus                    │
│    (AWS EventBridge/SQS)             │
│    TaskCreatedEvent                   │
└──────┬──────────────────┬────────────┘
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│TaskService  │    │WorkflowSvc  │
│ Creates Task│    │ Selects WF  │
│ (idempotent)│    └──────┬──────┘
└─────────────┘           │
                          ▼ WorkflowSelectedEvent
                   ┌─────────────┐
                   │PriorityRule │
                   │   Engine    │
                   └──────┬──────┘
                          │
                          ▼ PriorityAssignedEvent
                   ┌─────────────┐
                   │SLAManager   │
                   │  Service    │
                   └──────┬──────┘
                          │
                          ▼ SLAConfiguredEvent
                   ┌─────────────┐
                   │WorkloadSvc  │
                   │ Assigns Task│
                   └──────┬──────┘
                          │
                          ▼ TaskAssignedEvent
                   ┌─────────────┐
                   │WorkflowSvc  │
                   │ Starts Stage│
                   └──────┬──────┘
                          │
                          ▼ TaskStageStartedEvent
                   ┌─────────────┐
                   │TaskService  │
                   │ Updates Task│
                   │Status:InStage│
                   └─────────────┘
```

### 10.2 Stage Transition with Reassignment Flow

```
┌─────────────────────┐
│ Stage 1 Completed   │ POST /api/task-service/complete-stage/{id}
└──────────┬──────────┘
           │
           ▼ TaskStageCompletedEvent
┌─────────────────────┐
│ WorkflowService     │ HandleStageCompletionAsync
│ StageOrchestrator   │
└──────────┬──────────┘
           │
           ▼ TaskStageStartedEvent (Stage 2, Team DEV)
┌─────────────────────┐
│ TaskService         │
│ TaskStageStarted    │
│ EventHandler        │
└──────────┬──────────┘
           │
           │ Check: Is new team different from current assignee's team?
           │
           ├─── No ─────────────────────────────────────┐
           │                                            │
           ▼ Yes                                        ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ Publish             │                    │ Task continues with │
│ TaskStageReassign   │                    │ same member         │
│ mentNeededEvent     │                    └─────────────────────┘
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ WorkloadService     │
│ Reassignment Handler│
└──────────┬──────────┘
           │
           │ 1. Get DEV team members
           │ 2. Calculate workload scores
           │ 3. Select best member
           │ 4. Update assignment
           │
           ▼ TaskAssignedEvent (new member)
┌─────────────────────┐
│ TaskService         │
│ Updates MemberId    │
└─────────────────────┘
```

### 10.3 Escalation Timeout Flow

```
┌─────────────────────────┐
│ StageOrchestrationService│ When escalation stage starts
│       ScheduleAsync()    │
└───────────┬─────────────┘
            │
            │ Schedule event for StageTimeoutAt
            │
            ▼
┌─────────────────────────┐
│ EventBridge Scheduler   │ (or Azure/GCP equivalent)
│    Scheduled Job        │
└───────────┬─────────────┘
            │
            │ Fires at exact timeout time
            │
            ▼
┌─────────────────────────┐
│ TaskStageEscalation     │
│ TriggeredEvent Published│
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────┐
│ WorkflowService     │
│ HandleEscalation    │
│ TimeoutAsync        │
└──────────┬──────────┘
           │
           ▼ TaskStageStartedEvent
    (next stage or TaskCompletedEvent)
```

### 10.4 SLA Monitoring Flow

```
┌─────────────────────┐
│ SLAService          │ When SLA is configured
│ ConfigureSLAAsync() │
└──────────┬──────────┘
           │
           │ Schedule event for SLADeadline
           │
           ▼
┌─────────────────────┐
│ EventBridge Scheduler│ (or Azure/GCP equivalent)
│    Scheduled Job     │
└───────────┬──────────┘
            │
            │ Fires at exact deadline time
            │
            ▼
┌─────────────────────┐
│ TaskOverdueEvent    │
│      Published      │
└──────────┬──────────┘
           │
           ▼
    ┌─────────────┐
    │TaskService │
    │Updates     │
    │IsOverdue   │
    └────────────┘
```

### 10.5 Workload Calculation Formula

```
WorkloadScore = (
    EfficiencyScore × 0.30 +      # (1 - completedTasks/totalTasks) × 100
    SkillLevelScore × 0.20 +      # (6 - skillLevel) × 20
    CompletionScore × 0.20 +      # (100 - completionRate)
    ActiveTaskLoadScore × 0.20 +  # min(100, activeTasks × 10)
    AvailabilityScore × 0.10      # 0 if available, 100 if not
)

Lower score = More available = Higher priority for assignment
```

---

## 11. Configuration & Setup

### 11.1 Prerequisites
- .NET 8 SDK
- Node.js 16+ and npm
- PostgreSQL 12+
- AWS Account (for AWS EventBridge) OR Azure Subscription OR GCP Project

### 11.2 Database Setup

#### Create Databases
```sql
CREATE DATABASE "WorkflowManagement";
CREATE DATABASE "TaskService";
CREATE DATABASE "SLAConfiguration";
CREATE DATABASE "PriorityRuleEngine";
```

#### Run Migrations
```sql
-- WorkflowManagement Database
-- Run: AddStageOrchestrationFields.sql
ALTER TABLE "Stages" 
ADD COLUMN IF NOT EXISTS "StageType" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "TransitionPolicy" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "TimeoutMinutes" INTEGER;

-- Make Members.TeamId nullable
ALTER TABLE "Members"
ALTER COLUMN "TeamId" DROP NOT NULL;

-- TaskService Database
-- Run: AddStageTrackingFields.sql
ALTER TABLE "Tasks" 
ADD COLUMN IF NOT EXISTS "CurrentStageId" INTEGER,
ADD COLUMN IF NOT EXISTS "CurrentStageStartedAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "StageTimeoutAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "TaskStageStartedEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskStageCompletedEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskStageEscalationTriggeredEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskCompletedEventId" UUID;

-- Create indexes
CREATE INDEX IF NOT EXISTS "IX_Tasks_CurrentStageId" ON "Tasks" ("CurrentStageId");
CREATE INDEX IF NOT EXISTS "IX_Tasks_StageTimeoutAt" ON "Tasks" ("StageTimeoutAt") WHERE "StageTimeoutAt" IS NOT NULL;
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

### 11.3 Event Bus Configuration

#### AWS EventBridge (Default)

**Configuration** (`appsettings.json`):
```json
{
  "EventBus": {
    "Provider": "AWS",
    "AWS": {
      "Region": "us-east-1",
      "EventBusName": "default",
      "ServicePrefix": "task-manager",
      "VisibilityTimeoutSeconds": 300,
      "MaxReceiveCount": 3,
      "SchedulerGroupName": "task-manager-schedules",
      "SchedulerRoleArn": "arn:aws:iam::ACCOUNT_ID:role/EventBridgeSchedulerRole"
    }
  }
}
```

**Infrastructure Requirements**:
1. AWS Account with EventBridge, SQS, SNS, and Scheduler access
2. IAM Role for EventBridge Scheduler with `events:PutEvents` permission
3. EventBridge Rules to route events to SQS queues (or auto-created)

**Note**: SQS queues are auto-created by `AwsEventBus` on first use.

#### Azure Service Bus (Optional)

**Configuration**:
```json
{
  "EventBus": {
    "Provider": "Azure",
    "Azure": {
      "ServiceBusConnectionString": "Endpoint=sb://...",
      "EventGridTopicEndpoint": "https://...",
      "EventGridAccessKey": "...",
      "ServicePrefix": "task-manager",
      "MaxDeliveryCount": 3,
      "LockDurationSeconds": 300,
      "EventGridTopicName": "task-manager-events"
    }
  }
}
```

#### GCP Pub/Sub (Optional)

**Configuration**:
```json
{
  "EventBus": {
    "Provider": "GCP",
    "GCP": {
      "ProjectId": "your-project-id",
      "CredentialsPath": "path/to/service-account-key.json",
      "ServicePrefix": "task-manager",
      "AckDeadlineSeconds": 300,
      "MaxDeliveryAttempts": 3,
      "SchedulerLocation": "us-central1",
      "ServiceAccountEmail": "YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com"
    }
  }
}
```

#### Legacy RabbitMQ (Deprecated)

RabbitMQ support has been removed. For RabbitMQ support, implement `RabbitMQEventBus` adapter.

### 11.4 Service Ports

| Service | Port | Purpose |
|---------|------|---------|
| **APIGateway** | **5004** | **Single entry point** - Reverse proxy routing only (no business logic) |
| WorkflowManagement.API | 5000 | Core workflow CRUD (accessed via API Gateway) |
| SLAConfiguration.API | 5002 | SLA CRUD (accessed via API Gateway) |
| PriorityRuleEngine.API | 5010 | Priority rules CRUD (accessed via API Gateway) |
| Workload.API | 5003 | Workload queries (accessed via API Gateway) |
| TaskService | 5005 | Task lifecycle + Task creation orchestration + Stage completion API |
| WorkflowService | 5006 | Workflow selection + Stage orchestration |
| SLAManagerService | 5007 | SLA management |
| WorkloadService | 5008 | Task assignment + Stage reassignment |
| Frontend | 3000 | React app |

### 11.5 Running Services

#### Backend Services
```bash
# Start each service in separate terminals
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

### 11.6 CORS Configuration
API Gateway is configured to allow requests from `http://localhost:3000`. All CORS is handled at the gateway level.

### 11.7 API Gateway Routing Configuration

The API Gateway uses **YARP (Yet Another Reverse Proxy)** for routing. Configuration is in `appsettings.json`:

```json
{
  "ReverseProxy": {
    "Routes": {
      "workflow-route": {
        "ClusterId": "workflow-cluster",
        "Match": { "Path": "/api/workflows/{**catch-all}" }
      },
      "task-crud-route": {
        "ClusterId": "workflow-cluster",
        "Match": {
          "Path": "/api/tasks/{**catch-all}",
          "Methods": [ "GET", "PUT", "DELETE" ]
        }
      },
      // ... other routes
    },
    "Clusters": {
      "workflow-cluster": {
        "Destinations": {
          "destination1": { "Address": "http://localhost:5000" }
        }
      }
      // ... other clusters
    }
  }
}
```

**Routing Behavior**:
- `POST /api/task-service` → Proxied to TaskService (handles orchestration)
- All other requests → Proxied to appropriate backend service
- Gateway is a pure routing layer (no business logic, no event publishing)

---

## 12. Technologies Used

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| .NET | 8 | Framework |
| ASP.NET Core Web API | 8 | Web framework |
| Entity Framework Core | 8 | ORM |
| PostgreSQL | 12+ | Database |
| **AWS SDK** | **3.7.400.0** | **EventBridge, SQS, SNS, Scheduler** |
| **Azure SDK** | **7.18.0** | **Service Bus, Event Grid** |
| **GCP SDK** | **3.15.0** | **Pub/Sub, Cloud Scheduler** |
| YARP (Yet Another Reverse Proxy) | 2.2.0 | API Gateway routing |
| AutoMapper | 12+ | Object mapping |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 4.9.5 | Type safety |
| Tailwind CSS | 3.4.0 | Styling |
| React Router DOM | 6.21.1 | Routing |
| Axios | 1.6.2 | HTTP client |
| React Icons | 4.12.0 | Icons |
| React Toastify | 9.1.3 | Notifications |
| @dnd-kit | 6.1.0 | Drag and Drop |
| React Hook Form | 7.49.2 | Form handling |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| PostgreSQL 12+ | Database |
| **AWS EventBridge/SQS/SNS** | **Event bus (default)** |
| **Azure Service Bus/Event Grid** | **Event bus (optional)** |
| **GCP Pub/Sub** | **Event bus (optional)** |
| Docker (optional) | Containerization |

---

## 13. Implementation Status

### ✅ Completed

| Feature | Status |
|---------|--------|
| Core workflow CRUD | ✅ Complete |
| Team and member management | ✅ Complete |
| Task assignment and tracking | ✅ Complete |
| Event-driven orchestration | ✅ Complete |
| **Multi-cloud event bus architecture** | ✅ Complete |
| **AWS EventBridge implementation** | ✅ Complete |
| **Azure Service Bus implementation** | ✅ Complete |
| **GCP Pub/Sub implementation** | ✅ Complete |
| **Factory pattern for provider abstraction** | ✅ Complete |
| **EventBridge Scheduler for delayed events** | ✅ Complete |
| Priority rule engine | ✅ Complete |
| SLA configuration and monitoring | ✅ Complete |
| Workload-based task assignment | ✅ Complete |
| **Stage-based orchestration** | ✅ Complete |
| **StageType (Process/Escalation)** | ✅ Complete |
| **TransitionPolicy** | ✅ Complete |
| **Stage completion API** | ✅ Complete |
| **Automatic reassignment on stage change** | ✅ Complete |
| Frontend React application | ✅ Complete |
| Kanban board | ✅ Complete |
| Idempotent event handlers | ✅ Complete |

### 🔄 Pending / Future Enhancements

| Feature | Status |
|---------|--------|
| Frontend stage type selector | 🔄 Pending |
| Frontend escalation countdown timer | 🔄 Pending |
| Stage history tracking | 🔄 Pending |
| Unit tests for StageOrchestrationService | 🔄 Pending |
| Integration tests for stage transitions | 🔄 Pending |
| End-to-end tests for both workflow types | 🔄 Pending |

---

## Summary

This system provides a complete **Generic Workflow Orchestration Platform** with:

1. **REST APIs** for CRUD operations (frontend interaction)
2. **Event-driven microservices** for automated orchestration
3. **Stage-based workflow orchestration** (Process and Escalation types)
4. **Automatic team reassignment** when tasks move between stages
5. **Priority rule engine** for automatic priority assignment
6. **SLA configuration and monitoring** for deadline tracking
7. **Workload-based task assignment** for optimal resource utilization
8. **Modern React frontend** for user interaction

### Key Design Principles

- ✅ **Single entry point** (API Gateway routes all frontend requests)
- ✅ **Fully event-driven** (Multi-cloud event bus for orchestration)
- ✅ **No synchronous service chaining**
- ✅ **Idempotent consumers**
- ✅ **Separate databases per service**
- ✅ **Configuration-driven** (not hardcoded)
- ✅ **Supports both Process and Escalation workflows**
- ✅ **Automatic team handoffs** via reassignment
- ✅ **Reverse proxy routing** (YARP) for centralized request handling
- ✅ **Multi-cloud support** (AWS/Azure/GCP via factory pattern)
- ✅ **Scheduled events** (no polling required)

---

## 14. Multi-Cloud Event Bus Architecture

### 14.1 Overview

The system implements a **provider-agnostic event bus architecture** using the Factory Pattern, allowing seamless switching between cloud providers (AWS, Azure, GCP) via configuration changes only.

### 14.2 Architecture Components

#### Abstraction Layer

**`IEventBus` Interface**:
```csharp
public interface IEventBus
{
    Task PublishAsync<T>(T eventData, string source, string detailType, Guid correlationId);
    Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, DateTime scheduledTime);
    Task ScheduleAsync<T>(T eventData, string source, string detailType, Guid correlationId, TimeSpan delay);
    void StartConsuming<T>(string queueName, Func<T, Guid, Task> handler);
    void StopConsuming();
}
```

**Factory Pattern**:
- `IEventBusFactory` - Factory interface
- `EventBusFactory` - Implementation that resolves provider from configuration
- All providers registered in DI container
- Runtime provider selection based on `EventBus:Provider` config

#### Provider Implementations

| Provider | Event Bus | Queues | Scheduling | Status |
|----------|-----------|--------|------------|--------|
| **AWS** | EventBridge | SQS | EventBridge Scheduler | ✅ Implemented |
| **Azure** | Event Grid / Service Bus | Service Bus | Service Bus Scheduled | ✅ Implemented |
| **GCP** | Pub/Sub | Pub/Sub Subscriptions | Cloud Scheduler | ✅ Implemented |

### 14.3 Provider-Specific Details

#### AWS EventBridge Implementation

**Components**:
- **EventBridge**: Central event bus (default or custom event bus)
- **SQS Queues**: One per service (auto-created with DLQ)
- **SNS Topics**: Optional fan-out for multiple consumers
- **EventBridge Scheduler**: One-time scheduled events

**Event Flow**:
```
Application Code
    ↓
IEventBus.PublishAsync()
    ↓
AwsEventBus
    ↓
EventBridge.PutEvents()
    ↓
EventBridge Rules → SNS → SQS
    ↓
Service Queue (SQS)
    ↓
AwsEventBus.StartConsuming()
    ↓
Event Handler
```

**Scheduled Events**:
- SLA deadlines: `ScheduleAsync()` creates EventBridge Scheduler job
- Escalation timeouts: `ScheduleAsync()` creates EventBridge Scheduler job
- Jobs execute at scheduled time and publish to EventBridge

#### Azure Implementation

**Components**:
- **Azure Service Bus**: Topics and queues
- **Azure Event Grid**: Optional event routing
- **Service Bus Scheduled Messages**: Delayed delivery

**Event Flow**:
```
Application Code
    ↓
IEventBus.PublishAsync()
    ↓
AzureEventBus
    ↓
Event Grid (if configured) OR Service Bus Topic
    ↓
Service Bus Queue/Subscription
    ↓
AzureEventBus.StartConsuming()
    ↓
Event Handler
```

#### GCP Implementation

**Components**:
- **Cloud Pub/Sub**: Topics and subscriptions
- **Cloud Scheduler**: Cron-based scheduled jobs

**Event Flow**:
```
Application Code
    ↓
IEventBus.PublishAsync()
    ↓
GcpEventBus
    ↓
Pub/Sub Topic
    ↓
Pub/Sub Subscription
    ↓
GcpEventBus.StartConsuming()
    ↓
Event Handler
```

### 14.4 Migration from RabbitMQ

#### What Changed

**Removed**:
- ❌ RabbitMQ exchanges and routing keys
- ❌ RabbitMQ delayed message exchange plugin
- ❌ `SLAMonitorService` polling background service
- ❌ `StageEscalationMonitorService` polling background service
- ❌ `IRabbitMQPublisher` and `IRabbitMQConsumer` interfaces

**Added**:
- ✅ `IEventBus` abstraction interface
- ✅ `EventBusFactory` for provider selection
- ✅ `AwsEventBus`, `AzureEventBus`, `GcpEventBus` implementations
- ✅ EventBridge Scheduler for delayed events
- ✅ `EventBusConstants` (replaces `RabbitMQConstants`)

**Preserved**:
- ✅ All event contracts unchanged
- ✅ All event handlers unchanged
- ✅ Idempotency logic intact
- ✅ Domain logic unchanged

#### Configuration Migration

**Before (RabbitMQ)**:
```json
{
  "RabbitMQ": {
    "HostName": "localhost",
    "Port": 5672,
    "UserName": "guest",
    "Password": "guest"
  }
}
```

**After (AWS)**:
```json
{
  "EventBus": {
    "Provider": "AWS",
    "AWS": {
      "Region": "us-east-1",
      "EventBusName": "default",
      "ServicePrefix": "task-manager",
      "SchedulerRoleArn": "arn:aws:iam::ACCOUNT_ID:role/EventBridgeSchedulerRole"
    }
  }
}
```

### 14.5 Switching Providers

To switch from AWS to Azure or GCP:

1. **Update `appsettings.json`**:
   ```json
   {
     "EventBus": {
       "Provider": "Azure",  // Change only this!
       "Azure": {
         "ServiceBusConnectionString": "...",
         ...
       }
     }
   }
   ```

2. **Restart services** - No code changes required

3. **Infrastructure Setup**:
   - Azure: Create Service Bus namespace, Event Grid topic
   - GCP: Enable Pub/Sub and Cloud Scheduler APIs, create service account

### 14.6 Benefits

1. **Zero Code Changes**: Switch providers via configuration
2. **Cloud Native**: Leverages managed cloud services
3. **No Infrastructure Management**: No RabbitMQ server to maintain
4. **Better Scalability**: Cloud services auto-scale
5. **Cost Optimization**: Choose provider based on requirements
6. **Vendor Flexibility**: Easy migration between clouds
7. **Scheduled Events**: Native scheduling (no polling needed)

---

## 15. Migration Guide: RabbitMQ to AWS EventBridge

### 15.1 Overview

This guide documents the migration from RabbitMQ to AWS EventBridge (and multi-cloud support) completed in January 2026.

### 15.2 What Was Changed

#### Code Changes

**Abstraction Layer** (New):
- `IEventBus` interface - Provider-agnostic event bus
- `IEventBusFactory` interface - Factory for provider selection
- `EventBusFactory` - Factory implementation
- `EventBusOptions` base class
- `AwsEventBusOptions`, `AzureEventBusOptions`, `GcpEventBusOptions`

**Implementations** (New):
- `AwsEventBus` - AWS EventBridge implementation
- `AzureEventBus` - Azure Service Bus implementation
- `GcpEventBus` - GCP Pub/Sub implementation

**Constants** (Updated):
- `EventBusConstants` - Replaces `RabbitMQConstants`
  - Event sources (replaces exchanges)
  - Detail types (replaces routing keys)
  - Queue names (per service)

**Service Updates**:
- All services updated to use `IEventBus` instead of `IRabbitMQPublisher`/`IRabbitMQConsumer`
- All `Program.cs` files updated with factory pattern registration
- All `appsettings.json` files updated with EventBus configuration

**Removed Services**:
- `SLAMonitorService` - Replaced by EventBridge Scheduler
- `StageEscalationMonitorService` - Replaced by EventBridge Scheduler

#### Infrastructure Changes

**Before**:
- RabbitMQ server (Docker or installed)
- RabbitMQ delayed message exchange plugin
- Manual queue/exchange setup

**After**:
- AWS EventBridge (default event bus)
- SQS queues (auto-created per service)
- EventBridge Scheduler (for delayed events)
- EventBridge Rules (route events to SQS)

### 15.3 Migration Steps

#### Step 1: Update Configuration

Update all `appsettings.json` files:
```json
{
  "EventBus": {
    "Provider": "AWS",
    "AWS": {
      "Region": "us-east-1",
      "EventBusName": "default",
      "ServicePrefix": "task-manager",
      "VisibilityTimeoutSeconds": 300,
      "MaxReceiveCount": 3,
      "SchedulerGroupName": "task-manager-schedules",
      "SchedulerRoleArn": "arn:aws:iam::ACCOUNT_ID:role/EventBridgeSchedulerRole"
    }
  }
}
```

#### Step 2: AWS Infrastructure Setup

1. **EventBridge**: Use default event bus (or create custom)
2. **IAM Role**: Create role for EventBridge Scheduler with permissions:
   - `events:PutEvents` (to publish to EventBridge)
   - `events:CreateSchedule`, `events:UpdateSchedule`, `events:DeleteSchedule`
3. **EventBridge Rules**: Create rules to route events to SQS queues
4. **SQS Queues**: Auto-created by `AwsEventBus` on first use

#### Step 3: Deploy and Test

1. Deploy updated services
2. Verify events are published to EventBridge
3. Verify events are consumed from SQS queues
4. Verify scheduled events fire at correct times

### 15.4 Backward Compatibility

- ✅ All event contracts unchanged
- ✅ All event handlers unchanged
- ✅ All domain logic preserved
- ✅ Idempotency logic intact
- ✅ Default provider is AWS (if Provider not specified)

### 15.5 Rollback Plan

If issues occur, you can:
1. Revert to RabbitMQ by implementing `RabbitMQEventBus` adapter
2. Add RabbitMQ case to `EventBusFactory`
3. Update configuration to `"Provider": "RabbitMQ"`

### 15.6 Testing Checklist

- [ ] All services start without errors
- [ ] Events are published successfully
- [ ] Events are consumed by handlers
- [ ] Scheduled SLA deadline events fire correctly
- [ ] Scheduled escalation timeout events fire correctly
- [ ] Idempotency checks work correctly
- [ ] Event handlers process events correctly
- [ ] No duplicate event processing
- [ ] DLQ receives failed messages

---

**Document Version**: 3.3  
**Last Updated**: June 2026  
**Author**: System Documentation

**Version History**:
- **v3.3** (June 2026): Task audit API (`GET`/`POST /api/tasks/{id}/audit`, `TaskAuditEntries` table, TaskService `TaskAuditRecorder`); member task summary (`GET /api/tasks/member/summary/{memberId}`); `TaskReadDtoEnricher` for consistent `stageName`/`assignedToMemberName` on member task lists; frontend `TaskAuditModal`, Tasks page history icon, Member detail unified Tasks table; Workload.API schema aligned (no `OrganizationId` on Members/Tasks); see `endpoints.txt` sections 9–12
- **v3.2** (February 2026): Added `GET /api/roles/all` (API key via `X-Api-Key`); gateway `Auth:ExcludedPathPrefixes` includes `/api/roles/all`; WorkflowManagement.API `ApiKeys:GetAllRoles` and deploy `ROLES_API_KEY`
- **v3.1** (February 2026): Added Auth proxy endpoint `GET /api/auth/organizationuser` for active organization users (product_id + tenant_id from JWT); frontend `REACT_APP_PRODUCT_ID` env and `userService.getActiveOrganizationUsers` for Users, Members, Workflow Wizard pages
- **v3.0** (January 2026): Migrated from RabbitMQ to multi-cloud event bus architecture (AWS/Azure/GCP)
- **v2.0** (January 2026): Added stage orchestration and automatic reassignment
- **v1.0** (Initial): Core workflow management system
