# JSONB Storage for Workflows

## Overview

We've added JSONB support to store complete workflow structures as JSON in PostgreSQL. This provides several benefits:

### Benefits of JSONB Storage

1. **Easy Retrieval**: The entire workflow structure can be retrieved in a single query
2. **Versioning**: Can store snapshots of workflow states at different points in time
3. **Performance**: JSONB is indexed and can be queried efficiently
4. **Flexibility**: Can store additional metadata or computed values
5. **Export/Import**: Easy to export workflows as JSON for backup or migration

### How It Works

- The `WorkflowJson` column stores the complete workflow structure including:
  - Workflow metadata (name, description, dates)
  - All stages with team names
  - All tasks with member assignments
  - All relationships and computed values

- The JSON is automatically generated and updated when:
  - A workflow is created
  - Tasks are moved between stages
  - Workflow structure changes

### Migration

Run the migration script to add the JSONB column:

```powershell
cd backend\WorkflowManagement.API\Migrations
dotnet run --project RunWorkflowMigration.csproj
```

Or manually:
```sql
psql -U postgres -d WorkflowManagement -f AddWorkflowJsonBColumn.sql
```

### Usage

#### Automatic Updates
The JSON is automatically updated when workflows are created or modified.

#### Manual Update
To manually refresh the JSON for a workflow:
```http
POST /api/workflows/{id}/update-json
```

#### Querying JSONB
You can query the JSONB field directly in PostgreSQL:

```sql
-- Get workflow JSON
SELECT "WorkflowJson" FROM "Workflows" WHERE "WorkflowId" = 1;

-- Query within JSON
SELECT "WorkflowJson"->'stages' FROM "Workflows" WHERE "WorkflowId" = 1;

-- Find workflows with specific stage names
SELECT * FROM "Workflows" 
WHERE "WorkflowJson"->'stages' @> '[{"stageName": "In Progress"}]';
```

### Best Practices

1. **Keep Relational Structure**: The JSONB is a supplement, not a replacement for the relational structure
2. **Use for Snapshots**: Consider storing workflow snapshots at key milestones
3. **Index for Performance**: The migration includes an optional GIN index for faster queries
4. **Regular Updates**: The JSON is updated automatically, but you can manually refresh if needed

### Trade-offs

**Pros:**
- Fast retrieval of complete workflow structure
- Easy to export/import
- Can query JSON directly in PostgreSQL
- Good for versioning and snapshots

**Cons:**
- Additional storage space
- Need to keep JSON in sync with relational data
- More complex queries if you need to update specific parts

### Recommendation

**Use JSONB for:**
- Complete workflow exports
- Versioning/snapshots
- Quick retrieval of full workflow structure
- Backup and restore operations

**Use Relational Structure for:**
- Normal CRUD operations
- Complex queries and filtering
- Data integrity and relationships
- Performance-critical operations

The hybrid approach (relational + JSONB) gives you the best of both worlds!


