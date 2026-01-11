# Terminal Testing Guide - Step by Step

## 🚀 Quick Start

All commands are ready to copy-paste. Just follow the steps!

---

## Step 1: Verify Services Are Running

```powershell
# Check if services are running
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*"} | Select-Object ProcessName, Id

# Check RabbitMQ
docker ps | Select-String "rabbitmq"
```

**Expected:** You should see dotnet processes and rabbitmq container running.

---

## Step 2: Set Up Test Data (One-Time Setup)

### 2.1 Create a Team

```powershell
$team = @{
    teamName = "ERP Development Team"
    description = "Team for ERP tasks"
} | ConvertTo-Json

$teamResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/teams" `
    -Method POST `
    -ContentType "application/json" `
    -Body $team

$teamId = $teamResponse.teamId
Write-Host "Team Created! TeamId: $teamId" -ForegroundColor Green
```

### 2.2 Add Members to Team

```powershell
# Member 1
$member1 = @{
    firstName = "John"
    lastName = "Doe"
    email = "john.doe@example.com"
    teamId = $teamId
    role = "Senior Developer"
    skillLevel = 4
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/$teamId/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member1

Write-Host "Member 1 added" -ForegroundColor Green

# Member 2
$member2 = @{
    firstName = "Jane"
    lastName = "Smith"
    email = "jane.smith@example.com"
    teamId = $teamId
    role = "Developer"
    skillLevel = 3
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/$teamId/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member2

Write-Host "Member 2 added" -ForegroundColor Green
```

### 2.3 Create Workflow

```powershell
$workflow = @{
    workflowName = "ERP Workflow"
    description = "Workflow for ERP-related tasks"
    teamId = $teamId
} | ConvertTo-Json

$workflowResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/workflows" `
    -Method POST `
    -ContentType "application/json" `
    -Body $workflow

$workflowId = $workflowResponse.workflowId
Write-Host "Workflow Created! WorkflowId: $workflowId" -ForegroundColor Green
```

### 2.4 Configure SLA

```powershell
$slaConfig = @{
    workflowId = $workflowId
    priorityLevelsJson = @{
        Critical = @{ responseTime = 60 }
        High = @{ responseTime = 120 }
        Medium = @{ responseTime = 240 }
        Low = @{ responseTime = 480 }
    } | ConvertTo-Json -Depth 10
}

Invoke-RestMethod -Uri "http://localhost:5001/api/sla-configurations" `
    -Method POST `
    -ContentType "application/json" `
    -Body $slaConfig

Write-Host "SLA Configured!" -ForegroundColor Green
```

---

## Step 3: Test the Flow

### 3.1 Create a Task

```powershell
# Create task
$task = @{
    taskName = "Fix ERP Authentication Bug"
    taskType = "ERP"
    priority = "Critical"
    description = "Fix critical authentication issue in ERP system"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST `
    -ContentType "application/json" `
    -Body $task

$taskId = $response.taskId
$correlationId = $response.correlationId

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Task Created Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "TaskId: $taskId" -ForegroundColor Yellow
Write-Host "CorrelationId: $correlationId" -ForegroundColor Yellow
Write-Host ""
```

### 3.2 Wait for Processing

```powershell
Write-Host "Waiting 5 seconds for event processing..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "Processing complete!" -ForegroundColor Green
```

---

## Step 4: Verify Results

### 4.1 Check TaskService Database (via psql)

```powershell
# Connect to PostgreSQL and check task
psql -U postgres -d TaskService -c "SELECT \"TaskId\", \"TaskName\", \"Priority\", \"TaskType\", \"Status\", \"WorkflowId\", \"MemberId\", \"SLADeadline\" FROM \"Tasks\" WHERE \"TaskId\" = '$taskId';"
```

**Expected Output:**
- Status: `2` (Assigned)
- WorkflowId: `[Your WorkflowId]`
- MemberId: `[Member ID from Team]`
- SLADeadline: `[Future timestamp]`

### 4.2 Check WorkflowService Database

```powershell
psql -U postgres -d WorkflowManagement -c "SELECT \"TaskId\", \"WorkflowId\", \"WorkflowName\", \"SelectionReason\" FROM \"WorkflowSelections\" WHERE \"TaskId\" = '$taskId';"
```

**Expected Output:**
- WorkflowId: `[Your WorkflowId]`
- WorkflowName: "ERP Workflow"
- SelectionReason: Contains "ERP"

### 4.3 Check SLAManagerService Database

```powershell
psql -U postgres -d SLAConfiguration -c "SELECT \"TaskId\", \"WorkflowId\", \"Priority\", \"ResponseTimeMinutes\", \"SLADeadline\" FROM \"SLAAssignments\" WHERE \"TaskId\" = '$taskId';"
```

**Expected Output:**
- Priority: `Critical` (not "Medium"!)
- ResponseTimeMinutes: `60`

### 4.4 Check WorkloadService Database

```powershell
psql -U postgres -d WorkflowManagement -c "SELECT \"TaskId\", \"MemberId\", \"WorkloadScore\", \"AssignmentReason\" FROM \"TaskAssignments\" WHERE \"TaskId\" = '$taskId';"
```

**Expected Output:**
- MemberId: `[Member ID from your team]`
- WorkloadScore: `[A number]`

---

## 🎯 Complete Test Script (All-in-One)

Save this as `complete-test.ps1`:

```powershell
# Complete Test Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Complete Flow Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Team
Write-Host "Step 1: Creating Team..." -ForegroundColor Yellow
$team = @{
    teamName = "ERP Development Team"
    description = "Team for ERP tasks"
} | ConvertTo-Json

$teamResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/teams" `
    -Method POST `
    -ContentType "application/json" `
    -Body $team

$teamId = $teamResponse.teamId
Write-Host "✅ Team Created! TeamId: $teamId" -ForegroundColor Green
Write-Host ""

# Step 2: Add Members
Write-Host "Step 2: Adding Members..." -ForegroundColor Yellow
$member1 = @{
    firstName = "John"
    lastName = "Doe"
    email = "john.doe@example.com"
    teamId = $teamId
    role = "Senior Developer"
    skillLevel = 4
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/$teamId/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member1 | Out-Null

$member2 = @{
    firstName = "Jane"
    lastName = "Smith"
    email = "jane.smith@example.com"
    teamId = $teamId
    role = "Developer"
    skillLevel = 3
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/teams/$teamId/members" `
    -Method POST `
    -ContentType "application/json" `
    -Body $member2 | Out-Null

Write-Host "✅ Members Added!" -ForegroundColor Green
Write-Host ""

# Step 3: Create Workflow
Write-Host "Step 3: Creating Workflow..." -ForegroundColor Yellow
$workflow = @{
    workflowName = "ERP Workflow"
    description = "Workflow for ERP-related tasks"
    teamId = $teamId
} | ConvertTo-Json

$workflowResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/workflows" `
    -Method POST `
    -ContentType "application/json" `
    -Body $workflow

$workflowId = $workflowResponse.workflowId
Write-Host "✅ Workflow Created! WorkflowId: $workflowId" -ForegroundColor Green
Write-Host ""

# Step 4: Configure SLA
Write-Host "Step 4: Configuring SLA..." -ForegroundColor Yellow
$slaConfig = @{
    workflowId = $workflowId
    priorityLevelsJson = @{
        Critical = @{ responseTime = 60 }
        High = @{ responseTime = 120 }
        Medium = @{ responseTime = 240 }
        Low = @{ responseTime = 480 }
    } | ConvertTo-Json -Depth 10
}

Invoke-RestMethod -Uri "http://localhost:5001/api/sla-configurations" `
    -Method POST `
    -ContentType "application/json" `
    -Body $slaConfig | Out-Null

Write-Host "✅ SLA Configured!" -ForegroundColor Green
Write-Host ""

# Step 5: Create Task
Write-Host "Step 5: Creating Task..." -ForegroundColor Yellow
$task = @{
    taskName = "Fix ERP Authentication Bug"
    taskType = "ERP"
    priority = "Critical"
    description = "Fix critical authentication issue in ERP system"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST `
    -ContentType "application/json" `
    -Body $task

$taskId = $response.taskId
$correlationId = $response.correlationId

Write-Host "✅ Task Created!" -ForegroundColor Green
Write-Host "TaskId: $taskId" -ForegroundColor Cyan
Write-Host "CorrelationId: $correlationId" -ForegroundColor Cyan
Write-Host ""

# Step 6: Wait for Processing
Write-Host "Step 6: Waiting for event processing (5 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5
Write-Host "✅ Processing complete!" -ForegroundColor Green
Write-Host ""

# Step 7: Display Verification Queries
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Verification Queries" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check TaskService Database:" -ForegroundColor Magenta
Write-Host "psql -U postgres -d TaskService -c \"SELECT * FROM \\\"Tasks\\\" WHERE \\\"TaskId\\\" = '$taskId';\"" -ForegroundColor Gray
Write-Host ""
Write-Host "Check WorkflowService Database:" -ForegroundColor Magenta
Write-Host "psql -U postgres -d WorkflowManagement -c \"SELECT * FROM \\\"WorkflowSelections\\\" WHERE \\\"TaskId\\\" = '$taskId';\"" -ForegroundColor Gray
Write-Host ""
Write-Host "Check SLAManagerService Database:" -ForegroundColor Magenta
Write-Host "psql -U postgres -d SLAConfiguration -c \"SELECT * FROM \\\"SLAAssignments\\\" WHERE \\\"TaskId\\\" = '$taskId';\"" -ForegroundColor Gray
Write-Host ""
Write-Host "Check WorkloadService Database:" -ForegroundColor Magenta
Write-Host "psql -U postgres -d WorkflowManagement -c \"SELECT * FROM \\\"TaskAssignments\\\" WHERE \\\"TaskId\\\" = '$taskId';\"" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
```

**Run it:**
```powershell
.\complete-test.ps1
```

---

## 🔍 Quick Verification Commands

### Check if Task was Created

```powershell
# Replace YOUR_TASK_ID with actual task ID
$taskId = "YOUR_TASK_ID"

# Check TaskService
psql -U postgres -d TaskService -c "SELECT \"TaskName\", \"Status\", \"WorkflowId\", \"MemberId\" FROM \"Tasks\" WHERE \"TaskId\" = '$taskId';"
```

### Check Workflow Selection

```powershell
psql -U postgres -d WorkflowManagement -c "SELECT \"WorkflowName\", \"SelectionReason\" FROM \"WorkflowSelections\" WHERE \"TaskId\" = '$taskId';"
```

### Check SLA Configuration

```powershell
psql -U postgres -d SLAConfiguration -c "SELECT \"Priority\", \"ResponseTimeMinutes\", \"SLADeadline\" FROM \"SLAAssignments\" WHERE \"TaskId\" = '$taskId';"
```

### Check Member Assignment

```powershell
psql -U postgres -d WorkflowManagement -c "SELECT \"MemberId\", \"WorkloadScore\" FROM \"TaskAssignments\" WHERE \"TaskId\" = '$taskId';"
```

---

## 📊 Check Service Logs

### View Logs in Real-Time

If services are running in separate terminals, you'll see logs automatically. Look for:

**WorkflowService:**
```
Matched workflow by name. TaskType: ERP, WorkflowName: ERP Workflow
```

**SLAManagerService:**
```
SLA configured for task. Priority: Critical, ResponseTime: 60min
```

**WorkloadService:**
```
Filtering members by workflow team. TeamId: 1
Task assigned to member. MemberId: 2
```

---

## 🐛 Troubleshooting Commands

### Check if Services are Running

```powershell
# Check API Gateway
Test-NetConnection -ComputerName localhost -Port 5004

# Check TaskService
Test-NetConnection -ComputerName localhost -Port 5005

# Check WorkflowService
Test-NetConnection -ComputerName localhost -Port 5006

# Check SLAManagerService
Test-NetConnection -ComputerName localhost -Port 5007

# Check WorkloadService
Test-NetConnection -ComputerName localhost -Port 5008
```

### Check RabbitMQ

```powershell
# Check if RabbitMQ is running
docker ps | Select-String "rabbitmq"

# Check RabbitMQ Management UI
Start-Process "http://localhost:15672"
```

### Test API Gateway Directly

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:5004/api/tasks/health"
```

---

## 🎯 Expected Results

After running the test, you should see:

1. ✅ **Task Created** in TaskService database
2. ✅ **Workflow Matched** - "ERP Workflow" selected for "ERP" task
3. ✅ **SLA Configured** - Priority "Critical" used (60 minutes)
4. ✅ **Member Assigned** - From workflow's team only
5. ✅ **Task Status** - Changed to "Assigned" (2)

---

## 💡 Quick Test (Minimal)

If you already have test data set up, just run:

```powershell
# Create task
$task = @{
    taskName = "Test ERP Task"
    taskType = "ERP"
    priority = "Critical"
    description = "Test"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:5004/api/tasks" `
    -Method POST -ContentType "application/json" -Body $task

Write-Host "TaskId: $($response.taskId)"
Write-Host "Wait 5 seconds, then check databases..."
Start-Sleep -Seconds 5
```

That's it! The flow will process automatically.

