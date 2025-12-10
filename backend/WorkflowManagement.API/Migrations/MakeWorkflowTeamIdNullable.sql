-- Migration Script: Make Workflow.TeamId nullable
-- This allows workflows to exist without a team (since stages have teams)
-- Usage: psql -U postgres -d WorkflowManagement -f MakeWorkflowTeamIdNullable.sql

DO $$
BEGIN
    -- Check if TeamId column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Workflows' 
        AND column_name = 'TeamId'
        AND is_nullable = 'NO'
    ) THEN
        -- Step 1: Drop the foreign key constraint temporarily
        ALTER TABLE "Workflows" 
        DROP CONSTRAINT IF EXISTS "FK_Workflows_Teams_TeamId";
        
        -- Step 2: Make TeamId nullable
        ALTER TABLE "Workflows" 
        ALTER COLUMN "TeamId" DROP NOT NULL;
        
        -- Step 3: Re-add the foreign key constraint (allowing NULL)
        ALTER TABLE "Workflows" 
        ADD CONSTRAINT "FK_Workflows_Teams_TeamId" 
        FOREIGN KEY ("TeamId") REFERENCES "Teams" ("TeamId") ON DELETE RESTRICT;
        
        RAISE NOTICE 'Workflow.TeamId column is now nullable.';
    ELSE
        RAISE NOTICE 'Workflow.TeamId column is already nullable or does not exist.';
    END IF;
END $$;

