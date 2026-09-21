# Project Document Till Now

**Task Management & Workflow Orchestration System**  
**Audience:** anyone taking over the repo with no prior context  
**Code snapshot:** current workspace as of 17 Sep 2026 (includes local RabbitMQ event bus work)

There is an older file `COMPLETE_PROJECT_DOCUMENTATION.md`. Treat **this document** as the current working picture; that older file still describes AWS EventBridge as the default local path.

---

## 1. What this system is

A **generic workflow engine** for ERP-style process work and ticketing-style escalation.

Operators configure:

- **Workflows** with ordered **stages**
- **Teams** and **members** (assignees)
- **SLA** (priority → response time)
- **Priority rules** (condition JSON → priority)
- **Workload** (who should get the task)

When a **task is created**, the system does **not** pick workflow / priority / SLA / assignee in the HTTP request. It publishes events. Downstream services do that asynchronously.

Two workflow types:

| Type | Stage advances when | Typical use |
|------|---------------------|-------------|
| **Process** | User/API completes the stage | ERP: human finishes a step |
| **Escalation** | Timeout (or manual escalate) | Ticketing: unhandled work moves up |

Core design rules (also in `.cursor/rules`):

- Frontend talks only to the **API Gateway**
- CRUD APIs own configuration data
- Orchestration microservices own runtime state and events
- Controllers do not publish domain events; application services do
- Stage progression lives only in **WorkflowService**
- Assignment/reassignment lives only in **WorkloadService**
- Priority evaluation lives only in **PriorityRuleEngine**
- SLA deadlines come from configured priority levels, not hardcoded values
- Consumers are **idempotent** (stored event IDs)

---

## 2. Tech stack

| Layer | Technology |
|--------|------------|
| Frontend | React 18, TypeScript, CRA (`react-scripts`), Tailwind, axios, Firebase Auth, react-router-dom 6 |
| Backend | .NET Web API, async/await, EF Core / PostgreSQL |
| Gateway | YARP reverse proxy |
| Auth | Firebase Auth (ID tokens) + Product Hub (external user/tenant API) |
| Events | `IEventBus` factory: **RabbitMQ** (local), AWS EventBridge, Azure, GCP |
| Databases | PostgreSQL, multiple DBs |
| Local scripts | `scripts/start-rabbitmq.ps1`, `scripts/start-backend.ps1` |

Frontend path: `frontend/workflow`  
Backend path: `backend/`

---

## 3. Architecture

**Hybrid:** REST for CRUD + events for orchestration.

```
Browser (localhost:3000)
        |
        | Authorization: Bearer <Firebase ID token>
        v
API Gateway  :5004
  - JWT validation
  - org claim → X-Organization-Id
  - YARP proxy to CRUD APIs
  - POST /api/task-service → TaskService
  - /api/auth/* → Product Hub (HttpClient proxy)
        |
        +-- WorkflowManagement.API :5000  (workflows, stages, teams, members, tasks list, roles)
        +-- SLAConfiguration.API   :5002
        +-- Workload.API           :5003
        +-- PriorityRuleEngine.API :5010
        +-- TaskService            :5005  (create + stage complete/escalate + orchestration DB)
        |
        v
Event bus (local: RabbitMQ :5672, exchange task-manager)
        |
        +-- WorkflowService    :5006  select workflow, orchestrate stages
        +-- PriorityRuleEngine :5010  also consumes WorkflowSelected
        +-- SLAManagerService  :5007  assign SLA, schedule overdue
        +-- WorkloadService    :5008  assign / reassign members
        +-- TaskService        :5005  mirrors lifecycle onto its Task row
```

**Two-tier services**

| Tier | Services | Job |
|------|----------|-----|
| REST CRUD | WorkflowManagement, SLAConfiguration, Workload.API, PriorityRuleEngine (HTTP) | Config and query |
| Orchestration | TaskService, WorkflowService, SLAManagerService, WorkloadService, PriorityRuleEngine (consumer) | Runtime pipeline |

Shared libraries:

- `backend/Shared/Shared.Contracts` — event DTOs + `EventBusConstants`
- `backend/Shared/Shared.Messaging` — `IEventBus`, factory, AWS/Azure/GCP/RabbitMQ

