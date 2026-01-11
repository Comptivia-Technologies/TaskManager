# Existing APIs vs New Microservices - Integration Guide

## 📊 Current Architecture

You have **two sets of services** that serve different purposes:

### 1. **Existing REST APIs** (Still Needed ✅)
These are your **current APIs** that the frontend uses for CRUD operations:

- **`SLAConfiguration.API`** (Port 5001)
  - Purpose: Manage SLA configurations (Create, Read, Update, Delete)
  - Used by: Frontend SLA Configuration page
  - Database: `WorkflowManagement` → `SLAConfigurations` table

- **`WorkflowManagement.API`** (Port 5000)
  - Purpose: Manage workflows, teams, members, stages, tasks (CRUD)
  - Used by: Frontend for all workflow management
  - Database: `WorkflowManagement` → `Workflows`, `Teams`, `Members`, `Stages`, `Tasks` tables

- **`Workload.API`** (Port 5003)
  - Purpose: Calculate and return workload for members (Read-only queries)
  - Used by: Frontend Workload Configuration page
  - Database: `WorkflowManagement` → Reads `Members` and `Tasks` tables

### 2. **New Event-Driven Microservices** (For Orchestration Flow)
These handle the **automated task orchestration** via RabbitMQ:

- **`APIGateway`** (Port 5004)
  - Purpose: Entry point for task creation (publishes events)
  
- **`TaskService`** (Port 5005)
  - Purpose: Manages task lifecycle via events
  
- **`WorkflowService`** (Port 5006)
  - Purpose: Auto-selects workflow for tasks
  
- **`SLAManagerService`** (Port 5007)
  - Purpose: Auto-configures SLA and monitors deadlines
  
- **`WorkloadService`** (Port 5008)
  - Purpose: Auto-assigns tasks to best members

## 🔄 How They Work Together

### **Hybrid Architecture** (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         │ HTTP REST          │ HTTP REST          │ HTTP REST
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐
│ SLAConfig API   │  │ WorkflowMgmt API │  │ Workload API │
│ (CRUD Ops)      │  │ (CRUD Ops)       │  │ (Queries)    │
└─────────────────┘  └──────────────────┘  └──────────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  PostgreSQL DB   │
                    │ WorkflowManagement│
                    └──────────────────┘

┌─────────────────────────────────────────────────────────┐
│         Task Orchestration Flow (Event-Driven)          │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │  ← Entry point for task creation
└─────────────────┘
         │ Publishes TaskCreatedEvent
         ▼
┌─────────────────┐      ┌─────────────────┐
│ Task Service    │      │ Workflow Service│
│ (Lifecycle)     │      │ (Selection)     │
└─────────────────┘      └─────────────────┘
         │                    │
         │                    │ Publishes WorkflowSelectedEvent
         │                    ▼
         │            ┌─────────────────┐
         │            │ SLA Manager Svc  │
         │            │ (SLA Config)     │
         │            └─────────────────┘
         │                    │
         │                    │ Publishes SLAConfiguredEvent
         │                    ▼
         │            ┌─────────────────┐
         │            │ Workload Service│
         │            │ (Assignment)    │
         │            └─────────────────┘
         │                    │
         │                    │ Publishes TaskAssignedEvent
         │                    ▼
         └────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  RabbitMQ        │
                    │  (Events)        │
                    └──────────────────┘
```

## 🎯 Use Cases

### **When to Use Existing APIs:**
- ✅ Frontend needs to **create/edit/delete** workflows, teams, members
- ✅ Frontend needs to **view** workload for members
- ✅ Frontend needs to **configure** SLA settings
- ✅ **Manual operations** by users

### **When to Use New Microservices:**
- ✅ **Automated task orchestration** flow
- ✅ When a task is created and needs to:
  - Auto-select workflow
  - Auto-configure SLA
  - Auto-assign to best member
- ✅ **Event-driven** processing

## 🔧 Integration Options

### **Option 1: Keep Both (Recommended)**
- **Existing APIs**: Continue serving frontend for CRUD operations
- **New Microservices**: Handle automated orchestration flow
- **Shared Database**: Both read from `WorkflowManagement` database

**Benefits:**
- ✅ No breaking changes to frontend
- ✅ Gradual migration path
- ✅ Best of both worlds

### **Option 2: Full Migration**
- Replace existing APIs with microservices
- Requires frontend changes
- More complex migration

## 📝 Recommended Approach

### **For Task Creation:**

**Option A: Use Existing API** (Current)
```http
POST /api/tasks (WorkflowManagement.API)
```
- Creates task manually
- User selects workflow, assigns member, etc.

**Option B: Use New API Gateway** (Event-Driven)
```http
POST /api/tasks (APIGateway)
```
- Creates task and triggers automated orchestration
- Auto-selects workflow, configures SLA, assigns member

**You can support BOTH!**

### **Implementation Strategy:**

1. **Keep existing APIs running** (frontend continues to work)

2. **Add new microservices** for orchestration:
   - When user creates task via API Gateway → automated flow
   - When user creates task via WorkflowManagement API → manual flow

3. **Shared Database Access:**
   - New microservices read from same `WorkflowManagement` database
   - They can query workflows, members, tasks that existing APIs manage

4. **Gradual Migration:**
   - Start with orchestration flow for new tasks
   - Keep existing APIs for manual operations
   - Eventually migrate frontend to use orchestration flow

## 🔄 Database Sharing

All services can share the same databases:

```
WorkflowManagement Database:
├── Workflows (read by WorkflowService)
├── Members (read by WorkloadService)
├── Tasks (read/write by both)
├── Teams (read by existing APIs)
└── Stages (read by existing APIs)

SLAConfiguration Database:
├── SLAConfigurations (read by SLAManagerService)
└── (also used by SLAConfiguration.API)
```

## ✅ Conclusion

**Your existing APIs are NOT obsolete!** They serve a different purpose:

- **Existing APIs** = **Data Management** (CRUD operations for frontend)
- **New Microservices** = **Process Orchestration** (Automated task flow)

**Both can coexist and work together!**

## 🚀 Next Steps

1. **Keep existing APIs running** (they're still needed)
2. **Start new microservices** for orchestration flow
3. **Optionally**: Add a toggle in frontend to choose:
   - Manual task creation (existing API)
   - Automated orchestration (new API Gateway)

Would you like me to:
1. Update the new microservices to better integrate with existing APIs?
2. Create a unified API that supports both manual and automated flows?
3. Add event publishing to existing APIs so they can trigger orchestration?

