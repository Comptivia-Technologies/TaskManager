# GCP dev deployment

Project: `workflow-automation-dev-509411`  
Project number: `746256073595`  
Region: `asia-south1`  
Site: https://workflowautomation-746256073595.asia-south1.run.app  
API: https://api-gateway-746256073595.asia-south1.run.app

Database is Neon, not Cloud SQL.  
Local development stays on RabbitMQ (`EVENTBUS_PROVIDER=RabbitMQ`).

Do not commit the Neon password or Firebase keys. The password belongs in Secret Manager. Frontend values stay in `frontend/workflow/.env.development`, which is gitignored.

## 1. Select the project

```powershell
gcloud auth login
gcloud config set project workflow-automation-dev-509411
gcloud config set run/region asia-south1
```

## 2. Enable APIs

```powershell
gcloud services enable run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com pubsub.googleapis.com cloudtasks.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com
```

## 3. Service account

```powershell
gcloud iam service-accounts create task-manager-run --display-name="Task Manager Cloud Run"
$SA = "task-manager-run@workflow-automation-dev-509411.iam.gserviceaccount.com"

foreach ($role in @("roles/cloudsql.client","roles/pubsub.editor","roles/cloudtasks.enqueuer","roles/secretmanager.secretAccessor")) {
  gcloud projects add-iam-policy-binding workflow-automation-dev-509411 --member="serviceAccount:$SA" --role=$role
}

gcloud iam service-accounts add-iam-policy-binding $SA --member="serviceAccount:service-746256073595@gcp-sa-cloudtasks.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"
```

## 4. Neon

In the Neon SQL editor:

```sql
CREATE DATABASE "TaskService";
CREATE DATABASE "WorkflowManagement";
CREATE DATABASE "PriorityRuleEngine";
```

Host: `ep-spring-field-a15ak7se-pooler.ap-southeast-1.aws.neon.tech`  
User: `neondb_owner`  
Port: `5432`

Store the password (replace `NEON_PASSWORD`):

```powershell
gcloud config set project workflow-automation-dev-509411
$file = New-TemporaryFile
[System.IO.File]::WriteAllText($file, "NEON_PASSWORD")
gcloud secrets create neon-db-password --replication-policy=automatic --data-file=$file
Remove-Item $file
```

If the secret already exists:

```powershell
$file = New-TemporaryFile
[System.IO.File]::WriteAllText($file, "NEON_PASSWORD")
gcloud secrets versions add neon-db-password --data-file=$file
Remove-Item $file
```

## 5. Queue and image registry

```powershell
gcloud tasks queues create task-manager-schedules --location=asia-south1
gcloud artifacts repositories create task-manager --repository-format=docker --location=asia-south1
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

Pub/Sub topic `task-manager`, dead-letter topic `task-manager-dlq`, and the five subscriptions are created by the services on startup. Delayed SLA and escalation messages are Cloud Tasks in `task-manager-schedules`. Those tasks appear only after a deadline is scheduled.

## 6. Build backend images

From `backend`. Build `task-service` first:

```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\ERP\TaskManager\backend"
$image = "asia-south1-docker.pkg.dev/workflow-automation-dev-509411/task-manager/task-service:latest"
@"
steps:
- name: gcr.io/cloud-builders/docker
  args: ["build","-f","TaskService/Dockerfile","-t","$image","."]