---

## 4. How to run locally (new developer)

### Prerequisites

1. .NET SDK (SDK-style Web APIs)
2. Node.js (CRA)
3. PostgreSQL on `localhost:5432`
4. Docker Desktop (for RabbitMQ)

### 4.1 Databases

Create these PostgreSQL databases (names used in Development appsettings):

| Database | Used by |
|----------|---------|
| **WorkflowManagement** | WorkflowManagement.API, WorkflowService, SLAConfiguration.API, SLAManagerService, Workload.API, WorkloadService |
| **TaskService** | TaskService |
| **PriorityRuleEngine** | PriorityRuleEngine.API |

Connection pattern: `ConnectionStrings:DefaultConnection` in each service's `appsettings.Development.json`.  
If empty, services fall back to `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.

There are **no EF Core Migrations folders**. Schema is created/altered at startup (`EnsureCreated` and/or raw SQL). First start against an empty DB should create tables.

### 4.2 RabbitMQ

```powershell
.\scripts\start-rabbitmq.ps1
```

- AMQP: `localhost:5672` (guest/guest)
- UI: http://localhost:15672
- Image: `heidiks/rabbitmq-delayed-message-exchange` (delayed-message plugin for SLA/escalation timeouts)

Development appsettings set `"EventBus": { "Provider": "RabbitMQ" }`.  
Override with env `EVENTBUS_PROVIDER`.

### 4.3 Backend

```powershell
.\scripts\start-backend.ps1
```

Opens one PowerShell window per service (`dotnet run --launch-profile http`):

| Service | Port |
|---------|------|
| WorkflowManagement.API | 5000 |
| SLAConfiguration.API | 5002 |
| Workload.API | 5003 |
| APIGateway | **5004** (frontend target) |
| TaskService | 5005 |
| WorkflowService | 5006 |
| SLAManagerService | 5007 |
| WorkloadService | 5008 |
| PriorityRuleEngine.API | 5010 |

Gateway Swagger (Development): http://localhost:5004/swagger

### 4.4 Frontend

```powershell
cd frontend/workflow
npm install
npm run start:dev
```

Uses `.env.development`:

- `REACT_APP_API_URL=http://localhost:5004`
- `REACT_APP_AUTH_API_URL` — Product Hub (auth proxy still goes through gateway)
- `REACT_APP_FIREBASE_*` — Firebase project id
- `REACT_APP_PRODUCT_ID` — Product Hub product GUID

Default CRA port: **3000**. After login, app lands on `/workflows`.

### 4.5 Sanity check

1. Gateway `/health`
2. Login with a Product Hub / Firebase tenant user
3. Create a workflow via the wizard
4. Create a task via `POST /api/task-service` (UI currently has **no task-create form**; use Swagger or HTTP client)
5. Watch RabbitMQ UI and service logs for `TaskCreated` → `WorkflowSelected` → `PriorityAssigned` → `SLAConfigured` → `TaskAssigned` → `TaskStageStarted`

---

## 5. Frontend — structure

```
frontend/workflow/src/
  App.tsx                 routes
  pages/                  screens
  components/             Sidebar, wizard, SLA, conditions, etc.
  contexts/AuthContext.tsx
  services/               axios clients (never fetch from pages except tenant lookup)
  hooks/                  useWorkflows, useTeams, useMembers
  types/index.ts
  utils/                  cookies, JWT org claim, dates
  firebase/config.ts
```

**Conventions:** functional components + hooks; business calls go through `services/`; Tailwind (no new inline-style systems). `react-hook-form` is in `package.json` but unused — forms use `useState`.

---

## 6. UI routes and how each page works

All pages except `/login` wrap **Sidebar + ProtectedRoute**. Sidebar is fixed 256px (`ml-64` content). Theme: navy sidebar `#434E78`.

