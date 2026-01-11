# Microservices Architecture - Quick Start Guide

## 🚀 Quick Start

### Prerequisites
1. **RabbitMQ**: Install and run RabbitMQ
   ```bash
   docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
   ```
   Access management UI: http://localhost:15672 (guest/guest)

2. **PostgreSQL**: Ensure PostgreSQL is running with these databases:
   - `TaskService`
   - `WorkflowManagement` (shared)
   - `SLAConfiguration` (shared)

### Build All Projects

```bash
# Build shared libraries first
cd backend/Shared/Shared.Contracts
dotnet build

cd ../Shared.Messaging
dotnet build

# Build all microservices
cd ../../TaskService
dotnet build

cd ../WorkflowService
dotnet build

cd ../SLAManagerService
dotnet build

cd ../WorkloadService
dotnet build

cd ../APIGateway
dotnet build
```

### Run Services

**Terminal 1 - API Gateway** (Port 5004):
```bash
cd backend/APIGateway
dotnet run
```

**Terminal 2 - Task Service** (Port 5005):
```bash
cd backend/TaskService
dotnet run
```

**Terminal 3 - Workflow Service** (Port 5006):
```bash
cd backend/WorkflowService
dotnet run
```

**Terminal 4 - SLA Manager Service** (Port 5007):
```bash
cd backend/SLAManagerService
dotnet run
```

**Terminal 5 - Workload Service** (Port 5008):
```bash
cd backend/WorkloadService
dotnet run
```

### Test the Flow

1. **Create a task via API Gateway**:
```bash
curl -X POST http://localhost:5004/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskName": "Fix critical bug",
    "description": "Fix authentication issue",
    "priority": "Critical",
    "taskType": "Bug"
  }'
```

2. **Check task status**:
```bash
curl http://localhost:5005/api/tasks/{taskId}
```

3. **Monitor RabbitMQ**: Visit http://localhost:15672 to see queues and messages

## 📁 Project Structure

```
backend/
├── Shared/
│   ├── Shared.Contracts/          # Event contracts
│   └── Shared.Messaging/          # RabbitMQ infrastructure
├── APIGateway/                    # Entry point
├── TaskService/                   # Task lifecycle management
├── WorkflowService/               # Workflow selection
├── SLAManagerService/            # SLA configuration & monitoring
└── WorkloadService/               # Member assignment
```

## 🔄 Event Flow Diagram

```
API Gateway
    ↓ TaskCreatedEvent
Workflow Service
    ↓ WorkflowSelectedEvent
SLA Manager Service
    ↓ SLAConfiguredEvent
Workload Service
    ↓ TaskAssignedEvent
Task Service (updates status)
```

## 🐇 RabbitMQ Setup

### Exchanges (Auto-created)
- `task.exchange`
- `workflow.exchange`
- `sla.exchange`
- `workload.exchange`

### Queues (Auto-created)
- `task.created.queue`
- `workflow.selected.queue`
- `sla.configured.queue`
- `task.assigned.queue`
- `task.overdue.queue`

## 📊 Database Setup

### Create Databases
```sql
CREATE DATABASE "TaskService";
CREATE DATABASE "WorkflowManagement";
CREATE DATABASE "SLAConfiguration";
```

### Connection Strings
Update `appsettings.json` in each service:
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=<DatabaseName>;Username=postgres;Password=postgres"
  }
}
```

## 🎯 Key Features

✅ **Event-Driven**: All communication via RabbitMQ  
✅ **Idempotent**: Duplicate events are safely ignored  
✅ **Correlation Tracking**: End-to-end tracing with CorrelationId  
✅ **Retry Logic**: Automatic retries with exponential backoff  
✅ **Dead Letter Queues**: Failed messages go to DLQ  
✅ **Background Workers**: SLA monitoring runs continuously  
✅ **Clean Architecture**: Separation of concerns per service  

## 🔍 Monitoring

- **RabbitMQ Management**: http://localhost:15672
- **Logs**: Check console output for CorrelationId tracking
- **Database**: Query service-specific tables for state

## 🐛 Troubleshooting

1. **RabbitMQ Connection Failed**
   - Ensure RabbitMQ is running: `docker ps`
   - Check connection string in `appsettings.json`

2. **Database Connection Failed**
   - Verify PostgreSQL is running
   - Check database exists
   - Verify connection strings

3. **Events Not Processing**
   - Check RabbitMQ queues in management UI
   - Verify consumers are started
   - Check service logs for errors

4. **Idempotency Issues**
   - Check event ID storage in database
   - Verify event handlers check for duplicates

## 📚 Documentation

- **Architecture Details**: See `MICROSERVICES_ARCHITECTURE.md`
- **System Overview**: See `ARCHITECTURE_OVERVIEW.md`

