# Migration: Make Workflow.TeamId Nullable

## Purpose
This migration makes the `Workflow.TeamId` column nullable, allowing workflows to exist without a team assignment (since stages have their own teams).

## How to Run

### Option 1: Using a Database Management Tool (Easiest)
1. Open your PostgreSQL database management tool (pgAdmin, DBeaver, Azure Data Studio, etc.)
2. Connect to your database: `WorkflowManagement`
3. Open the file: `MakeWorkflowTeamIdNullable.sql`
4. Execute the SQL script

### Option 2: Using psql Command Line
If you have PostgreSQL installed and `psql` is in your PATH:

```powershell
cd backend\WorkflowManagement.API\Migrations
$env:PGPASSWORD="test123"  # Use your actual password
psql -h localhost -p 5432 -U postgres -d WorkflowManagement -f MakeWorkflowTeamIdNullable.sql
```

### Option 3: Using PowerShell Script
If `psql` is in your PATH or installed in a standard location:

```powershell
cd backend\WorkflowManagement.API\Migrations
.\RunWorkflowTeamIdMigration.ps1
```

## SQL Script Content

The migration script:
1. Checks if `TeamId` is currently NOT NULL
2. Drops the foreign key constraint temporarily
3. Makes `TeamId` nullable
4. Re-adds the foreign key constraint (allowing NULL values)

## Verification

After running the migration, you can verify it worked by running:

```sql
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'Workflows' 
AND column_name = 'TeamId';
```

The `is_nullable` column should show `YES`.

## Notes

- The script is idempotent - safe to run multiple times
- Existing workflows with TeamId values will remain unchanged
- New workflows can be created without a TeamId