| Path | Page | What it does |
|------|------|----------------|
| `/login` | `Login.tsx` | Public. Email → tenant lookup → password. Sign-in or sign-up. Success → `/workflows` |
| `/` | redirect | Goes to `/workflows` |
| `/workflows` | `Workflows.tsx` | List, create (wizard), edit, delete, configure SLA, jump to priority rules |
| `/workflows/:id` | `WorkflowDetail.tsx` | Read-only stages + JSON toggle |
| `/teams` | `Teams.tsx` | Team CRUD, assign members, nested member CRUD, related workflows |
| `/members` | `Members.tsx` | Member CRUD, team filter, pick Product Hub users on create |
| `/members/:id` | `MemberDetail.tsx` | Read-only member + categorized tasks |
| `/tasks` | `Tasks.tsx` | Paginated task **list** + priority filter. Click row → workflow detail. **No create/edit/delete UI** |
| `/sla-configuration` | `SLAConfiguration.tsx` | SLA cards per workflow; open configure modal. No delete button |
| `/workload-configuration` | `WorkloadConfiguration.tsx` | Read-only workload scores per member |
| `/priority-rules` | `PriorityRules.tsx` | CRUD rules; ConditionBuilder; global vs workflow-scoped |
| `/users` | `Users.tsx` | Product Hub org users: active / pending / archived |
| `/roles-permissions` | `RolesPermissions.tsx` | Roles CRUD + permission codes; permissions list is read-only |

**Not routed (code exists, do not assume they are live):**

- `Dashboard.tsx`
- `KanbanBoard` / `KanbanColumn` / `TaskCard` (DnD + inline status/priority)
- `WorkflowCreate.tsx` (superseded by `WorkflowWizard`)

**Permissions do not hide menus.** Every logged-in user sees every nav item. Roles/permissions are admin data, not route guards.

### 6.1 Login (`Login.tsx`)

1. User enters email.
2. `GET /api/auth/tenant/{email}` (no Bearer) via `tenantService` (`fetch`, not axios).
3. If multiple tenants → pick one; if one → auto-set Firebase `tenantId`.
4. Password step: Firebase `signIn` / `signUp` with that tenant.
5. ID token stored in `localStorage` (`authToken`, `authTokenExpiry`).
6. JWT claim `organizationId` → cookie `organizationId` (7 days, SameSite=Lax).

### 6.2 Workflows + wizard (primary setup path)

`Workflows.tsx` uses `useWorkflows` + `workflowService.delete`.

**Create** opens `WorkflowWizard` (6 steps):

1. Intro
2. Add members (optional skip; can pick Product Hub users)
3. Create/select team
4. Workflow name + stages (`stageType`, `transitionPolicy`, `timeoutMinutes`, `teamId`)
5. SLA (`SLAConfigure`)
6. Priority rules (`ConditionBuilder`)

This is the intended “configure a new process” path. After that, tasks are expected to be created via **TaskService**, not this UI.

**Edit** uses `WorkflowEdit` (name/description/stages via `workflowService` + `stageService`).

**Detail** uses `WorkflowStagesView` (timeline) and JSON copy.

### 6.3 Teams / Members

- Members have `skillLevel` (used in workload scoring).
- Team membership is `member.teamId`.
- Creating a member can attach a Product Hub `userId`.

### 6.4 Tasks page

- `taskService.getAllPaginated` → **`GET /api/tasks?priority&page&limit`**
- That hits **WorkflowManagement** (CRUD copy), not TaskService.
- `PAGE_SIZE = 10`; refetch on window focus / visibility / online.
- Completing/escalating a stage is **not** exposed in this page. APIs exist: `POST /api/task-service/complete-stage/{id}` and `escalate-stage/{id}`.

### 6.5 SLA / Workload / Priority

- SLA: JSON map of priority name → `{ responseTime: minutes }`.
- Workload page is display-only (`GET /api/workload/{memberId}`).
- Priority rules: `conditionsJson` like `{ "all": [{ "path": "$.taskType", "op": "eq", "value": "..." }] }`. `salience` = evaluation order (higher first). `workflowId` null = global rule.

### 6.6 Users / Roles

- Users live in **Product Hub**, not in WorkflowManagement DB.
- Roles/permissions live in **WorkflowManagement** (`Roles`, `Permissions`, `RolePermissions`).
- Need `organizationId` from the token; otherwise create buttons stay disabled.

---

## 7. Authentication (end to end)