images: ["$image"]
"@ | Set-Content cloudbuild-task-service.yaml
gcloud builds submit --config cloudbuild-task-service.yaml .
Remove-Item cloudbuild-task-service.yaml
```

Then the other eight:

```powershell
$repo = "asia-south1-docker.pkg.dev/workflow-automation-dev-509411/task-manager"
$services = [ordered]@{
  "APIGateway" = "api-gateway"
  "WorkflowService" = "workflow-service"
  "SLAManagerService" = "sla-manager-service"
  "WorkloadService" = "workload-service"
  "PriorityRuleEngine.API" = "priority-rule-engine-api"
  "WorkflowManagement.API" = "workflow-management-api"
  "SLAConfiguration.API" = "sla-configuration-api"
  "Workload.API" = "workload-api"
}
foreach ($dir in $services.Keys) {
  $name = $services[$dir]
  $image = "$repo/${name}:latest"
  @"
steps:
- name: gcr.io/cloud-builders/docker
  args: ["build","-f","$dir/Dockerfile","-t","$image","."]
images: ["$image"]
"@ | Set-Content "cloudbuild-$name.yaml"
  gcloud builds submit --config "cloudbuild-$name.yaml" .
  Remove-Item "cloudbuild-$name.yaml"
}
```

## 7. Deploy the eight services

Do not pass `--add-cloudsql-instances`. Leave `ConnectionStrings__DefaultConnection` unset so the app builds the Neon connection from `DB_*`.

```powershell
$SA = "task-manager-run@workflow-automation-dev-509411.iam.gserviceaccount.com"
$repo = "asia-south1-docker.pkg.dev/workflow-automation-dev-509411/task-manager"
$base = "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true,EVENTBUS_PROVIDER=GCP,EventBus__GCP__ProjectId=workflow-automation-dev-509411,EventBus__GCP__ServicePrefix=task-manager,EventBus__GCP__SchedulerLocation=asia-south1,EventBus__GCP__TasksQueueId=task-manager-schedules,EventBus__GCP__ServiceAccountEmail=$SA,DB_HOST=ep-spring-field-a15ak7se-pooler.ap-southeast-1.aws.neon.tech,DB_PORT=5432,DB_USER=neondb_owner,Cors__AllowedOrigin=http://localhost:3000"

$deploys = @(
  @{ Name="workflow-management-api"; Db="WorkflowManagement"; Min=0 },
  @{ Name="sla-configuration-api"; Db="WorkflowManagement"; Min=0 },
  @{ Name="workload-api"; Db="WorkflowManagement"; Min=0 },
  @{ Name="priority-rule-engine-api"; Db="PriorityRuleEngine"; Min=1 },
  @{ Name="sla-manager-service"; Db="WorkflowManagement"; Min=1 },
  @{ Name="workload-service"; Db="WorkflowManagement"; Min=1 },
  @{ Name="workflow-service"; Db="WorkflowManagement"; Min=1 },
  @{ Name="task-service"; Db="TaskService"; Min=1 }
)

foreach ($d in $deploys) {
  $cmd = @(
    "run","deploy",$d.Name,
    "--image","$repo/$($d.Name):latest",
    "--region","asia-south1",
    "--service-account",$SA,
    "--port","8080",
    "--allow-unauthenticated",
    "--memory","512Mi",
    "--min-instances","$($d.Min)",
    "--set-secrets","DB_PASSWORD=neon-db-password:latest",
    "--set-env-vars","$base,DB_NAME=$($d.Db)"
  )
  if ($d.Min -eq 1) { $cmd += "--no-cpu-throttling" }
  gcloud @cmd
}
```

`DB_NAME` is `TaskService` for task-service, `PriorityRuleEngine` for priority-rule-engine-api, and `WorkflowManagement` for the other six. The five services with `--min-instances 1` are the Pub/Sub consumers.

## 8. Wire service URLs and deploy the gateway

```powershell
$SA = "task-manager-run@workflow-automation-dev-509411.iam.gserviceaccount.com"
$repo = "asia-south1-docker.pkg.dev/workflow-automation-dev-509411/task-manager"
$base = "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true,EVENTBUS_PROVIDER=GCP,EventBus__GCP__ProjectId=workflow-automation-dev-509411,EventBus__GCP__ServicePrefix=task-manager,EventBus__GCP__SchedulerLocation=asia-south1,EventBus__GCP__TasksQueueId=task-manager-schedules,EventBus__GCP__ServiceAccountEmail=$SA,DB_HOST=ep-spring-field-a15ak7se-pooler.ap-southeast-1.aws.neon.tech,DB_PORT=5432,DB_USER=neondb_owner,Cors__AllowedOrigin=http://localhost:3000"
$wm = "https://workflow-management-api-746256073595.asia-south1.run.app"
$task = "https://task-service-746256073595.asia-south1.run.app"
$sla = "https://sla-configuration-api-746256073595.asia-south1.run.app"
$priority = "https://priority-rule-engine-api-746256073595.asia-south1.run.app"
$workload = "https://workload-api-746256073595.asia-south1.run.app"

