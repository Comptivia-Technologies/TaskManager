# Deployment Guide - Task Management System

## 📋 Table of Contents
1. [Overview](#overview)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Detailed AWS Setup](#detailed-aws-setup)
4. [Network Configuration](#network-configuration)
5. [Security Configuration](#security-configuration)
6. [Docker Configuration](#docker-configuration)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Environment Configuration](#environment-configuration)
9. [Load Balancer Setup](#load-balancer-setup)
10. [SSL/TLS & Domain Configuration](#ssltls--domain-configuration)
11. [Deployment Process](#deployment-process)
12. [Service Architecture](#service-architecture)
13. [Testing Procedures](#testing-procedures)
14. [Monitoring & Logging](#monitoring--logging)
15. [Performance Optimization](#performance-optimization)
16. [Scaling Strategies](#scaling-strategies)
17. [Cost Optimization](#cost-optimization)
18. [Backup & Disaster Recovery](#backup--disaster-recovery)
19. [Troubleshooting](#troubleshooting)
20. [Rollback Procedures](#rollback-procedures)

---

## Overview

This document provides a complete step-by-step guide for deploying the Task Management & Workflow Orchestration system to AWS.

### Deployment Architecture

- **Backend**: AWS ECS (Fargate) with ECR for container registry
- **Frontend**: AWS S3 + CloudFront for static hosting
- **CI/CD**: GitHub Actions workflows
- **Infrastructure**: AWS (ECS, ECR, S3, CloudFront, RDS PostgreSQL, EventBridge, SQS)
- **Network**: VPC with public/private subnets, Application Load Balancer
- **Security**: Security groups, IAM roles, SSL/TLS certificates

### Services Deployed

**Backend Services (9 microservices):**
1. APIGateway (Port 5004) - Reverse proxy and API gateway
2. TaskService (Port 5005) - Task CRUD operations
3. WorkflowService (Port 5006) - Workflow orchestration
4. SLAManagerService (Port 5007) - SLA management
5. WorkloadService (Port 5008) - Workload assignment
6. PriorityRuleEngine.API (Port 5010) - Priority rules
7. WorkflowManagement.API (Port 5000) - Workflow CRUD
8. SLAConfiguration.API (Port 5002) - SLA configuration
9. Workload.API (Port 5003) - Workload API

**Frontend:**
- React application hosted on S3 + CloudFront

---

## Infrastructure Setup

### 1. AWS Account Configuration

**Region**: `ap-south-1` (Mumbai)

**Account ID**: `798277642170`

### 2. ECR (Elastic Container Registry)

**Registry**: `798277642170.dkr.ecr.ap-south-1.amazonaws.com`

**Repositories** (auto-created on first push):
- `task-manager-api-gateway`
- `task-manager-task-service`
- `task-manager-workflow-service`
- `task-manager-sla-manager-service`
- `task-manager-workload-service`
- `task-manager-priority-rule-engine-api`
- `task-manager-workflow-management-api`
- `task-manager-sla-configuration-api`
- `task-manager-workload-api`

### 3. ECS Cluster

**Cluster Name**: `workflow-automation-cluster`

**Configuration**:
- Launch Type: Fargate
- Network Mode: `awsvpc`
- Resources per service:
  - CPU: 256
  - Memory: 512 MB

### 4. IAM Roles

**Task Execution Role**:
- ARN: `arn:aws:iam::798277642170:role/workflow-automation-ecsTaskExecutionRole`
- Permissions:
  - ECR pull permissions
  - CloudWatch Logs write permissions

**Task Role**:
- ARN: `arn:aws:iam::798277642170:role/workflow-automation-eventBridgeSchedulerRole`
- Permissions:
  - EventBridge publish permissions
  - EventBridge Scheduler permissions

### 5. RDS PostgreSQL Database

**Endpoint**: `workflow-automation-db.czj02dhursas.ap-south-1.rds.amazonaws.com`

**Port**: `5432`

**Databases**:
- `TaskService` - For TaskService microservice
- `WorkflowManagement` - For WorkflowManagement, WorkflowService, SLAManagerService, WorkloadService, SLAConfiguration.API, Workload.API
- `PriorityRuleEngine` - For PriorityRuleEngine.API

**Credentials**:
- Username: `postgres`
- Password: Stored in GitHub Secrets (`DB_PASSWORD`)

### 6. EventBridge & SQS

**Event Bus**: `work-flow-bus`

**SQS Queues**: Auto-created by services using naming pattern:
- `task-manager-{service-name}-queue`

**Scheduler Group**: `task-manager-schedules`

### 7. Frontend Infrastructure

**S3 Bucket**: `dev.workflowautomation.enginuo.com`

**CloudFront Distribution ID**: `E19R7TCMM53H0R`

**API Gateway URL**: `https://api.workflowautomation.enginuo.com`

**Frontend URL**: `https://dev.workflowautomation.enginuo.com`

---

## Detailed AWS Setup

### Step-by-Step AWS Resource Creation

#### 1. Create VPC and Networking

1. **Create VPC**:
   - Name: `workflow-automation-vpc`
   - CIDR: `10.0.0.0/16`
   - Enable DNS hostnames: Yes
   - Enable DNS resolution: Yes

2. **Create Public Subnets** (for Load Balancer):
   - `workflow-automation-public-subnet-1a` (10.0.1.0/24) - Availability Zone: ap-south-1a
   - `workflow-automation-public-subnet-1b` (10.0.2.0/24) - Availability Zone: ap-south-1b

3. **Create Private Subnets** (for ECS tasks):
   - `workflow-automation-private-subnet-1a` (10.0.10.0/24) - Availability Zone: ap-south-1a
   - `workflow-automation-private-subnet-1b` (10.0.20.0/24) - Availability Zone: ap-south-1b

4. **Create Internet Gateway**:
   - Name: `workflow-automation-igw`
   - Attach to VPC

5. **Create NAT Gateway** (for private subnet internet access):
   - Name: `workflow-automation-nat`
   - Place in public subnet
   - Allocate Elastic IP

6. **Configure Route Tables**:
   - **Public Route Table**: Route `0.0.0.0/0` → Internet Gateway
   - **Private Route Table**: Route `0.0.0.0/0` → NAT Gateway

#### 2. Create Security Groups

**Load Balancer Security Group** (`workflow-automation-alb-sg`):
- Inbound:
  - HTTP (80) from `0.0.0.0/0`
  - HTTPS (443) from `0.0.0.0/0`
- Outbound: All traffic

**ECS Task Security Group** (`workflow-automation-ecs-sg`):
- Inbound:
  - Port 80 from Load Balancer Security Group
  - Port 80 from ECS Task Security Group (for inter-service communication)
- Outbound: All traffic

**RDS Security Group** (`workflow-automation-rds-sg`):
- Inbound:
  - PostgreSQL (5432) from ECS Task Security Group
- Outbound: None

#### 3. Create RDS PostgreSQL Instance

1. **Database Engine**: PostgreSQL 15.x
2. **Instance Class**: db.t3.medium (or appropriate size)
3. **Storage**: 100 GB GP3 (with auto-scaling)
4. **VPC**: `workflow-automation-vpc`
5. **Subnet Group**: Create DB subnet group with private subnets
6. **Security Group**: `workflow-automation-rds-sg`
7. **Database Name**: `postgres` (create databases after)
8. **Master Username**: `postgres`
9. **Master Password**: Store in GitHub Secrets
10. **Backup**: Enable automated backups (7-day retention)
11. **Multi-AZ**: Enable for production

**Create Databases**:
```sql
CREATE DATABASE "TaskService";
CREATE DATABASE "WorkflowManagement";
CREATE DATABASE "PriorityRuleEngine";
```

#### 4. Create ECR Repositories

```bash
aws ecr create-repository --repository-name task-manager-api-gateway --region ap-south-1
aws ecr create-repository --repository-name task-manager-task-service --region ap-south-1
aws ecr create-repository --repository-name task-manager-workflow-service --region ap-south-1
aws ecr create-repository --repository-name task-manager-sla-manager-service --region ap-south-1
aws ecr create-repository --repository-name task-manager-workload-service --region ap-south-1
aws ecr create-repository --repository-name task-manager-priority-rule-engine-api --region ap-south-1
aws ecr create-repository --repository-name task-manager-workflow-management-api --region ap-south-1
aws ecr create-repository --repository-name task-manager-sla-configuration-api --region ap-south-1
aws ecr create-repository --repository-name task-manager-workload-api --region ap-south-1
```

#### 5. Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name workflow-automation-cluster \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --region ap-south-1
```

#### 6. Create IAM Roles

**Task Execution Role** (`workflow-automation-ecsTaskExecutionRole`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

**Task Role** (`workflow-automation-eventBridgeSchedulerRole`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "events:PutEvents",
        "events:CreateSchedule",
        "events:UpdateSchedule",
        "events:DeleteSchedule",
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "*"
    }
  ]
}
```

#### 7. Create EventBridge Event Bus

```bash
aws events create-event-bus \
  --name work-flow-bus \
  --region ap-south-1
```

#### 8. Create S3 Bucket for Frontend

```bash
aws s3 mb s3://dev.workflowautomation.enginuo.com --region ap-south-1

# Enable static website hosting
aws s3 website s3://dev.workflowautomation.enginuo.com \
  --index-document index.html \
  --error-document index.html

# Configure bucket policy for CloudFront
```

#### 9. Create CloudFront Distribution

1. **Origin**: S3 bucket `dev.workflowautomation.enginuo.com`
2. **Origin Access Control**: Create OAC for S3 access
3. **Default Root Object**: `index.html`
4. **Error Pages**: 
   - 403 → `/index.html` (200)
   - 404 → `/index.html` (200)
5. **SSL Certificate**: Use ACM certificate for domain
6. **Alternate Domain Names**: `dev.workflowautomation.enginuo.com`
7. **Default Cache Behavior**: 
   - Viewer Protocol Policy: Redirect HTTP to HTTPS
   - Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
   - Cache Policy: CachingOptimized

---

## Network Configuration

### VPC Architecture

```
┌─────────────────────────────────────────────────┐
│           workflow-automation-vpc               │
│                 10.0.0.0/16                     │
│                                                 │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │  Public Subnet   │  │  Public Subnet   │    │
│  │   10.0.1.0/24    │  │   10.0.2.0/24   │    │
│  │   (ap-south-1a)  │  │   (ap-south-1b)  │    │
│  │                  │  │                  │    │
│  │  ┌────────────┐  │  │  ┌────────────┐ │    │
│  │  │    ALB     │  │  │  │   NAT GW   │ │    │
│  │  └────────────┘  │  │  └────────────┘ │    │
│  └──────────────────┘  └──────────────────┘    │
│                                                 │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │ Private Subnet   │  │ Private Subnet   │    │
│  │   10.0.10.0/24   │  │   10.0.20.0/24   │    │
│  │   (ap-south-1a)  │  │   (ap-south-1b)  │    │
│  │                  │  │                  │    │
│  │  ┌────────────┐  │  │  ┌────────────┐ │    │
│  │  │ ECS Tasks  │  │  │  │ ECS Tasks  │ │    │
│  │  └────────────┘  │  │  └────────────┘ │    │
│  │                  │  │                  │    │
│  │  ┌────────────┐  │  │  ┌────────────┐ │    │
│  │  │    RDS     │  │  │  │    RDS     │ │    │
│  │  │  (Multi-AZ)│  │  │  │  (Standby) │ │    │
│  │  └────────────┘  │  │  └────────────┘ │    │
│  └──────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Service Discovery

ECS services use service discovery for inter-service communication:

- **Namespace**: `workflow-automation`
- **Service Names**: 
  - `api-gateway-service`
  - `workflow-management-api-service`
  - `task-service`
  - `sla-configuration-api-service`
  - `priority-rule-engine-api-service`
  - `workload-api-service`

**DNS Format**: `{service-name}.workflow-automation`

**Example**: `workflow-management-api-service.workflow-automation:80`

---

## Security Configuration

### Security Groups Summary

| Security Group | Purpose | Inbound Rules | Outbound Rules |
|----------------|---------|---------------|----------------|
| `workflow-automation-alb-sg` | Load Balancer | HTTP (80), HTTPS (443) from Internet | All |
| `workflow-automation-ecs-sg` | ECS Tasks | Port 80 from ALB SG, Port 80 from ECS SG | All |
| `workflow-automation-rds-sg` | RDS Database | PostgreSQL (5432) from ECS SG | None |

### IAM Best Practices

1. **Least Privilege**: Roles have minimum required permissions
2. **Separate Roles**: Execution role vs Task role separation
3. **No Hardcoded Credentials**: All secrets in GitHub Secrets
4. **Resource-Specific Policies**: Limit to specific resources where possible

### Secrets Management

- **GitHub Secrets**: Store AWS credentials and database passwords
- **AWS Secrets Manager**: Consider migrating sensitive data (optional)
- **Environment Variables**: Never commit secrets to code

### Network Security

- **Private Subnets**: ECS tasks run in private subnets
- **NAT Gateway**: Provides outbound internet access without inbound
- **Security Groups**: Restrict traffic between components
- **No Public IPs**: ECS tasks don't need public IPs (use NAT Gateway)

---

## Docker Configuration

### Dockerfile Structure

All backend services use multi-stage Docker builds:

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy NuGet.config first
COPY ["NuGet.config", "."]

# Copy project files
COPY ["ServiceName/ServiceName.csproj", "ServiceName/"]
COPY ["Shared/Shared.Messaging/Shared.Messaging.csproj", "Shared/Shared.Messaging/"]
COPY ["Shared/Shared.Contracts/Shared.Contracts.csproj", "Shared/Shared.Contracts/"]

# Restore dependencies
RUN dotnet restore "ServiceName/ServiceName.csproj"

# Copy everything else
COPY . .

# Build
WORKDIR "/src/ServiceName"
RUN dotnet build "ServiceName.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ServiceName.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ServiceName.dll"]
```

### Docker Build Optimization

- **Layer Caching**: Copy dependency files first for better caching
- **Multi-Stage Builds**: Reduce final image size
- **.dockerignore**: Exclude unnecessary files

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### Backend Deployment Workflow

**File**: `.github/workflows/deploy-backend.yml`

**Triggers**:
- Push to `develop` branch with changes in `backend/**`
- Manual trigger via `workflow_dispatch`

**Steps**:
1. Checkout code
2. Configure AWS credentials
3. Login to ECR
4. Build and push Docker images (all 9 services)
5. Deploy to ECS (create task definitions, update services)

#### Frontend Deployment Workflow

**File**: `.github/workflows/deploy-frontend.yml`

**Triggers**:
- Push to `develop` branch with changes in `frontend/**`
- Manual trigger via `workflow_dispatch`

**Steps**:
1. Checkout code
2. Configure AWS credentials
3. Setup Node.js (v18)
4. Install dependencies (`npm ci`)
5. Build frontend (with `REACT_APP_API_URL`)
6. Deploy to S3 (with cache headers)
7. Invalidate CloudFront cache

### Required GitHub Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `DB_PASSWORD`

---

## Environment Configuration

### Common Environment Variables

All services receive these environment variables:

```bash
ASPNETCORE_URLS=http://+:80
EVENTBUS_PROVIDER=AWS
EventBus__AWS__Region=ap-south-1
EventBus__AWS__EventBusName=work-flow-bus
EventBus__AWS__ServicePrefix=task-manager
EventBus__AWS__VisibilityTimeoutSeconds=300
EventBus__AWS__MaxReceiveCount=3
EventBus__AWS__SchedulerGroupName=task-manager-schedules
EventBus__AWS__SchedulerRoleArn=<TASK_ROLE_ARN>
Cors__AllowedOrigin=https://dev.workflowautomation.enginuo.com
DB_HOST=workflow-automation-db.czj02dhursas.ap-south-1.rds.amazonaws.com
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<FROM_SECRETS>
DB_NAME=<SERVICE_SPECIFIC>
```

### Service-Specific Variables

**API Gateway**:
- ReverseProxy cluster destinations
- TaskServiceApi__BaseUrl
- WorkflowManagementApi__BaseUrl

**TaskService**:
- WorkflowManagementApi__BaseUrl

---

## Load Balancer Setup

### Application Load Balancer Configuration

**Type**: Application Load Balancer (ALB)

**Scheme**: Internet-facing

**Subnets**: Public subnets (multi-AZ)

**Security Group**: `workflow-automation-alb-sg`

**Listeners**:
- **HTTP (80)**: Redirect to HTTPS
- **HTTPS (443)**: Forward to target group

**Target Group**:
- **Name**: `workflow-automation-api-tg`
- **Protocol**: HTTP
- **Port**: 80
- **Health Check Path**: `/api/tasks/health`
- **Health Check Protocol**: HTTP
- **Healthy Threshold**: 2
- **Unhealthy Threshold**: 3
- **Timeout**: 5 seconds
- **Interval**: 30 seconds

**Target Registration**:
- ECS services register automatically to target group
- Health checks ensure only healthy tasks receive traffic

### Health Check Endpoint

All services should implement health check endpoint:
- **Path**: `/api/tasks/health` or `/health`
- **Method**: GET
- **Response**: 200 OK with service status

---

## SSL/TLS & Domain Configuration

### SSL Certificate Setup

1. **Request Certificate in ACM**:
   - Domain: `*.workflowautomation.enginuo.com`
   - Validation: DNS validation
   - Region: `ap-south-1`

2. **Attach to CloudFront**:
   - Use certificate in CloudFront distribution
   - Enable HTTPS redirect

3. **Attach to ALB**:
   - Use certificate in ALB HTTPS listener
   - Enable HTTP to HTTPS redirect

### DNS Configuration

**Route 53 Records**:

1. **Frontend** (`dev.workflowautomation.enginuo.com`):
   - Type: A (Alias)
   - Alias Target: CloudFront distribution
   - TTL: 300

2. **API** (`api.workflowautomation.enginuo.com`):
   - Type: A (Alias)
   - Alias Target: Application Load Balancer
   - TTL: 300

### Domain Verification

```bash
# Verify DNS resolution
dig dev.workflowautomation.enginuo.com
dig api.workflowautomation.enginuo.com

# Test SSL certificate
openssl s_client -connect dev.workflowautomation.enginuo.com:443
openssl s_client -connect api.workflowautomation.enginuo.com:443
```

---

## Deployment Process

### Initial Setup (One-Time)

1. Create AWS resources (VPC, RDS, ECR, ECS cluster, etc.)
2. Configure GitHub Secrets
3. Create ECS services manually (first time)
4. Run database migrations
5. Create EventBridge event bus

### Backend Deployment

1. Push to `develop` branch
2. GitHub Actions builds Docker images
3. Images pushed to ECR
4. Task definitions created/updated
5. ECS services updated (rolling deployment)
6. Health checks verify deployment

### Frontend Deployment

1. Push to `develop` branch
2. GitHub Actions builds React app
3. Files synced to S3
4. CloudFront cache invalidated
5. Changes visible after cache invalidation

---

## Service Architecture

### Service Communication Flow

```
Internet
   ↓
CloudFront (Frontend)
   ↓
S3 Bucket
   ↓
React App
   ↓
API Gateway (ALB)
   ↓
ECS Services (via Service Discovery)
   ↓
EventBridge/SQS (Async Communication)
   ↓
RDS PostgreSQL
```

### ECS Service Names

- `api-gateway-service`
- `task-manager-task-service-service-xf7qr4t0`
- `workflow-service-service`
- `task-manager-sla-manager-service-service-6a82g2ff`
- `workload-service-service`
- `priority-rule-engine-api-service`
- `workflow-management-api-service`
- `task-manager-sla-configuration-api-service-3ukn5lqc`
- `workload-api-service`

---

## Testing Procedures

### Pre-Deployment Testing

1. **Local Testing**:
   ```bash
   # Build Docker images locally
   docker build -f backend/APIGateway/Dockerfile -t test-api-gateway .
   
   # Run containers locally
   docker-compose up
   
   # Run unit tests
   dotnet test
   ```

2. **Integration Testing**:
   - Test API endpoints
   - Verify database connections
   - Test event publishing/consumption

### Post-Deployment Testing

1. **Health Checks**:
   ```bash
   curl https://api.workflowautomation.enginuo.com/api/tasks/health
   ```

2. **API Testing**:
   ```bash
   # Test workflow creation
   curl -X POST https://api.workflowautomation.enginuo.com/api/workflows \
     -H "Content-Type: application/json" \
     -d '{"name": "Test Workflow"}'
   
   # Test task creation
   curl -X POST https://api.workflowautomation.enginuo.com/api/tasks \
     -H "Content-Type: application/json" \
     -d '{"workflowId": 1, "title": "Test Task"}'
   ```

3. **Frontend Testing**:
   - Verify frontend loads
   - Test user workflows
   - Check API connectivity

4. **Event Testing**:
   - Verify events published to EventBridge
   - Check SQS queues receive messages
   - Verify event handlers process events

### Load Testing

```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 https://api.workflowautomation.enginuo.com/api/tasks/health
```

---

## Monitoring & Logging

### CloudWatch Logs

**Log Groups**:
- `/ecs/task-manager-api-gateway`
- `/ecs/task-manager-task-service`
- `/ecs/task-manager-workflow-service`
- etc.

**Log Retention**: 30 days (configurable)

### CloudWatch Metrics

**ECS Metrics**:
- CPUUtilization
- MemoryUtilization
- RunningTaskCount
- DesiredTaskCount

**ALB Metrics**:
- RequestCount
- TargetResponseTime
- HTTPCode_Target_2XX_Count
- HTTPCode_Target_4XX_Count
- HTTPCode_Target_5XX_Count

**RDS Metrics**:
- CPUUtilization
- DatabaseConnections
- FreeableMemory
- ReadLatency
- WriteLatency

### CloudWatch Alarms

Create alarms for:
- High CPU utilization (>80%)
- High memory utilization (>80%)
- High error rate (>5%)
- Database connection issues
- Service health check failures

### Log Aggregation

Consider using:
- **CloudWatch Logs Insights** for querying logs
- **AWS X-Ray** for distributed tracing (optional)
- **CloudWatch Dashboards** for visualization

---

## Performance Optimization

### ECS Optimization

1. **Right-Sizing**:
   - Monitor CPU/Memory usage
   - Adjust task definitions accordingly
   - Consider Fargate Spot for non-critical workloads

2. **Auto Scaling**:
   - Configure ECS Service Auto Scaling
   - Scale based on CPU/Memory metrics
   - Scale based on ALB request count

3. **Container Optimization**:
   - Use multi-stage Docker builds
   - Minimize image size
   - Optimize .NET runtime settings

### Database Optimization

1. **Connection Pooling**: Configure in application
2. **Read Replicas**: For read-heavy workloads
3. **Query Optimization**: Index frequently queried columns
4. **Connection Limits**: Monitor and adjust

### Frontend Optimization

1. **CDN Caching**: CloudFront caching
2. **Code Splitting**: React lazy loading
3. **Asset Optimization**: Minification, compression
4. **Cache Headers**: Proper cache-control headers

---

## Scaling Strategies

### Horizontal Scaling

**ECS Auto Scaling**:
```json
{
  "minCapacity": 1,
  "maxCapacity": 10,
  "targetTrackingScalingPolicies": [
    {
      "targetValue": 70.0,
      "predefinedMetricSpecification": {
        "predefinedMetricType": "ECSServiceAverageCPUUtilization"
      }
    }
  ]
}
```

**Scaling Triggers**:
- CPU utilization > 70%
- Memory utilization > 80%
- ALB request count > 1000/min

### Vertical Scaling

- Increase CPU/Memory in task definitions
- Upgrade RDS instance class
- Increase ECR image pull limits

### Database Scaling

- **Read Replicas**: For read-heavy workloads
- **Multi-AZ**: For high availability
- **Storage Auto-Scaling**: Enable for RDS

---

## Cost Optimization

### Cost Breakdown (Estimated)

**ECS Fargate**:
- 9 services × 0.25 vCPU × 0.5 GB × $0.04/vCPU-hour = ~$0.09/hour
- Monthly: ~$65

**RDS**:
- db.t3.medium Multi-AZ: ~$150/month
- Storage: ~$15/month

**ALB**:
- ~$20/month + data transfer

**CloudFront**:
- ~$5/month (first 1TB free)

**S3**:
- ~$1/month (first 5GB free)

**EventBridge/SQS**:
- ~$5/month (first 1M requests free)

**Total Estimated**: ~$260/month

### Cost Optimization Tips

1. **Use Fargate Spot** for non-critical services (up to 70% savings)
2. **Reserved Instances** for RDS (1-year term)
3. **S3 Lifecycle Policies** for old logs
4. **CloudWatch Logs Retention** (reduce retention period)
5. **Right-Size Resources** (monitor and adjust)
6. **Schedule Non-Production** (stop dev/staging after hours)

---

## Backup & Disaster Recovery

### RDS Backups

- **Automated Backups**: Enabled (7-day retention)
- **Snapshot Retention**: 30 days
- **Point-in-Time Recovery**: Enabled
- **Multi-AZ**: Enabled for production

### Manual Snapshots

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier workflow-automation-db \
  --db-snapshot-identifier workflow-automation-manual-$(date +%Y%m%d) \
  --region ap-south-1
```

### Disaster Recovery Plan

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour

**Recovery Steps**:
1. Restore RDS from snapshot
2. Update ECS task definitions with new DB endpoint
3. Redeploy ECS services
4. Verify application functionality

### Cross-Region Backup

Consider:
- Cross-region RDS snapshot copying
- S3 cross-region replication
- CloudFront distribution in multiple regions

---

## Troubleshooting

### Common Issues

#### 1. ECS Service Not Found
**Solution**: Create service manually in ECS console

#### 2. Docker Build Failures
**Solution**: Check Dockerfile, NuGet.config, project references

#### 3. Database Connection Issues
**Solution**: Verify security groups, credentials, endpoint

#### 4. EventBridge/SQS Issues
**Solution**: Check IAM permissions, event bus exists, queues created

#### 5. Frontend Not Updating
**Solution**: Verify CloudFront invalidation, S3 sync, cache headers

### Debugging Commands

```bash
# Check ECS service status
aws ecs describe-services \
  --cluster workflow-automation-cluster \
  --services api-gateway-service \
  --region ap-south-1

# View CloudWatch Logs
aws logs tail /ecs/task-manager-api-gateway --follow --region ap-south-1

# Test database connectivity
psql -h workflow-automation-db.czj02dhursas.ap-south-1.rds.amazonaws.com \
  -U postgres -d WorkflowManagement

# Check EventBridge events
aws events list-rules --region ap-south-1
```

---

## Rollback Procedures

### Backend Rollback

**Via ECS Console**:
1. Go to ECS → Cluster → Service
2. Click "Update Service"
3. Select previous task definition revision
4. Force new deployment

**Via AWS CLI**:
```bash
aws ecs update-service \
  --cluster workflow-automation-cluster \
  --service <service-name> \
  --task-definition <previous-task-definition> \
  --force-new-deployment \
  --region ap-south-1
```

### Frontend Rollback

1. Revert Git commit
2. Push to `develop` branch
3. Workflow redeploys previous version

### Database Rollback

1. Restore from RDS snapshot
2. Update application configuration
3. Redeploy services

---

## Deployment Checklist

### Pre-Deployment
- [ ] AWS infrastructure created
- [ ] GitHub Secrets configured
- [ ] ECS services created
- [ ] RDS databases created
- [ ] EventBridge event bus created
- [ ] S3 bucket and CloudFront configured
- [ ] SSL certificates issued
- [ ] DNS records configured

### Backend Deployment
- [ ] Code pushed to `develop`
- [ ] Workflow triggered
- [ ] Docker images built
- [ ] Images pushed to ECR
- [ ] Task definitions created
- [ ] Services updated
- [ ] Health checks passing

### Frontend Deployment
- [ ] Code pushed to `develop`
- [ ] Workflow triggered
- [ ] Dependencies installed
- [ ] App built successfully
- [ ] Files synced to S3
- [ ] CloudFront cache invalidated
- [ ] Frontend accessible

### Post-Deployment
- [ ] All services running
- [ ] CloudWatch Logs checked
- [ ] API endpoints tested
- [ ] Frontend functional
- [ ] End-to-end workflows tested
- [ ] Monitoring alerts configured

---

## Support & Resources

### AWS Documentation
- [ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [EventBridge Documentation](https://docs.aws.amazon.com/eventbridge/)
- [RDS Documentation](https://docs.aws.amazon.com/rds/)

### GitHub Actions
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

### Internal Documentation
- See `COMPLETE_PROJECT_DOCUMENTATION.md` for system architecture

---

**Document Version**: 2.0  
**Last Updated**: January 2026  
**Maintained By**: DevOps Team
