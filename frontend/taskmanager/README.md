# Task Manager UI (POC)

This is a minimal, standalone React + TypeScript UI for observing tasks managed by the **Task Manager API**.

It is intentionally simple and separate from the main `workflow-management-frontend` app.

## Responsibilities

- Display tasks handled by the Task Manager API
  - Task ID and title
  - Assigned workflow
  - SLA information (priority, response time, resolution time)
  - Status (including an "Overdue" indication based on SLA resolution time)
  - Created / last updated timestamps
- Show a detailed view per task
  - Full task payload (JSON)
  - Workflow details
  - SLA details and computed resolution deadline

> Note: This UI is **read-focused** for observability and POC purposes. Creation of tasks is expected to come from other systems or APIs.

## Architecture

- Framework: Create React App (React 18 + TypeScript)
- Location: `frontend/taskmanager`
- Port: **3001** (via `PORT=3001`)
- Talks to: **Task Manager API** at `http://localhost:5004/api`

Key files:

- `src/App.tsx` – routing setup
- `src/TaskManagerList.tsx` – list/table view of tasks
- `src/TaskManagerDetail.tsx` – task detail and SLA observability
- `src/services.ts` – Axios-based API client
- `src/types.ts` – shared types (`ManagedTask`, `ManagedTaskCreate`, `PriorityLevel`)

## Running the app

1. Ensure backend services are running:
   - Workflow API: `http://localhost:5000`
   - SLA Configuration API: `http://localhost:5002`
   - Task Manager API: `http://localhost:5004`

2. Install and start the Task Manager UI:

```bash
cd frontend/taskmanager
npm install
npm start
```

3. Open the UI:

- Navigate to `http://localhost:3001` in your browser.

## Configuration

If you change the Task Manager API port or base URL, update it in:

- `src/services.ts` → `baseURL: 'http://localhost:5004/api'`


