# Environment Variables for Deployment

This document lists all environment variables that need to be configured for deployment.

## Frontend

### Required Environment Variables

- `REACT_APP_API_URL` - API Gateway URL
  - **Development**: `http://localhost:5004/api`
  - **Production**: Set to your production API Gateway URL (e.g., `https://api.yourdomain.com/api`)

### Setup

1. Create `.env` file in `frontend/workflow/` directory
2. Add: `REACT_APP_API_URL=http://localhost:5004/api`
3. For production, set this via your hosting platform's environment variables

**Note**: React requires the `REACT_APP_` prefix for environment variables to be accessible in the browser.

---

## Backend - APIGateway

### Required Configuration (appsettings.json or Environment Variables)

- `TaskServiceApi:BaseUrl` - TaskService API URL
  - **Development**: `http://localhost:5005/api`
  - **Production**: Set to your TaskService URL

- `WorkflowManagementApi:BaseUrl` - WorkflowManagement API URL
  - **Development**: `http://localhost:5000/api`
  - **Production**: Set to your WorkflowManagement API URL

### Reverse Proxy Cluster Addresses (Environment Variables)

These can override the default localhost addresses in `appsettings.json`:

- `WORKFLOW_MANAGEMENT_API_BASE` - Base URL for workflow-cluster (default: `http://localhost:5000`)
- `SLA_CONFIGURATION_API_BASE` - Base URL for sla-cluster (default: `http://localhost:5002`)
- `PRIORITY_RULE_ENGINE_API_BASE` - Base URL for priority-cluster (default: `http://localhost:5010`)
- `WORKLOAD_API_BASE` - Base URL for workload-cluster (default: `http://localhost:5003`)
- `TASK_SERVICE_API_BASE` - Base URL for task-service-cluster (default: `http://localhost:5005`)

**Example**:
```bash
export WORKFLOW_MANAGEMENT_API_BASE=http://workflow-api:5000
export SLA_CONFIGURATION_API_BASE=http://sla-api:5002
export PRIORITY_RULE_ENGINE_API_BASE=http://priority-api:5010
export WORKLOAD_API_BASE=http://workload-api:5003
export TASK_SERVICE_API_BASE=http://task-service:5005
```

---

## Backend - TaskService

### Required Configuration (appsettings.json or Environment Variables)

- `WorkflowManagementApi:BaseUrl` - WorkflowManagement API URL
  - **Development**: `http://localhost:5000/api`
  - **Production**: Set to your WorkflowManagement API URL

**Note**: This configuration is **required**. The service will throw an exception if not provided.

---

## Backend - All REST APIs (CORS Configuration)

### Required Configuration (appsettings.json or Environment Variables)

The following APIs require CORS configuration:

- `WorkflowManagement.API`
- `SLAConfiguration.API`
- `Workload.API`
- `PriorityRuleEngine.API`

**Configuration Key**: `Cors:AllowedOrigin`

- **Development**: `http://localhost:3000`
- **Production**: Set to your frontend URL (e.g., `https://app.yourdomain.com`)

**Note**: This configuration is **required**. The service will throw an exception if not provided.

**Example** (appsettings.json):
```json
{
  "Cors": {
    "AllowedOrigin": "http://localhost:3000"
  }
}
```

**Example** (Environment Variable):
```bash
export Cors__AllowedOrigin=http://localhost:3000
```

---

## Database Connection Strings

All services use connection strings in `appsettings.json` or environment variables:

**Configuration Key**: `ConnectionStrings:DefaultConnection`

**Example**:
```
Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=yourpassword
```

**Environment Variable**:
```bash
export ConnectionStrings__DefaultConnection="Host=db-host;Port=5432;Database=WorkflowManagement;Username=postgres;Password=yourpassword"
```

---

## Event Bus Configuration

All services require EventBus configuration. See `COMPLETE_PROJECT_DOCUMENTATION.md` for detailed EventBus setup (AWS/Azure/GCP).

---

## Summary

### Quick Reference

| Service | Required Config | Default (Development) |
|---------|----------------|---------------------|
| **Frontend** | `REACT_APP_API_URL` | `http://localhost:5004/api` |
| **APIGateway** | `TaskServiceApi:BaseUrl` | `http://localhost:5005/api` |
| **APIGateway** | `WorkflowManagementApi:BaseUrl` | `http://localhost:5000/api` |
| **TaskService** | `WorkflowManagementApi:BaseUrl` | `http://localhost:5000/api` |
| **All APIs** | `Cors:AllowedOrigin` | `http://localhost:3000` |

### Production Deployment Checklist

- [ ] Set `REACT_APP_API_URL` to production API Gateway URL
- [ ] Set all `BaseUrl` configurations to production service URLs
- [ ] Set `Cors:AllowedOrigin` to production frontend URL
- [ ] Configure database connection strings
- [ ] Configure EventBus (AWS/Azure/GCP) credentials
- [ ] Set ReverseProxy cluster addresses (if using different service URLs)
- [ ] Ensure all services can reach each other via configured URLs

---

**Last Updated**: January 2026
