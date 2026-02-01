-- Migration: Add Stage Orchestration Tracking fields to WorkflowSelections
-- This prevents the system from restarting Stage 1 when a task is reassigned

-- Add StageOrchestrationStarted column with default value
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WorkflowSelections' 
        AND column_name = 'StageOrchestrationStarted'
    ) THEN
        ALTER TABLE "WorkflowSelections" 
        ADD COLUMN "StageOrchestrationStarted" BOOLEAN NOT NULL DEFAULT FALSE;
        
        RAISE NOTICE 'Added StageOrchestrationStarted column to WorkflowSelections';
    ELSE
        RAISE NOTICE 'StageOrchestrationStarted column already exists';
    END IF;
END $$;

-- Add StageOrchestrationStartedAt column (nullable)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WorkflowSelections' 
        AND column_name = 'StageOrchestrationStartedAt'
    ) THEN
        ALTER TABLE "WorkflowSelections" 
        ADD COLUMN "StageOrchestrationStartedAt" TIMESTAMP NULL;
        
        RAISE NOTICE 'Added StageOrchestrationStartedAt column to WorkflowSelections';
    ELSE
        RAISE NOTICE 'StageOrchestrationStartedAt column already exists';
    END IF;
END $$;

-- Update existing records that have already started stage orchestration
-- (Any task that already has a stage assigned should be marked as orchestration started)
-- This can be run manually after migration if needed:
-- UPDATE "WorkflowSelections" SET "StageOrchestrationStarted" = TRUE, "StageOrchestrationStartedAt" = NOW()
-- WHERE "TaskId" IN (SELECT "Id" FROM "Tasks" WHERE "CurrentStageId" IS NOT NULL);

SELECT 'Migration completed: AddStageOrchestrationTracking' AS status;

