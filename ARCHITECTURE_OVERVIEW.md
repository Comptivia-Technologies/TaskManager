# System Architecture Overview

## 📋 Table of Contents
1. [SLA Configuration API](#1-sla-configuration-api)
2. [Workflow Management API](#2-workflow-management-api)
3. [Workload API](#3-workload-api)
4. [Workflow UI (Frontend)](#4-workflow-ui-frontend)
5. [Database Schema](#5-database-schema)
6. [Data Flow & Interactions](#6-data-flow--interactions)

---

## 1. SLA Configuration API

### **Purpose**
Manages Service Level Agreement (SLA) configurations for workflows. Defines priority levels (e.g., "Critical", "High", "Very High") and their corresponding response times for each workflow.

### **Port**: `http://localhost:5001` (or configured port)

### **Key Entities**

#### **SLAConfiguration Model**
```csharp
- SLAConfigurationId (int, PK)
- WorkflowId (int, FK → Workflows) - One SLA per workflow
- PriorityLevelsJson (string, JSONB) - Stores dynamic priority levels
  Format: { "Critical": { "responseTime": 30 }, "High": { "responseTime": 60 }, ... }
- CreatedAt (DateTime)
- UpdatedAt (DateTime)
```

### **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sla-configurations` | Get all SLA configurations |
| GET | `/api/sla-configurations/workflow/{workflowId}` | Get SLA for specific workflow |
| POST | `/api/sla-configurations` | Create new SLA configuration |
| PUT | `/api/sla-configurations/workflow/{workflowId}` | Update SLA configuration |
| DELETE | `/api/sla-configurations/workflow/{workflowId}` | Delete SLA configuration |

### **Key Features**
- **Dynamic Priority Levels**: Users can create any number of custom priority levels (not limited to 4)
- **JSONB Storage**: Uses PostgreSQL JSONB for flexible priority level storage
- **One-to-One**: Each workflow has exactly one SLA configuration
- **Response Times**: Each priority level has a response time in minutes

### **Architecture**
```
Controller (SLAConfigurationsController)
    ↓
Service (SLAService) - Business logic, JSON serialization/deserialization
    ↓
Repository (SLARepository) - Data access
    ↓
Database (PostgreSQL) - SLAConfigurations table
```

---

## 2. Workflow Management API

### **Purpose**
Core API for managing workflows, teams, members, stages, and tasks. This is the central hub for all workflow-related operations.

### **Port**: `http://localhost:5000` (or configured port)

### **Key Entities**

#### **Team Model**
```csharp
- TeamId (int, PK)
- TeamName (string)
- Description (string, optional)
- CreatedAt (DateTime)
- UpdatedAt (DateTime)
- Navigation: Members[], Workflows[]
```

#### **Member Model**
```csharp
- MemberId (int, PK)
- FirstName (string)
- LastName (string)
- Email (string)
- TeamId (int, FK → Teams)
- Role (string) - e.g., "Senior", "Junior", "Developer"
- SkillLevel (int) - 1-5 (1=Beginner, 5=Expert)
- CreatedAt (DateTime)
- UpdatedAt (DateTime)
- Navigation: Team, AssignedTasks[]
```

#### **Workflow Model**
```csharp
- WorkflowId (int, PK)
- WorkflowName (string)
- Description (string, optional)
- TeamId (int?, FK → Teams, nullable) - Optional workflow-level team
- WorkflowJson (string, JSONB, optional) - Complete workflow snapshot
- CreatedAt (DateTime)
- UpdatedAt (DateTime)
- Navigation: Team?, Stages[], Tasks[]
```

#### **Stage Model**
```csharp
- StageId (int, PK)
- StageName (string) - e.g., "To Do", "In Progress", "Done"
- StageOrder (int) - Order within workflow
- WorkflowId (int, FK → Workflows)
- TeamId (int, FK → Teams) - Team assigned to this stage
- CreatedAt (DateTime)
- Navigation: Workflow, Team, Tasks[]
```

#### **Task Model**
```csharp
- TaskId (int, PK)
- TaskName (string)
- Description (string, optional)
- Status (string) - "Pending", "In Progress", "Completed", etc.
- Priority (string) - "Low", "Medium", "High", etc.
- DueDate (DateTime, optional)
- WorkflowId (int, FK → Workflows)
- StageId (int?, FK → Stages, nullable)
- AssignedToMemberId (int?, FK → Members, nullable)
- CreatedAt (DateTime)
- UpdatedAt (DateTime)
- Navigation: Workflow, Stage?, AssignedToMember?
```

### **API Endpoints**

#### **Teams**
- `GET /api/teams` - Get all teams
- `GET /api/teams/{id}` - Get team by ID
- `POST /api/teams` - Create team
- `PUT /api/teams/{id}` - Update team
- `DELETE /api/teams/{id}` - Delete team
- `GET /api/teams/{id}/members` - Get team members
- `GET /api/teams/{id}/workflows` - Get team workflows

#### **Members**
- `GET /api/members` - Get all members
- `GET /api/members/{id}` - Get member by ID
- `POST /api/members` - Create member
- `PUT /api/members/{id}` - Update member
- `DELETE /api/members/{id}` - Delete member
- `GET /api/members/{id}/tasks` - Get member's tasks

#### **Workflows**
- `GET /api/workflows` - Get all workflows
- `GET /api/workflows/{id}` - Get workflow by ID
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow
- `GET /api/workflows/{id}/stages` - Get workflow stages
- `GET /api/workflows/{id}/tasks` - Get workflow tasks
- `GET /api/workflows/{id}/json` - Get workflow JSON
- `POST /api/workflows/{id}/update-json` - Update workflow JSON

#### **Stages**
- `GET /api/stages` - Get all stages
- `GET /api/stages/{id}` - Get stage by ID
- `POST /api/stages` - Create stage
- `PUT /api/stages/{id}` - Update stage
- `DELETE /api/stages/{id}` - Delete stage

#### **Tasks**
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{id}` - Get task by ID
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/workflow/{workflowId}` - Get tasks by workflow
- `GET /api/tasks/stage/{stageId}` - Get tasks by stage
- `GET /api/tasks/member/{memberId}` - Get tasks by member

### **Key Features**
- **Hierarchical Structure**: Workflow → Stages → Tasks
- **Team Assignment**: Teams can be assigned at workflow level (optional) or stage level (required)
- **Member Assignment**: Tasks can be assigned to members
- **JSONB Workflow Snapshots**: Complete workflow structure stored as JSON for easy retrieval
- **Cascading Deletes**: Deleting workflow deletes stages, deleting stages sets tasks.StageId to NULL

### **Architecture**
```
Controllers (TeamsController, MembersController, WorkflowsController, StagesController, TasksController)
    ↓
Services (TeamService, MemberService, WorkflowService, StageService, TaskService)
    ↓
Repositories (TeamRepository, MemberRepository, WorkflowRepository, StageRepository, TaskRepository)
    ↓
Database (PostgreSQL) - Teams, Members, Workflows, Stages, Tasks tables
```

---

## 3. Workload API

### **Purpose**
Calculates and manages team member workload. Evaluates member availability and workload status based on multiple factors.

### **Port**: `http://localhost:5003` (or configured port)

### **Key Entities**

#### **Workload Model** (History/Snapshot)
```csharp
- WorkloadId (int, PK)
- MemberId (int, FK → Members)
- WorkloadScore (double) - 0-100
- WorkloadStatus (string) - "Available", "PartiallyLoaded", "FullyLoaded", "Overloaded"
- Efficiency (double) - 0-1
- SkillLevel (int) - 1-5
- TaskCompletionRate (double) - 0-100%
- ActiveTaskCount (int)
- PendingTaskCount (int)
- IsAvailable (bool)
- CalculatedAt (DateTime)
- CreatedAt (DateTime)
```

#### **Member Model** (Reference)
```csharp
- MemberId (int, PK)
- FirstName, LastName, Email
- TeamId (int)
- Role (string)
- SkillLevel (int) - 1-5
```

#### **Task Model** (Reference)
```csharp
- TaskId (int, PK)
- TaskName, Description
- Status (string) - Used to categorize: Active, Pending, Completed
- Priority (string)
- AssignedToMemberId (int?)
```

### **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/workload/{memberId}` | Get workload summary for a member |

### **Workload Calculation Logic**

#### **Metrics Calculated:**
1. **Efficiency** (30% weight)
   - Formula: `Completed Tasks / Total Tasks`
   - If 0 tasks: Efficiency = 1.0 (perfect)

2. **Skill Level** (20% weight)
   - From Member.SkillLevel (1-5)
   - Lower skill = higher workload score

3. **Task Completion Rate** (20% weight)
   - Formula: `(Completed Tasks / Total Tasks) × 100%`
   - If 0 tasks: 100% (perfect)

4. **Active Task Load** (20% weight)
   - Formula: `min(100, ActiveTaskCount × 10)`
   - 0 tasks = 0, 10+ tasks = 100

5. **Availability** (10% weight)
   - Available if active tasks < 5
   - Not available if active tasks ≥ 5

#### **Score Calculation:**
```
Workload Score = 
  (EfficiencyScore × 30%) +
  (SkillLevelScore × 20%) +
  (TaskCompletionScore × 20%) +
  (ActiveTaskLoadScore × 20%) +
  (AvailabilityScore × 10%)
```

#### **Status Determination:**
- **Available**: Score < 30
- **PartiallyLoaded**: Score 30-60
- **FullyLoaded**: Score 60-85
- **Overloaded**: Score ≥ 85

#### **Special Case: 0 Tasks**
When a member has 0 tasks:
- All scores are minimal (0 or near 0)
- Only skill level contributes minimally (10% of normal)
- Result: Score 0-2 → "Available"

### **Key Features**
- **Real-time Calculation**: Calculated on-demand when requested
- **History Tracking**: Saves snapshots to Workloads table for historical analysis
- **Multi-factor Analysis**: Considers 5 different factors
- **Weighted Scoring**: Each factor has a specific weight
- **Reads from WorkflowManagement DB**: Queries Members and Tasks from the same database

### **Architecture**
```
Controller (WorkloadController)
    ↓
Service (WorkloadService) - Calculation logic
    ↓
Repository (WorkloadRepository) - Workload history
    ↓
Database (PostgreSQL) - Workloads table (history), Members & Tasks (reference)
```

---

## 4. Workflow UI (Frontend)

### **Technology Stack**
- **Framework**: React with TypeScript
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Icons**: React Icons (Feather Icons)
- **Notifications**: React Toastify

### **Project Structure**

```
frontend/workflow/src/
├── components/          # Reusable UI components
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── LoadingSpinner.tsx
│   ├── SLAConfigure.tsx      # SLA configuration form
│   ├── WorkflowCreate.tsx    # Create workflow form
│   ├── WorkflowEdit.tsx      # Edit workflow & stages
│   ├── WorkflowStagesView.tsx # Stage visualization
│   ├── KanbanBoard.tsx       # Kanban board for tasks
│   ├── KanbanColumn.tsx      # Kanban column component
│   └── TaskCard.tsx          # Task card component
│
├── pages/              # Page components
│   ├── Dashboard.tsx   # Main dashboard
│   ├── Workflows.tsx   # Workflows list
│   ├── WorkflowDetail.tsx # Workflow detail view
│   ├── Teams.tsx       # Teams management
│   ├── Members.tsx     # Members management
│   ├── SLAConfiguration.tsx # SLA configuration page
│   └── WorkloadConfiguration.tsx # Workload monitoring
│
├── services/           # API service clients
│   ├── api.ts         # Base API client (WorkflowManagement API)
│   ├── slaApi.ts      # SLA API client
│   ├── workloadService.ts # Workload API client
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

### **Pages & Features**

#### **1. Dashboard** (`/`)
- Overview of workflows, teams, members
- Statistics and summaries

#### **2. Workflows** (`/workflows`)
- List all workflows
- Create new workflows
- Edit workflows (name, description, stages)
- Delete workflows
- View workflow details

#### **3. Workflow Detail** (`/workflows/:id`)
- Detailed view of a workflow
- Shows all stages and tasks
- Kanban board visualization
- Task management

#### **4. Teams** (`/teams`)
- List all teams
- Create/Edit/Delete teams
- View team details (members, workflows)
- Add members to teams

#### **5. Members** (`/members`)
- List all members
- Create/Edit/Delete members
- Search and filter by team
- Set skill level (1-5)

#### **6. SLA Configuration** (`/sla-configuration`)
- Configure priority levels for workflows
- Add/Edit/Remove custom priority levels
- Set response times for each priority

#### **7. Workload Configuration** (`/workload-configuration`)
- View all members with workload metrics
- See workload score, status, efficiency, skill level
- Search members
- Refresh workload calculations

### **Data Flow (Frontend)**

```
User Action (UI)
    ↓
Service Layer (workflowService, memberService, etc.)
    ↓
API Client (axios)
    ↓
Backend API (WorkflowManagement/SLA/Workload)
    ↓
Database (PostgreSQL)
    ↓
Response → UI Update
```

### **State Management**
- **React Hooks**: `useState`, `useEffect` for local state
- **Custom Hooks**: `useWorkflows`, `useTeams`, `useMembers` for data fetching
- **No Global State**: Each component manages its own state

---

## 5. Database Schema

### **PostgreSQL Database: `WorkflowManagement`**

#### **Tables:**

1. **Teams**
   - `TeamId` (PK)
   - `TeamName`, `Description`
   - `CreatedAt`, `UpdatedAt`

2. **Members**
   - `MemberId` (PK)
   - `FirstName`, `LastName`, `Email`
   - `TeamId` (FK → Teams)
   - `Role`, `SkillLevel` (1-5)
   - `CreatedAt`, `UpdatedAt`

3. **Workflows**
   - `WorkflowId` (PK)
   - `WorkflowName`, `Description`
   - `TeamId` (FK → Teams, nullable)
   - `WorkflowJson` (JSONB, optional)
   - `CreatedAt`, `UpdatedAt`

4. **Stages**
   - `StageId` (PK)
   - `StageName`, `StageOrder`
   - `WorkflowId` (FK → Workflows)
   - `TeamId` (FK → Teams)
   - `CreatedAt`

5. **Tasks**
   - `TaskId` (PK)
   - `TaskName`, `Description`
   - `Status`, `Priority`
   - `DueDate`
   - `WorkflowId` (FK → Workflows)
   - `StageId` (FK → Stages, nullable)
   - `AssignedToMemberId` (FK → Members, nullable)
   - `CreatedAt`, `UpdatedAt`

6. **SLAConfigurations** (SLA API)
   - `SLAConfigurationId` (PK)
   - `WorkflowId` (FK → Workflows, unique)
   - `PriorityLevelsJson` (JSONB)
   - `CreatedAt`, `UpdatedAt`

7. **Workloads** (Workload API)
   - `WorkloadId` (PK)
   - `MemberId` (FK → Members)
   - `WorkloadScore`, `WorkloadStatus`
   - `Efficiency`, `SkillLevel`, `TaskCompletionRate`
   - `ActiveTaskCount`, `PendingTaskCount`, `IsAvailable`
   - `CalculatedAt`, `CreatedAt`

### **Relationships**

```
Teams (1) ──→ (N) Members
Teams (1) ──→ (N) Workflows (optional)
Teams (1) ──→ (N) Stages

Workflows (1) ──→ (N) Stages
Workflows (1) ──→ (N) Tasks
Workflows (1) ──→ (1) SLAConfigurations

Stages (1) ──→ (N) Tasks
Stages (N) ──→ (1) Teams

Members (1) ──→ (N) Tasks (assigned)
Members (1) ──→ (N) Workloads (history)
```

---

## 6. Data Flow & Interactions

### **Workflow Creation Flow**

```
1. User creates workflow in UI
   ↓
2. Frontend: workflowService.create()
   ↓
3. WorkflowManagement API: POST /api/workflows
   ↓
4. WorkflowService creates workflow in database
   ↓
5. User adds stages to workflow
   ↓
6. Frontend: stageService.create() for each stage
   ↓
7. WorkflowManagement API: POST /api/stages
   ↓
8. StageService creates stages with TeamId assignments
```

### **SLA Configuration Flow**

```
1. User configures SLA for a workflow
   ↓
2. Frontend: slaService.create() or update()
   ↓
3. SLA API: POST/PUT /api/sla-configurations
   ↓
4. SLAService stores priority levels as JSONB
   ↓
5. Format: { "Critical": { "responseTime": 30 }, ... }
```

### **Workload Calculation Flow**

```
1. User views Workload Configuration page
   ↓
2. Frontend: workloadService.getByMemberId() for each member
   ↓
3. Workload API: GET /api/workload/{memberId}
   ↓
4. WorkloadService:
   a. Queries Member from database
   b. Queries all Tasks assigned to member
   c. Calculates metrics (efficiency, skill, completion, etc.)
   d. Calculates breakdown scores
   e. Calculates weighted workload score
   f. Determines status (Available/PartiallyLoaded/etc.)
   g. Saves snapshot to Workloads table
   h. Returns WorkloadResponseDto
   ↓
5. Frontend displays workload data in table
```

### **Task Assignment Flow**

```
1. User creates/assigns task
   ↓
2. Frontend: taskService.create() or update()
   ↓
3. WorkflowManagement API: POST/PUT /api/tasks
   ↓
4. TaskService creates/updates task with:
   - WorkflowId
   - StageId (optional)
   - AssignedToMemberId (optional)
   ↓
5. Task appears in workflow/stage view
   ↓
6. When workload is calculated, task affects member's workload score
```

### **Inter-API Communication**

- **SLA API** ↔ **WorkflowManagement API**: SLA API queries Workflows table to validate workflow exists
- **Workload API** ↔ **WorkflowManagement API**: Workload API queries Members and Tasks tables for calculations
- **All APIs**: Share the same PostgreSQL database (`WorkflowManagement`)

---

## 7. Key Design Patterns

### **Backend**
- **Repository Pattern**: Data access abstraction
- **Service Layer**: Business logic separation
- **DTO Pattern**: Data transfer objects for API responses
- **AutoMapper**: Entity ↔ DTO mapping
- **Dependency Injection**: All services/repositories registered in Program.cs

### **Frontend**
- **Service Layer Pattern**: API calls abstracted in service files
- **Custom Hooks**: Reusable data fetching logic
- **Component Composition**: Reusable UI components
- **Type Safety**: TypeScript interfaces for all data structures

---

## 8. Configuration & Setup

### **Backend APIs**
- All use PostgreSQL (same database: `WorkflowManagement`)
- Connection strings in `appsettings.json` / `appsettings.Development.json`
- CORS enabled for `http://localhost:3000` (React app)
- AutoMapper for DTO mapping
- Exception handling middleware

### **Frontend**
- Base API URL: `http://localhost:5000` (WorkflowManagement API)
- SLA API URL: `http://localhost:5001` (SLA API)
- Workload API URL: `http://localhost:5003` (Workload API)
- React app runs on `http://localhost:3000`

---

## Summary

**SLA API**: Manages priority levels and response times for workflows  
**WorkflowManagement API**: Core API for workflows, teams, members, stages, tasks  
**Workload API**: Calculates member workload and availability  
**Workflow UI**: React frontend for managing all aspects of the system

All APIs share the same PostgreSQL database and follow consistent architectural patterns (Controller → Service → Repository → Database).

