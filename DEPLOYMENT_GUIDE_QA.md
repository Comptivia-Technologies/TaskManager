# QA Deployment Guide – Task Management System

Essential reference for deploying and operating the QA environment.

---

## QA environment overview

| Item | Value |
|------|--------|
| **Frontend URL** | https://qa.workflowautomation.enginuo.com |
| **API URL** (build-time for UI) | https://qa-api.workflowautomation.enginuo.com |
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
| **PGHOST** | `ep-lucky-haze-a12q0wll-pooler.ap-southeast-1.aws.neon.tech` |
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

## GitHub secrets required (QA UI)

Same as dev unless you use QA-specific values:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `REACT_APP_PRODUCT_ID`
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`

**Not needed for QA UI:** DB password, PG host (used only by backend).

---

## GitHub secrets/variables for QA backend (when added)

- **Secret:** `QA_DB_PASSWORD` (or reuse `DB_PASSWORD` if same).
- **In workflow or Variables:** `QA_DB_HOST`, `QA_DB_NAME`, `QA_DB_USER`, `QA_DB_PORT` (or hardcode in workflow like dev).

---

## Quick checks

- **Deploy QA UI:** Push to `qa` with changes under `frontend/**`, or run "Deploy Frontend to QA (S3 + CloudFront)" manually.
- **IAM:** Same user as dev must have s3:PutObject (and related) on `qa.workflowautomation.enginuo.com` and `cloudfront:CreateInvalidation` on the QA distribution.
- **API URL:** If QA API base URL differs, set `API_URL` in the workflow env (or via a GitHub Variable) in `deploy-frontend-qa.yml`.

---

**Document:** QA deployment reference  
**See also:** `DEPLOYMENT_GUIDE.md` (full dev/infra), `.github/workflows/deploy-frontend-qa.yml`