### 7.1 Identity provider

Firebase project configured in `frontend/workflow/src/firebase/config.ts` from `REACT_APP_FIREBASE_*`.  
Multi-tenant: `auth.tenantId` is set before sign-in.

Product Hub (`AuthService:BaseUrl`, default `https://dev.api.product-hub.comptivia.com`):

- Resolves tenant from email
- Org user CRUD / invitations / status
- Users are **not** stored in this repo’s databases

### 7.2 Frontend

| Piece | File | Behavior |
|--------|------|----------|
| Context | `AuthContext.tsx` | `user`, `loading`, `organizationId`, `currentTenantId`, signIn/Up/Out, tokens |
| Persistence | `authService.ts` | Firebase `browserLocalPersistence` |
| Guard | `ProtectedRoute.tsx` | No Firebase user → `/login` |
| API | `services/api.ts` | `Authorization: Bearer` from `localStorage`; on 401 refresh token once, else redirect `/login` |

`services/authApi.ts` (base `REACT_APP_AUTH_API_URL`) is **unused**. User APIs go through the gateway `api` client.

### 7.3 Gateway

`backend/APIGateway/Program.cs`:

1. JWT Bearer against `https://securetoken.google.com/{Firebase:ProjectId}`  
   Audience = Firebase project id.
2. `OrganizationAuthMiddleware` **after** `UseAuthentication`.
3. Excluded paths (no JWT): `/health`, `/api/auth/tenant`, `/api/roles/all`, `/swagger`.
4. Other paths: 401 if not authenticated.
5. Reads claim `organizationId` → `HttpContext.Items["OrganizationId"]`.
6. Tenant from `tenant_id` / `firebase.tenant` / nested `firebase` JSON.
7. YARP transform `ForwardOrganizationIdTransform` adds header **`X-Organization-Id`**.

Downstream services (`CurrentOrganizationAccessor`) filter by that header.  
**TaskService create throws if `X-Organization-Id` is missing.**

### 7.4 Authorization reality

- Multi-tenant boundary = **organization id**, not per-endpoint roles.
- `GET /api/roles/all` uses header `X-Api-Key` (`ApiKeys:GetAllRoles`), not JWT (and is gateway-excluded).
- Do not assume UI or APIs enforce permission codes on every action.

### 7.5 Cookies

Cookie `organizationId` is for the SPA only. APIs authenticate with **Bearer JWT**, not cookies.

---

## 8. API Gateway routing

Frontend must call **only port 5004**. Paths are preserved.

| Incoming path | Destination |
|---------------|-------------|
| `/api/workflows/**` | :5000 WorkflowManagement |
| `/api/teams/**` | :5000 |
| `/api/members/**` | :5000 |
| `/api/stages/**` | :5000 |
| `/api/permissions/**` | :5000 |
| `/api/roles/**` | :5000 |
| `GET /api/tasks` | :5000 (list) |
| `GET/PUT/DELETE /api/tasks/{**}` | :5000 — **except** `GET /api/tasks/{guid}` is handled by **gateway controller** (enriches TaskService + WF names) |
| `POST /api/task-service` and `/api/task-service/**` | :5005 TaskService |
| `/api/sla-configurations/**` | :5002 |
| `/api/priority-rules/**` | :5010 |
| `/api/workload/**` | :5003 |
| `/api/auth/**` | Gateway `AuthController` → Product Hub |
| `/health` | Gateway health |

YARP addresses can be overridden:

`ReverseProxy__Clusters__{cluster}__Destinations__{dest}__Address`

**Important split:**

- **Orchestrated create:** `POST /api/task-service`
- **UI task list:** `GET /api/tasks` (WorkflowManagement copy)
- **Direct `POST /api/tasks`** on WorkflowManagement writes the CRUD DB only and **does not** start the event pipeline

---

## 9. Endpoints (all HTTP)

Base URL locally: `http://localhost:5004`

