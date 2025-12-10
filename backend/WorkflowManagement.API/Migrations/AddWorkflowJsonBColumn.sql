-- Migration Script: Add JSONB column to Workflows table
-- This allows storing the complete workflow structure as JSON for easy retrieval
-- Usage: psql -U postgres -d WorkflowManagement -f AddWorkflowJsonBColumn.sql

DO $$
BEGIN
    -- Check if WorkflowJson column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Workflows' 
        AND column_name = 'WorkflowJson'
    ) THEN
        -- Add JSONB column
        ALTER TABLE "Workflows" 
        ADD COLUMN "WorkflowJson" JSONB;
        
        RAISE NOTICE 'WorkflowJson JSONB column added successfully to Workflows table.';
    ELSE
        RAISE NOTICE 'WorkflowJson column already exists in Workflows table.';
    END IF;
END $$;

-- Optional: Create an index on the JSONB column for better query performance
-- CREATE INDEX IF NOT EXISTS idx_workflows_json_gin ON "Workflows" USING GIN ("WorkflowJson");


