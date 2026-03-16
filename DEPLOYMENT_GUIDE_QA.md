# QA Deployment Guide – Task Management System

Essential reference for deploying and operating the QA environment.

---

## QA environment overview

| Item | Value |
|------|--------|
| **Frontend URL** | https://qa.workflowautomation.enginuo.com |
| **API URL** (build-time for UI) | https://qa.api.workflowautomation.enginuo.com |
| **AWS Region** | ap-south-1 |

---

## Frontend (S3 + CloudFront)

| Resource | Value |
|----------|--------|
| **S3 bucket** | `qa.workflowautomation.enginuo.com` |
| **S3 ARN** | `arn:aws:s3:::qa.workflowautomation.enginuo.com` |
| **CloudFront distribution ID** | `E2FZCABSWJ9XF3` |
| **CloudFront ARN** | `arn:aws:cloudfront::798277642170:distribution/E2FZCABSWJ9XF3` |
| **CloudFront domain** | `d1ey5ypv2d5vbb.cloudfront.net` |
| **Custom domain** | qa.workflowautomation.enginuo.com |

---

## Database (Neon PostgreSQL)

Used by backend only. **Do not commit the password.** Store it in GitHub Secrets (e.g. `QA_DB_PASSWORD`).

| Variable | Value |
|----------|--------|
| **PGHOST** | `ep-patient-sunset-ann0reem-pooler.c-6.us-east-1.aws.neon.tech` |
| **PGDATABASE** | `neondb` |
| **PGUSER** | `neondb_owner` |
| **PGPASSWORD** | Store in GitHub Secrets only |
| **PGSSLMODE** | `require` |
| **PGCHANNELBINDING** | `require` |

---

## CI/CD – QA frontend pipeline

| Item | Value |
|------|--------|
| **Workflow file** | `.github/workflows/deploy-frontend-qa.yml` |
| **Trigger branch** | `qa` |
| **Path filter** | `frontend/**` |
| **Manual run** | Yes (`workflow_dispatch`) |

**Steps:** Checkout → AWS credentials → Node 18 → `npm ci` → build (with `REACT_APP_API_URL`) → S3 sync → CloudFront invalidation.

---

## CI/CD – QA backend pipeline

| Item | Value |
|------|--------|
| **Workflow file** | `.github/workflows/deploy-backend-qa.yml` |
| **Trigger branch** | `qa` |
| **Path filter** | `backend/**` |
| **Manual run** | Yes (`workflow_dispatch`) |

**Steps:** Checkout → AWS credentials → ECR login → build & push images (same ECR as dev) → register task definitions → update QA ECS services.

**ECS cluster:** `workflow-automation-cluster` (same as dev)

**QA ECS services:**  
`task-manager-api-gateway-qa`, `task-manager-task-service-qa`, `task-manager-workflow-service-qa`, `task-manager-sla-manager-service-qa`, `task-manager-workload-service-qa`, `task-manager-priority-rule-engine-api-qa`, `task-manager-workflow-management-api-qa`, `task-manager-sla-configuration-api-qa`, `task-manager-workload-api-qa`

**Env:** Same event bus (`work-flow-bus`), same scheduler group (`task-manager-schedules`), QA DB (Neon), CORS `https://qa.workflowautomation.enginuo.com`, Auth `https://qa.api.product-hub.comptivia.com`.

---

## GitHub secrets required

**QA UI + backend (shared):**  
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

**QA frontend:** Product ID and Firebase (product-hub-qa) are set in `deploy-frontend-qa.yml` env; no separate secrets needed for QA build.

**QA backend only:**  
- `QA_DB_PASSWORD` – QA Neon DB password (required for `deploy-backend-qa.yml`)
- `ROLES_API_KEY` – for WorkflowManagement.API (GET /api/roles/all)

---

## Quick checks

- **Deploy QA UI:** Push to `qa` with changes under `frontend/**`, or run "Deploy Frontend to QA (S3 + CloudFront)" manually.
- **Deploy QA backend:** Push to `qa` with changes under `backend/**`, or run "Deploy Backend to QA (ECS)" manually. Ensure `QA_DB_PASSWORD` is set in repo secrets.
- **IAM:** Same user as dev must have S3/CloudFront for QA bucket + distribution, and ECS/ECR/EventBridge etc. for backend.
- **Service discovery:** QA services use namespace `workflow-automation`; internal hostnames are e.g. `task-manager-workflow-management-api-qa.workflow-automation`. If your QA service discovery names differ, update the ReverseProxy and API base URLs in `deploy-backend-qa.yml`.

---

**Document:** QA deployment reference  
**See also:** `DEPLOYMENT_GUIDE.md` (full dev/infra), `.github/workflows/deploy-frontend-qa.yml`, `.github/workflows/deploy-backend-qa.yml`