### 9.1 Auth (gateway → Product Hub)

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/api/auth/tenant/{email}` | Public | Tenant lookup |
| POST | `/api/auth/organizationuser/create` | Bearer | Body forwarded as JSON |
| GET | `/api/auth/organizationuser?product_id=&organization_id?` | Bearer | Organization from token if omitted |
| PUT | `/api/auth/organizationuser/{userId}?product_id=` | Bearer | |
| DELETE | `/api/auth/users/{userId}` | Bearer | |
| PATCH | `/api/auth/users/{userId}/status` | Bearer | Body `{ status }` |
| GET | `/api/auth/users/organization/{organizationId}?status=active` | Bearer | |
| GET | `/api/auth/invitations/organization/{organizationId}?status=pending` | Bearer | |

### 9.2 Health

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | `{ status, service }` |
| GET | `/api/tasks/health` | Gateway tasks controller health |

### 9.3 Workflows (`/api/workflows`)

| Method | Path | Body / notes |
|--------|------|----------------|
| GET | `/` | List `WorkflowReadDto` |
| GET | `/{id}` | |
| POST | `/` | `WorkflowCreateDto` |
| PUT | `/{id}` | `WorkflowUpdateDto` |
| DELETE | `/{id}` | 204 |
| GET | `/{id}/stages` | |
| GET | `/{id}/tasks` | |
| GET | `/{id}/json` | Same as get-by-id with team names |
| POST | `/{id}/update-json` | Regenerates stored JSON |

### 9.4 Stages (`/api/stages`)

CRUD + `GET /workflow/{workflowId}`

Fields: `stageName`, `stageOrder`, `workflowId`, `teamId`, `stageType` (`Process` \| `Escalation`), `transitionPolicy` (`OnComplete` \| `OnTimeout` \| `Manual`), `timeoutMinutes`.

### 9.5 Teams (`/api/teams`)

CRUD + `GET /{id}/members`, `GET /{id}/workflows`.

### 9.6 Members (`/api/members`)

CRUD + `GET /{id}/tasks`.

### 9.7 Tasks — WorkflowManagement list/CRUD (`/api/tasks`)

| Method | Path |
|--------|------|
| POST | `/` `TaskCreateDto` (CRUD only — **not** orchestration) |
| GET | `/?priority&page&limit` paginated |
| GET | `/{id}` (gateway intercepts Guid GET for enrichment) |
| PUT | `/{id}` |
| DELETE | `/{id}` |
| GET | `/workflow/{workflowId}`, `/stage/{stageId}`, `/member/{memberId}`, `/user/{userId}`, `/member/summary/{memberId}` |

### 9.8 Tasks — orchestration (`/api/task-service`)

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/` | Body `TaskCreateDto`: `taskName`, `description?`, `priority` default Medium, `taskType`, `taskData?`. **202** `{ taskId, message }`. Publishes `TaskCreatedEvent`. |
| GET | `/{id}` | `TaskReadDto` from TaskService DB |
| PUT | `/status/{id}` | `{ status }` — may publish `TaskStatusUpdatedEvent` |
| DELETE | `/{id}` | Deletes TaskService + WorkflowManagement copies |
| POST | `/complete-stage/{id}` | Process advance → `TaskStageCompletedEvent` |
| POST | `/escalate-stage/{id}` | `{ reason? }` — does **not** increment member completion count |
| POST | `/sync-overdue` | Maintenance |
| POST | `/cleanup-orphaned` | Remove WF-Management rows missing in TaskService |
| POST | `/sync-from-workflow-management` | Pull CRUD tasks into TaskService |

### 9.9 SLA (`/api/sla-configurations`)

| Method | Path |
|--------|------|
| GET | `/` |
| GET | `/workflow/{workflowId}` |
| POST | `/` `SLAConfigurationCreateDto` |
| PUT | `/workflow/{workflowId}` |
| DELETE | `/workflow/{workflowId}` |

Model: `PriorityLevelsJson`, e.g. `{ "Critical": { "responseTime": 30 }, "High": { "responseTime": 60 } }` (minutes).

### 9.10 Priority rules (`/api/priority-rules`)

Requires org context.

| Method | Path |
|--------|------|
| GET | `/?activeOnly=` |
| GET | `/{id}` |
| POST | `/` `CreatePriorityRuleRequest` |
| PUT | `/{id}` |
| DELETE | `/{id}` |

