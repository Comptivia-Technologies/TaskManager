# Integration Summary: Existing APIs + New Microservices

## ✅ Your Existing APIs (Keep Running)

These are **still needed** and serve your frontend:

| API | Port | Purpose | Database |
|-----|------|---------|----------|
| **SLAConfiguration.API** | 5001 | SLA CRUD operations | `WorkflowManagement` |
| **WorkflowManagement.API** | 5000 | Workflow/Team/Member CRUD | `WorkflowManagement` |
| **Workload.API** | 5003 | Workload queries | `WorkflowManagement` |

## 🆕 New Microservices (For Orchestration)

These handle **automated task orchestration** via events:

| Service | Port | Purpose | Database |
|---------|------|---------|----------|
| **APIGateway** | 5004 | Task creation entry point | None (publishes events) |
| **TaskService** | 5005 | Task lifecycle tracking | `TaskService` (new) |
| **WorkflowService** | 5006 | Auto workflow selection | `WorkflowManagement` (shared) |
| **SLAManagerService** | 5007 | Auto SLA configuration | `WorkflowManagement` (shared) |
| **WorkloadService** | 5008 | Auto member assignment | `WorkflowManagement` (shared) |

## 🔄 How They Work Together

### Scenario 1: Manual Task Creation (Current Flow)
```
Frontend → WorkflowManagement.API → Creates task manually
User selects workflow, assigns member, etc.
```

### Scenario 2: Automated Orchestration (New Flow)
```
Frontend → APIGateway → Publishes TaskCreatedEvent
    ↓
WorkflowService → Auto-selects workflow
    ↓
SLAManagerService → Auto-configures SLA
    ↓
WorkloadService → Auto-assigns to best member
    ↓
TaskService → Updates task status
```

## 📊 Database Architecture

```
PostgreSQL Instance
├── WorkflowManagement Database (Shared)
│   ├── Workflows (read by WorkflowService + WorkflowManagement.API)
│   ├── Members (read by WorkloadService + Workload.API)
│   ├── Tasks (read/write by both)
│   ├── Teams (read by WorkflowManagement.API)
│   ├── Stages (read by WorkflowManagement.API)
│   └── SLAConfigurations (read by SLAManagerService + SLAConfiguration.API)
│
└── TaskService Database (New)
    └── Tasks (task lifecycle for orchestration flow)
```

## 🎯 Recommendation

**Run both systems in parallel:**

1. **Keep existing APIs** for:
   - Frontend CRUD operations
   - Manual task management
   - Workload viewing

2. **Add new microservices** for:
   - Automated task orchestration
   - Event-driven processing
   - Background SLA monitoring

3. **Frontend can choose:**
   - Use existing APIs for manual operations
   - Use API Gateway for automated orchestration

## 🚀 Quick Start

### Start Existing APIs (Keep Running)
```bash
# Terminal 1
cd backend/SLAConfiguration.API
dotnet run  # Port 5001

# Terminal 2
cd backend/WorkflowManagement.API
dotnet run  # Port 5000

# Terminal 3
cd backend/Workload.API
dotnet run  # Port 5003
```

### Start New Microservices (For Orchestration)
```bash
# Terminal 4 - RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Terminal 5
cd backend/APIGateway
dotnet run  # Port 5004

# Terminal 6
cd backend/TaskService
dotnet run  # Port 5005

# Terminal 7
cd backend/WorkflowService
dotnet run  # Port 5006

# Terminal 8
cd backend/SLAManagerService
dotnet run  # Port 5007

# Terminal 9
cd backend/WorkloadService
dotnet run  # Port 5008
```

## ✅ Summary

- **Existing APIs**: Still needed, keep running ✅
- **New Microservices**: Add orchestration capability ✅
- **Both can coexist**: Different purposes, same databases ✅
- **No breaking changes**: Frontend continues to work ✅

