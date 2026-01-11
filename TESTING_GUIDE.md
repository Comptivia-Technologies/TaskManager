# Testing Guide - Enhanced Workflow Flow

## 🎯 Testing Overview

This guide will help you test the complete flow:
1. Task created with status "Created"
2. Workflow matched by task type
3. SLA configured with actual task priority
4. Task assigned to member from workflow's team

---

## 📋 Prerequisites

### 1. Stop All Running Services

**Important:** Stop all running services first to allow rebuilding.

```powershell
# Check for running services
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*" -or $_.ProcessName -like "*WorkflowService*" -or $_.ProcessName -like "*TaskService*" -or $_.ProcessName -like "*SLAManager*" -or $_.ProcessName -like "*WorkloadService*" -or $_.ProcessName -like "*APIGateway*"}

# Kill them if found
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*"} | Stop-Process -Force
```

Or simply close all terminal windows running the services.

### 2. Ensure RabbitMQ is Running

```powershell
docker ps | Select-String "rabbitmq"
```

If not running:
```powershell
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

### 3. Ensure PostgreSQL is Running

Make sure your PostgreSQL database is accessible.

---

## 🔨 Step 1: Rebuild All Projects

```powershell
# Navigate to project root
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager"

# Build Shared Contracts
cd backend\Shared\Shared.Contracts
dotnet build

# Build Shared Messaging
cd ..\Shared.Messaging
dotnet build

# Build API Gateway
cd ..\..\APIGateway
dotnet build

# Build Task Service
cd ..\TaskService
dotnet build

# Build Workflow Service
cd ..\WorkflowService
dotnet build

# Build SLA Manager Service
cd ..\SLAManagerService
dotnet build

