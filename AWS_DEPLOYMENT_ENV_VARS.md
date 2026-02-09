# AWS Deployment Environment Variables

This document contains all environment variables needed for AWS deployment.

**Event Bus ARN**: `arn:aws:events:ap-south-1:798277642170:event-bus/work-flow-bus`  
**Region**: `ap-south-1`  
**Account ID**: `798277642170`  
**Frontend URL**: `https://dev.workflowautomation.enginuo.com`

---

## Common EventBus Configuration (All Event-Driven Services)

These variables apply to: **APIGateway**, **TaskService**, **WorkflowService**, **SLAManagerService**, **WorkloadService**, **PriorityRuleEngine.API**

```bash
EVENTBUS_PROVIDER=AWS
EventBus__AWS__Region=ap-south-1
EventBus__AWS__EventBusName=work-flow-bus
EventBus__AWS__AccessKeyId=YOUR_ACCESS_KEY_ID
EventBus__AWS__SecretAccessKey=YOUR_SECRET_ACCESS_KEY
EventBus__AWS__ServicePrefix=task-manager
EventBus__AWS__VisibilityTimeoutSeconds=300
EventBus__AWS__MaxReceiveCount=3
EventBus__AWS__SchedulerGroupName=task-manager-schedules
EventBus__AWS__SchedulerRoleArn=arn:aws:iam::798277642170:role/EventBridgeSchedulerRole
```

---

## Service-Specific Environment Variables

### APIGateway

```bash
# EventBus (see Common EventBus Configuration above)

# Reverse Proxy URLs (update with your deployed service URLs)
WORKFLOW_MANAGEMENT_API_BASE=http://workflow-api:5000
SLA_CONFIGURATION_API_BASE=http://sla-api:5002
PRIORITY_RULE_ENGINE_API_BASE=http://priority-api:5010
WORKLOAD_API_BASE=http://workload-api:5003
TASK_SERVICE_API_BASE=http://task-service:5005
```

### TaskService

```bash
# EventBus (see Common EventBus Configuration above)

# Database
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=TaskService
DB_USER=postgres
DB_PASSWORD=your_password

# API URLs
WorkflowManagementApi__BaseUrl=http://workflow-api:5000/api
```

### WorkflowService

```bash
# EventBus (see Common EventBus Configuration above)

# Database
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=WorkflowManagement
DB_USER=postgres
DB_PASSWORD=your_password
```

### SLAManagerService

```bash
# EventBus (see Common EventBus Configuration above)

# Database
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=WorkflowManagement
DB_USER=postgres
DB_PASSWORD=your_password
```

### WorkloadService

```bash
# EventBus (see Common EventBus Configuration above)

# Database
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=WorkflowManagement
DB_USER=postgres
DB_PASSWORD=your_password
```

### PriorityRuleEngine.API

```bash
# EventBus (see Common EventBus Configuration above)

# Database
ConnectionStrings__DefaultConnection=Host=your-rds-endpoint;Port=5432;Database=PriorityRuleEngine;Username=postgres;Password=your_password

# CORS
Cors__AllowedOrigin=https://dev.workflowautomation.enginuo.com
```

### WorkflowManagement.API

```bash
# Database
ConnectionStrings__DefaultConnection=Host=your-rds-endpoint;Port=5432;Database=WorkflowManagement;Username=postgres;Password=your_password

# CORS
Cors__AllowedOrigin=https://dev.workflowautomation.enginuo.com
```

### SLAConfiguration.API

```bash
# Database
ConnectionStrings__DefaultConnection=Host=your-rds-endpoint;Port=5432;Database=WorkflowManagement;Username=postgres;Password=your_password

# CORS
Cors__AllowedOrigin=https://dev.workflowautomation.enginuo.com
```

### Workload.API

```bash
# Database
ConnectionStrings__DefaultConnection=Host=your-rds-endpoint;Port=5432;Database=WorkflowManagement;Username=postgres;Password=your_password

# CORS
Cors__AllowedOrigin=https://dev.workflowautomation.enginuo.com
```

---

## Frontend Environment Variables

```bash
REACT_APP_API_URL=https://your-api-gateway-url.com/api
```

Replace `your-api-gateway-url.com` with your actual backend API Gateway URL.

---

## Setting Environment Variables

### AWS ECS/Fargate

1. Go to **ECS Console** → **Task Definitions**
2. Create/Edit Task Definition
3. Under **Container Definitions** → **Environment Variables**
4. Add each variable as a key-value pair

### AWS EC2

Create systemd service file `/etc/systemd/system/your-service.service`:

```ini
[Unit]
Description=Your Service
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/your-service
ExecStart=/usr/bin/dotnet /opt/your-service/YourService.dll
Restart=always
Environment="EVENTBUS_PROVIDER=AWS"
Environment="EventBus__AWS__Region=ap-south-1"
Environment="EventBus__AWS__EventBusName=work-flow-bus"
# ... add all other variables

[Install]
WantedBy=multi-user.target
```

### Docker

Create `.env` file:

```bash
EVENTBUS_PROVIDER=AWS
EventBus__AWS__Region=ap-south-1
EventBus__AWS__EventBusName=work-flow-bus
# ... add all other variables
```

Run with:
```bash
docker run --env-file .env your-image
```

### AWS Elastic Beanstalk

1. Go to **EB Console** → **Configuration** → **Software**
2. Under **Environment Properties**
3. Add each variable as a key-value pair

---

## Important Notes

1. **Replace Placeholders**:
   - `YOUR_ACCESS_KEY_ID` - Your AWS IAM Access Key ID
   - `YOUR_SECRET_ACCESS_KEY` - Your AWS IAM Secret Access Key
   - `your-rds-endpoint` - Your RDS PostgreSQL endpoint
   - `your_password` - Your database password
   - `your-api-gateway-url.com` - Your backend API Gateway URL

2. **Environment Variable Syntax**:
   - Use `__` (double underscore) for nested JSON: `EventBus__AWS__Region` → `EventBus.AWS.Region`
   - Environment variables override `appsettings.json` values

3. **Security**:
   - Never commit credentials to version control
   - Use AWS Secrets Manager or Parameter Store for sensitive values
   - Use IAM roles instead of access keys when possible (ECS, EC2 with instance profiles)

4. **Database Names**:
   - `WorkflowManagement` - Used by WorkflowManagement.API, SLAConfiguration.API, Workload.API, WorkflowService, SLAManagerService, WorkloadService
   - `TaskService` - Used by TaskService
   - `PriorityRuleEngine` - Used by PriorityRuleEngine.API

---

## Quick Reference

| Service | EventBus | Database | CORS |
|---------|----------|----------|------|
| APIGateway | ✅ | ❌ | ❌ |
| TaskService | ✅ | TaskService | ❌ |
| WorkflowService | ✅ | WorkflowManagement | ❌ |
| SLAManagerService | ✅ | WorkflowManagement | ❌ |
| WorkloadService | ✅ | WorkflowManagement | ❌ |
| PriorityRuleEngine.API | ✅ | PriorityRuleEngine | ✅ |
| WorkflowManagement.API | ❌ | WorkflowManagement | ✅ |
| SLAConfiguration.API | ❌ | WorkflowManagement | ✅ |
| Workload.API | ❌ | WorkflowManagement | ✅ |

---

**Last Updated**: January 2026