Fields: `ruleName`, `priority`, `salience`, `isActive`, `conditionsJson`, `maxWorkloadScore`, `teamName`, `workflowId?`.

### 9.11 Workload (`/api/workload`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/{memberId}` | Score, status, metrics |

### 9.12 Roles & permissions

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/permissions` | |
| GET | `/api/roles/all` | **X-Api-Key**, not JWT |
| GET | `/api/roles/organization/{organizationId}` | |
| GET/POST/PUT/DELETE | `/api/roles/{id}` | POST body includes `name`, `description`, `organizationId`, `permissionCodes` |

---

## 10. Backend implementation (how to work in it)

### 10.1 Layering

CRUD APIs: **Controller → Service → Repository**. No business logic in controllers.

Orchestration services: **Event handler → Application service → Repository + IEventBus**.

Do not add synchronous HTTP between orchestration services where an event already exists.

### 10.2 WorkflowManagement.API (`:5000`)

Source of truth for configured:

- Workflows, Stages, Teams, Members
- Tasks **display copy** (kept in sync from TaskService handlers)
- Roles / Permissions

Org-scoped via `X-Organization-Id`.

### 10.3 TaskService (`:5005`)

Owns the **runtime Task** row and the event-id columns used for idempotency:

`WorkflowSelectedEventId`, `SLAConfiguredEventId`, `TaskAssignedEventId`, `TaskOverdueEventId`, `TaskStageStartedEventId`, `TaskStageCompletedEventId`, `TaskStageEscalatedEventId`, `TaskStageEscalationTriggeredEventId`, `TaskCompletedEventId`.

`CreateTaskAsync` persists then publishes `TaskCreatedEvent`. Returns immediately (202).

### 10.4 WorkflowService (`:5006`)

**Selection** (`WorkflowSelectionService`) on `TaskCreatedEvent`, same org only:

1. Keyword match on task name/description vs workflow name/description
2. Else `TaskType` substring in workflow name, then description
3. Else **first workflow** (logged as fallback)

Persists `WorkflowSelection`, publishes `WorkflowSelectedEvent` (includes `TaskData` for rules).

**Orchestration** (`StageOrchestrationService`) starts after `TaskAssignedEvent`:

- Ordered stages; `StageOrchestrationStarted` prevents restarting stage 1 on reassignment
- Publishes `TaskStageStartedEvent`
- **Process / OnComplete:** wait for `TaskStageCompletedEvent`
- **Escalation:** `ScheduleAsync` `TaskStageEscalationTriggeredEvent` + hosted `StageEscalationMonitorService`
- If next stage’s `TeamId` ≠ current assignee’s team → `TaskStageReassignmentNeededEvent`
- Last stage → `TaskCompletedEvent`

### 10.5 PriorityRuleEngine.API (`:5010`)

HTTP CRUD + consumer of `WorkflowSelectedEvent`.

`EvaluatePriorityAsync`: active rules for that workflow **or** global (`WorkflowId == null`), **salience descending**, first match on `conditionsJson`. Default **Medium**. Publishes `PriorityAssignedEvent`.

### 10.6 SLAManagerService (`:5007`)

On `PriorityAssignedEvent`: load SLA config for workflow, map priority → minutes, persist `SLAAssignment`, publish `SLAConfiguredEvent`, schedule `TaskOverdueEvent` at deadline. Hosted `SLAMonitorService` is a fallback if delayed messages fail.

### 10.7 WorkloadService (`:5008`)

On `SLAConfiguredEvent`:

- Candidate members: workflow team, or **first stage’s team**
- Score (lower is better / less loaded — used to pick assignee):

| Factor | Weight |
|--------|--------|
| Efficiency (completed/total inverted) | 30% |
| Skill level (lower skill = higher score) | 20% |
| Completion rate inverted | 20% |
| Active task load | 20% |
| Availability | 10% |

Avoids same-priority conflict when possible. Persists `TaskAssignment`, publishes `TaskAssignedEvent`.

On `TaskStageReassignmentNeededEvent`: reassign **inside `NewTeamId`**, publish a new `TaskAssignedEvent`.

On `TaskStatusUpdatedEvent`: refresh workload-related state.

### 10.8 Workload.API (`:5003`)

Read model for the UI only. Does not assign tasks.

---

## 11. Event-driven pipeline

### 11.1 Happy path

```
POST /api/task-service
  → TaskCreatedEvent
  → WorkflowSelectedEvent          (WorkflowService)
  → PriorityAssignedEvent          (PriorityRuleEngine)
  → SLAConfiguredEvent             (SLAManager)
  → TaskAssignedEvent              (WorkloadService)
  → TaskStageStartedEvent          (WorkflowService)
  → complete-stage  OR  timeout/manual escalate
  → maybe TaskStageReassignmentNeededEvent → new TaskAssignedEvent
  → … next stages …
  → TaskCompletedEvent