# Build Workload Service
cd ..\WorkloadService
dotnet build
```

---

## 🚀 Step 2: Start All Services

### Option A: Use the Start Script

```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager"
.\start-all.ps1
```

### Option B: Start Manually

Open **6 separate terminal windows** and run:

**Terminal 1 - RabbitMQ (if not using Docker):**
```powershell
# Already running via Docker, skip
```

**Terminal 2 - API Gateway:**
```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\APIGateway"
dotnet run
```

**Terminal 3 - Task Service:**
```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\TaskService"
dotnet run
```

**Terminal 4 - Workflow Service:**
```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\WorkflowService"
dotnet run
```

**Terminal 5 - SLA Manager Service:**
```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\SLAManagerService"
dotnet run
```

**Terminal 6 - Workload Service:**
```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\Comptivia\Task Manager\backend\WorkloadService"
dotnet run
```

**Wait for all services to start** (you should see "Now listening on..." messages).

---

## 📝 Step 3: Set Up Test Data

### 3.1 Create a Team

**Using your existing WorkflowManagement API** (usually port 5000):

```powershell
# Create a team
$teamData = @{
    teamName = "ERP Development Team"
    description = "Team handling ERP-related tasks"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams" `
    -Method POST `
    -ContentType "application/json" `
    -Body $teamData
```

**Note the TeamId from the response** (e.g., `1`).

### 3.2 Add Members to the Team

```powershell
# Add member 1
$member1 = @{
    firstName = "John"
    lastName = "Doe"
    email = "john.doe@example.com"
    teamId = 1  # Use the TeamId from step 3.1
    role = "Senior Developer"
    skillLevel = 4
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/1/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member1

# Add member 2
$member2 = @{
    firstName = "Jane"
    lastName = "Smith"
    email = "jane.smith@example.com"
    teamId = 1
    role = "Developer"
    skillLevel = 3
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/1/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member2
```

### 3.3 Create a Workflow

```powershell
# Create ERP Workflow
$workflow = @{
    workflowName = "ERP Workflow"
    description = "Workflow for ERP-related tasks"
    teamId = 1  # Assign to the team created above
} | ConvertTo-Json

$workflowResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/workflows" `
    -Method POST `
    -ContentType "application/json" `
    -Body $workflow

# Note the WorkflowId from response (e.g., 1)
$workflowId = $workflowResponse.workflowId
Write-Host "WorkflowId: $workflowId"
```

### 3.4 Configure SLA for the Workflow

**Using your existing SLAConfiguration API** (usually port 5001):

```powershell
# Configure SLA with priority levels
$slaConfig = @{
    workflowId = 1  # Use the WorkflowId from step 3.3
    priorityLevelsJson = @{
        Critical = @{
            responseTime = 60  # 60 minutes
        }
        High = @{
            responseTime = 120  # 2 hours
        }
        Medium = @{
            responseTime = 240  # 4 hours
        }
        Low = @{
            responseTime = 480  # 8 hours
        }
    } | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:5001/api/sla-configurations" `
    -Method POST `
    -ContentType "application/json" `
    -Body $slaConfig
```

---

## 🧪 Step 4: Test the Flow

### 4.1 Create a Task via API Gateway

```powershell
# Create a task with TaskType="ERP" to match "ERP Workflow"
$task = @{
    taskName = "Fix ERP Authentication Bug"
    description = "Fix critical authentication issue in ERP system"
    priority = "Critical"
    taskType = "ERP"  # This should match "ERP Workflow"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST `
    -ContentType "application/json" `
    -Body $task

Write-Host "Task Created!"
Write-Host "TaskId: $($response.taskId)"
Write-Host "CorrelationId: $($response.correlationId)"
```

**Save the TaskId and CorrelationId** for verification.

---

## ✅ Step 5: Verify Results

### 5.1 Check Service Logs

Look at each service's console output. You should see:

**API Gateway:**
```
Task creation initiated via API Gateway. TaskId: {TaskId}, CorrelationId: {CorrelationId}
```

**TaskService:**
```
Received event TaskCreatedEvent from queue task.created.queue
Task created from TaskCreatedEvent. TaskId: {TaskId}
```

**WorkflowService:**
```
Received TaskCreatedEvent. TaskId: {TaskId}
Matched workflow by name. TaskType: ERP, WorkflowName: ERP Workflow, WorkflowId: 1
Workflow selected for task. TaskId: {TaskId}, WorkflowId: 1
```

**SLAManagerService:**
```
Received event WorkflowSelectedEvent
SLA configured for task. TaskId: {TaskId}, Priority: Critical, ResponseTime: 60min
```

**WorkloadService:**
```
Received event SLAConfiguredEvent
Filtering members by workflow team. WorkflowId: 1, TeamId: 1
Task assigned to member. TaskId: {TaskId}, MemberId: {MemberId}
```

**TaskService (again):**
```
Received event TaskAssignedEvent
Task updated with member assignment. TaskId: {TaskId}, MemberId: {MemberId}
```

### 5.2 Check TaskService Database

```sql
-- Connect to TaskService database
-- Database: TaskService

SELECT 
    "TaskId",
    "TaskName",
    "Priority",
    "TaskType",
    "Status",
    "WorkflowId",
    "MemberId",
    "SLADeadline"
FROM "Tasks"
WHERE "TaskId" = 'YOUR_TASK_ID_HERE';
```

**Expected Result:**
- ✅ TaskName: "Fix ERP Authentication Bug"
- ✅ Priority: "Critical"
- ✅ TaskType: "ERP"
- ✅ Status: `2` (Assigned)
- ✅ WorkflowId: `1` (or your workflow ID)
- ✅ MemberId: `[Member ID from Team 1]`
- ✅ SLADeadline: `[Timestamp in future]`

### 5.3 Check WorkflowService Database

```sql
-- Connect to WorkflowManagement database
-- Database: WorkflowManagement

SELECT 
    "TaskId",
    "WorkflowId",
    "WorkflowName",
    "SelectionReason",
    "SelectedAt"
FROM "WorkflowSelections"
WHERE "TaskId" = 'YOUR_TASK_ID_HERE';
```

**Expected Result:**
- ✅ WorkflowId: `1` (or your workflow ID)
- ✅ WorkflowName: "ERP Workflow"
- ✅ SelectionReason: "Selected based on task type: ERP"

### 5.4 Check SLAManagerService Database

```sql
-- Connect to SLAConfiguration database
-- Database: SLAConfiguration

SELECT 
    "TaskId",
    "WorkflowId",
    "Priority",
    "ResponseTimeMinutes",
    "SLADeadline",
    "IsOverdue"
FROM "SLAAssignments"
WHERE "TaskId" = 'YOUR_TASK_ID_HERE';
```

**Expected Result:**
- ✅ WorkflowId: `1`
- ✅ Priority: "Critical" (from task, not hardcoded!)
- ✅ ResponseTimeMinutes: `60` (from SLA config)
- ✅ SLADeadline: `[SLAStartTime + 60 minutes]`
- ✅ IsOverdue: `false`

### 5.5 Check WorkloadService Database

```sql
-- Connect to WorkflowManagement database
-- Database: WorkflowManagement

SELECT 
    "TaskId",
    "MemberId",
    "WorkloadScore",
    "AssignmentReason",
    "AssignedAt"
FROM "TaskAssignments"
WHERE "TaskId" = 'YOUR_TASK_ID_HERE';
```

**Expected Result:**
- ✅ MemberId: `[Member ID from Team 1]` (not from other teams!)
- ✅ WorkloadScore: `[A number]`
- ✅ AssignmentReason: Contains workload details

### 5.6 Verify Member is from Correct Team

```sql
-- Connect to WorkflowManagement database

SELECT 
    m."MemberId",
    m."FirstName",
    m."LastName",
    m."TeamId",
    t."TeamName"
FROM "Members" m
JOIN "Teams" t ON m."TeamId" = t."TeamId"
WHERE m."MemberId" = (
    SELECT "MemberId" 
    FROM "Tasks" 
    WHERE "TaskId" = 'YOUR_TASK_ID_HERE'
);
```

**Expected Result:**
- ✅ TeamId: `1` (matches workflow's team)
- ✅ TeamName: "ERP Development Team"

---

## 🧪 Additional Test Cases

### Test Case 1: Task Type Matching

**Test:** Create task with different task types

```powershell
# Test 1: ERP task
$task1 = @{
    taskName = "ERP Task"
    taskType = "ERP"
    priority = "High"
    description = "Test"
} | ConvertTo-Json

# Test 2: Bug task
$task2 = @{
    taskName = "Bug Task"
    taskType = "Bug"
    priority = "Medium"
    description = "Test"
} | ConvertTo-Json
```

**Expected:** Each task should match workflows with matching names.

### Test Case 2: Priority-Based SLA

**Test:** Create tasks with different priorities

```powershell
# Critical priority
$taskCritical = @{
    taskName = "Critical Task"
    taskType = "ERP"
    priority = "Critical"  # Should use 60 minutes SLA
    description = "Test"
} | ConvertTo-Json

# Low priority
$taskLow = @{
    taskName = "Low Priority Task"
    taskType = "ERP"
    priority = "Low"  # Should use 480 minutes SLA
    description = "Test"
} | ConvertTo-Json
```

**Expected:** Each task should get SLA deadline based on its priority.

### Test Case 3: Team Filtering

**Test:** Create workflow with team vs without team

**Expected:**
- Workflow with team → Only team members considered
- Workflow without team → All members considered

---

## 🐛 Troubleshooting

### Issue: Task not created

**Check:**
1. API Gateway is running on port 5004
2. RabbitMQ is running
3. TaskService is running and connected to RabbitMQ

**Solution:**
- Check API Gateway logs for errors
- Check RabbitMQ Management UI (http://localhost:15672)

### Issue: Workflow not matched

**Check:**
1. Workflow exists in database
2. Workflow name contains task type (case-insensitive)
3. WorkflowService is running

**Solution:**
- Verify workflow name matches task type
- Check WorkflowService logs for matching logic

### Issue: SLA not configured

**Check:**
1. SLA configuration exists for the workflow
2. SLAManagerService is running
3. Priority matches SLA config keys

**Solution:**
- Verify SLA configuration in database
- Check SLAManagerService logs

### Issue: Task not assigned

**Check:**
1. Members exist in workflow's team
2. WorkloadService is running
3. Workflow has TeamId set

**Solution:**
- Verify members are in the correct team
- Check WorkloadService logs for team filtering

---

## 📊 Quick Verification Script

Save this as `test-flow.ps1`:

```powershell
# Test the complete flow
$task = @{
    taskName = "Test ERP Task"
    description = "Testing the complete flow"
    priority = "Critical"
    taskType = "ERP"
} | ConvertTo-Json

Write-Host "Creating task..."
$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST `
    -ContentType "application/json" `
    -Body $task

$taskId = $response.taskId
Write-Host "TaskId: $taskId"
Write-Host "CorrelationId: $($response.correlationId)"
Write-Host ""
Write-Host "Wait 5 seconds for processing..."
Start-Sleep -Seconds 5
Write-Host ""
Write-Host "Check the databases to verify:"
Write-Host "1. TaskService - Task should have WorkflowId, MemberId, SLADeadline"
Write-Host "2. WorkflowService - WorkflowSelection should exist"
Write-Host "3. SLAManagerService - SLAAssignment should exist"
Write-Host "4. WorkloadService - TaskAssignment should exist"
```

Run it:
```powershell
.\test-flow.ps1
```

---

## ✅ Success Criteria

The test is successful if:

1. ✅ Task is created in TaskService database
2. ✅ Workflow is matched by task type (e.g., "ERP" → "ERP Workflow")
3. ✅ SLA is configured with actual task priority (not hardcoded)
4. ✅ Task is assigned to a member from the workflow's team
5. ✅ All fields are populated in TaskService database
6. ✅ Service logs show the complete flow

---

## 🎉 Next Steps

Once testing is successful:

1. Monitor the flow in production
2. Add more workflows for different task types
3. Configure SLAs for each workflow
4. Add more team members as needed

Happy Testing! 🚀

