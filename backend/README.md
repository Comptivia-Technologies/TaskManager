# Backend services

Nine services. Three pairs have confusingly similar names, so the rule is:

> **`*.API` serves the frontend over HTTP. `*Service` consumes events off the bus.**

| Service | Port | Kind | Owns | Database |
|---|---|---|---|---|
| **APIGateway** | 5004 | HTTP | YARP reverse proxy, Firebase JWT validation, tenant and permission headers | — |
| **WorkflowManagement.API** | 5000 | HTTP | Teams, members, workflows, stages, roles, permissions, and the task **read model** | `WorkflowManagement` |
| **WorkflowService** | 5006 | Events (6) | Picks the workflow for a task and drives stage transitions and escalations | `WorkflowManagement` |
| **SLAConfiguration.API** | 5002 | HTTP | SLA configuration CRUD — the rules | `WorkflowManagement` |
| **SLAManagerService** | 5007 | Events (1) | Applies those rules to a task and watches for overdue work | `WorkflowManagement` |
| **Workload.API** | 5003 | HTTP | Workload scores and configuration, read by the frontend | `WorkflowManagement` |
| **WorkloadService** | 5008 | Events (3) | Chooses who a task is assigned to | `WorkflowManagement` |
| **TaskService** | 5005 | HTTP + Events (12) | The task itself: stage data, attachments, nominations, history | `TaskService` |
| **PriorityRuleEngine.API** | 5010 | HTTP | Priority rules and their evaluation | `PriorityRuleEngine` |

Note that **six services share the `WorkflowManagement` database**. Service boundaries
are not database boundaries here.

## Where a task actually lives

There are two `Task` tables, and both have a class called `TaskService`:

- **`TaskService.Tasks`** is the source of truth — stage state, SLA, event ids, form data.
- **`WorkflowManagement.Tasks`** is the copy the UI lists, with workflow, stage and
  assignee joined. It is written by `TaskService` over HTTP, keyed by the **shared
  `TaskId`**, and should not be edited directly.

`TaskService.Application.Services.TaskService` orchestrates. `WorkflowManagement.API.Services.TaskService` is CRUD over the read model. Check the namespace before you edit.

## Event flow for one enquiry

```
TaskCreated → WorkflowSelected → PriorityAssigned → SLAConfigured → TaskAssigned
  TaskService   WorkflowService   PriorityRule…      SLAManager…     WorkloadService
```

Then per stage: `TaskStageStarted` → `TaskStageCompleted`, or `TaskStageReturned` for rework.

One topic exchange (`task-manager`), five durable queues (one per consuming service),
routing key = event name. Each queue has a `.dlq` beside it holding messages that
failed every attempt — **check those first when work goes missing.**

## Schema

There are no EF migrations. Schema comes from `EnsureCreated()` plus hand-written
`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in each
`Program.cs`. `EnsureCreated()` no-ops when the database already has tables, which is
why the raw DDL exists and why it is load-bearing.

**Adding a column means editing the entity, its EF configuration, and the raw DDL** —
and if the column exists on both `Task` tables, all of that twice.

## Running it

```powershell
.\scripts\start-rabbitmq.ps1
.\scripts\start-all.ps1
```

Services build sequentially (they share projects, so parallel builds collide), then
each starts in its own window with `--no-build`.