```

### 11.2 Bus constants

File: `backend/Shared/Shared.Contracts/Constants/EventBusConstants.cs`

**Sources:** `task-manager.task|workflow|sla|workload|priority`

**Detail types (routing keys on RabbitMQ):** `TaskCreated`, `TaskCreatedForPriority`, `PriorityAssigned`, `WorkflowSelected`, `SLAConfigured`, `TaskAssigned`, `TaskOverdue`, `TaskStatusUpdated`, `TaskStageStarted`, `TaskStageCompleted`, `TaskStageEscalated`, `TaskStageEscalationTriggered`, `TaskStageReassignmentNeeded`, `TaskCompleted`

**Queues:** `task-service`, `workflow-service`, `sla-service`, `workload-service`, `priority-service`

### 11.3 Who consumes what

| Queue | Service | Events |
|-------|---------|--------|
| task-service | TaskService | Created, WorkflowSelected, PriorityAssigned, SLAConfigured, Assigned, Overdue, StageStarted/Completed/Escalated/EscalationTriggered, Completed |
| workflow-service | WorkflowService | TaskCreated, TaskAssigned, StageCompleted, StageEscalated, StageEscalationTriggered |
| priority-service | PriorityRuleEngine | WorkflowSelected |
| sla-service | SLAManagerService | PriorityAssigned |
| workload-service | WorkloadService | SLAConfigured, TaskStatusUpdated, TaskStageReassignmentNeeded |

Handlers must check stored event IDs / unique assignment rows before mutating.

### 11.4 Switching cloud vs local

`EventBusFactory` reads `EVENTBUS_PROVIDER` or `EventBus:Provider`: `AWS` | `Azure` | `GCP` | `RabbitMQ`. Default if unset: **AWS**.

Local Development json files currently use **RabbitMQ**. Production `appsettings.json` often still says **AWS** (EventBridge + Scheduler).

---

## 12. Databases and main entities

**WorkflowManagement DB**

- `Workflows`, `Stages`, `Teams`, `Members`, `Tasks`
- `Permissions`, `Roles`, `RolePermissions`
- Runtime tables also written here by orchestration services: `WorkflowSelections`, `SLAAssignments`, `TaskAssignments`, SLA config rows

**TaskService DB**

- `Tasks` (orchestration copy + event-id columns)

**PriorityRuleEngine DB**

- `PriorityRules`

Audit / org: entities carry `OrganizationId` and created timestamps. Do not put business rules inside entity classes.

---

## 13. Frontend API clients (what UI actually calls)

All via `REACT_APP_API_URL` (`http://localhost:5004`):

| Service file | Paths |
|--------------|--------|
| `workflowService.ts` | `/api/workflows` CRUD + stages/tasks/json |
| `stageService.ts` | `/api/stages` |
| `teamService.ts` | `/api/teams` |
| `memberService.ts` | `/api/members` |
| `taskService.ts` | `/api/tasks` (list/filter; **not** `/api/task-service`) |
| `slaService.ts` | `/api/sla-configurations` |
| `priorityRulesService.ts` | `/api/priority-rules` |
| `workloadService.ts` | `/api/workload/{memberId}` |
| `userService.ts` | `/api/auth/...` |
| `roleService.ts` / `permissionService.ts` | `/api/roles`, `/api/permissions` |
| `tenantService.ts` | `GET {API}/api/auth/tenant/{email}` (raw fetch) |