gcloud run deploy task-service --image "$repo/task-service:latest" --region asia-south1 --service-account $SA --port 8080 --allow-unauthenticated --memory 512Mi --min-instances 1 --no-cpu-throttling --set-secrets "DB_PASSWORD=neon-db-password:latest" --set-env-vars "$base,DB_NAME=TaskService,WorkflowManagementApi__BaseUrl=$wm/api"

gcloud run deploy workflow-service --image "$repo/workflow-service:latest" --region asia-south1 --service-account $SA --port 8080 --allow-unauthenticated --memory 512Mi --min-instances 1 --no-cpu-throttling --set-secrets "DB_PASSWORD=neon-db-password:latest" --set-env-vars "$base,DB_NAME=WorkflowManagement,TaskServiceApi__BaseUrl=$task/api"

gcloud run deploy api-gateway --image "$repo/api-gateway:latest" --region asia-south1 --service-account $SA --port 8080 --allow-unauthenticated --memory 512Mi --set-env-vars "ASPNETCORE_FORWARDEDHEADERS_ENABLED=true,EVENTBUS_PROVIDER=GCP,EventBus__GCP__ProjectId=workflow-automation-dev-509411,EventBus__GCP__ServicePrefix=task-manager,EventBus__GCP__SchedulerLocation=asia-south1,EventBus__GCP__TasksQueueId=task-manager-schedules,EventBus__GCP__ServiceAccountEmail=$SA,ReverseProxy__Clusters__workflow-cluster__Destinations__destination1__Address=$wm,ReverseProxy__Clusters__sla-cluster__Destinations__destination1__Address=$sla,ReverseProxy__Clusters__priority-cluster__Destinations__destination1__Address=$priority,ReverseProxy__Clusters__workload-cluster__Destinations__destination1__Address=$workload,ReverseProxy__Clusters__task-service-cluster__Destinations__destination1__Address=$task,TaskServiceApi__BaseUrl=$task/api,WorkflowManagementApi__BaseUrl=$wm/api,AuthService__BaseUrl=https://dev.api.product-hub.comptivia.com,Firebase__ProjectId=product-hub-478006"
```

Health check: https://api-gateway-746256073595.asia-south1.run.app/health

## 9. Frontend

Set `REACT_APP_API_URL` in `frontend/workflow/.env.development` to `https://api-gateway-746256073595.asia-south1.run.app`. Keep the existing auth, Firebase, and product values. `npm run build` does not read `.env.development`. Use `npm run build:dev`.

```powershell
cd "C:\Users\SREEJITH MURALI\Desktop\ERP\TaskManager\frontend\workflow"
npm ci
npm run build:dev
```

```powershell
@"
node_modules/
.git
.env*
"@ | Set-Content .gcloudignore -Encoding ascii

@"
server {
  listen 8080;
  location / {
    root /usr/share/nginx/html;
    try_files `$uri `$uri/ /index.html;
  }
}
"@ | Set-Content nginx.conf -Encoding ascii

@"
FROM nginx:alpine
COPY build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
"@ | Set-Content Dockerfile -Encoding ascii

$image = "asia-south1-docker.pkg.dev/workflow-automation-dev-509411/task-manager/frontend:latest"
gcloud builds submit --tag $image .
gcloud run deploy workflowautomation --image $image --region asia-south1 --port 8080 --allow-unauthenticated --memory 256Mi
```

Add `workflowautomation-746256073595.asia-south1.run.app` in Firebase Authentication → Authorized domains for project `product-hub-478006`.

## 10. Confirm messaging

```powershell
gcloud pubsub topics list --project=workflow-automation-dev-509411
gcloud pubsub subscriptions list --project=workflow-automation-dev-509411
gcloud tasks queues describe task-manager-schedules --location=asia-south1
```

Expected topics: `task-manager`, `task-manager-dlq`.  
Expected subscriptions: `task-manager-task-service`, `task-manager-workflow-service`, `task-manager-sla-service`, `task-manager-workload-service`, `task-manager-priority-service`.  
Queue `task-manager-schedules` state: `RUNNING`.