---

## 14. Coding conventions (so you don’t fight the repo)

- Search for an existing service/DTO/handler before adding a new one.
- Frontend: no axios/fetch in page components; use `services/`.
- Backend: keep Controller → Service → Repository.
- Do not publish events from controllers.
- Do not call another orchestration service over HTTP for something already on the bus.
- Stage logic only in WorkflowService; assignment only in WorkloadService.
- Consumers: check EventId first.
- No new global state library, no new message broker abstraction, no schema changes unless requested.

---

## 15. Tests

Frontend: `frontend/workflow` — Jest + Testing Library.

`npm test` / `npm run test:coverage`

Coverage gate **90%** on `src/services`, `hooks`, `utils`, `contexts`. Skipped: some PriorityRules and WorkflowEdit tests.

Backend: look next to each project; not all services have a large test suite.

---

## 16. Deployment (high level)

`DEPLOYMENT_GUIDE.md` / `DEPLOYMENT_GUIDE_QA.md`:

- AWS region `ap-south-1`
- ECS Fargate + ECR, ALB
- Frontend S3 + CloudFront
- RDS PostgreSQL
- EventBridge / SQS in AWS (not RabbitMQ)

Nine containerized backends. Frontend env for QA/prod: `.env.qa`, `.env.production`.

---

## 17. Known gaps / traps for the next owner

1. **No task create UI.** Orchestration is `POST /api/task-service`. The Tasks page only lists WorkflowManagement data.
2. **Kanban board is unused.** Completing a stage from the UI is not wired.
3. **Two task stores.** CRUD `POST /api/tasks` ≠ event pipeline. Use TaskService for real tasks.
4. **Roles don’t protect screens.** Anyone logged in can open Users, SLA, etc.
5. **Gateway GET `/api/tasks/{guid}`** is a special enriched path; list GET still goes to WorkflowManagement.
6. **RabbitMQ local work** may not be on remote yet: `RabbitMQEventBus.cs`, start scripts, Development `EventBus:Provider`.
7. **`Dashboard` is orphaned.** Sidebar has no Dashboard link.
8. **`authApi.ts` unused.** Don’t add a second HTTP stack.
9. **No EF migrations.** Schema drift is handled in startup code — be careful in prod.
10. **Firebase / Product Hub** are shared CompTivia services. Users and tenants are not created inside this DB.
11. **Default workflow fallback** means a poorly named task can land on the first workflow in the org.
12. Older `COMPLETE_PROJECT_DOCUMENTATION.md` still emphasizes AWS EventBridge as if it were local default.

---

## 18. Suggested first week for a new developer

1. Run RabbitMQ + Postgres + `start-backend.ps1` + `npm run start:dev`.
2. Log in, create a workflow with 2 Process stages (different teams) + SLA + a priority rule.
3. Create a task via Swagger `POST /api/task-service` with `taskName`/`taskType` that match the workflow.
4. Trace logs and RabbitMQ queues through the event chain.
5. Call `POST /api/task-service/complete-stage/{id}` and confirm reassignment if stage team changed.
6. Read `StageOrchestrationService.cs` and `WorkloadEvaluationService.cs` before changing assignment or stages.

---

## 19. File map (where to look)

| Concern | Start here |
|---------|------------|
| Routes / pages | `frontend/workflow/src/App.tsx` |
| Auth UI | `AuthContext.tsx`, `Login.tsx`, `ProtectedRoute.tsx` |
| HTTP client | `frontend/workflow/src/services/api.ts` |
| Gateway | `backend/APIGateway/Program.cs`, `appsettings.json` (YARP) |
| JWT / org | `OrganizationAuthMiddleware.cs` |
| Task create | `TaskService/.../TasksController.cs`, `TaskService.cs` |
| Stage machine | `WorkflowService/.../StageOrchestrationService.cs` |
| Workflow pick | `WorkflowSelectionService.cs` |
| Assignment | `WorkloadService/.../WorkloadEvaluationService.cs` |
| Events | `Shared.Contracts`, `Shared.Messaging` |
| Local run | `scripts/start-rabbitmq.ps1`, `scripts/start-backend.ps1` |
