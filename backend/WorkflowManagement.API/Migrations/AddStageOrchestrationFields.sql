-- Migration: Add Stage Orchestration Fields
-- Database: WorkflowManagement
-- Description: Adds StageType, TransitionPolicy, and TimeoutMinutes to Stages table

-- Add new columns to Stages table
ALTER TABLE "Stages" 
ADD COLUMN IF NOT EXISTS "StageType" INTEGER NOT NULL DEFAULT 0,  -- 0 = Process, 1 = Escalation
ADD COLUMN IF NOT EXISTS "TransitionPolicy" INTEGER NOT NULL DEFAULT 0,  -- 0 = OnComplete, 1 = OnTimeout, 2 = Manual
ADD COLUMN IF NOT EXISTS "TimeoutMinutes" INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN "Stages"."StageType" IS '0 = Process (transitions on completion), 1 = Escalation (transitions on timeout)';
COMMENT ON COLUMN "Stages"."TransitionPolicy" IS '0 = OnComplete, 1 = OnTimeout, 2 = Manual';
COMMENT ON COLUMN "Stages"."TimeoutMinutes" IS 'Timeout in minutes for escalation stages (required if TransitionPolicy is OnTimeout)';

-- Create index for efficient queries on stage type
CREATE INDEX IF NOT EXISTS "IX_Stages_StageType" ON "Stages" ("StageType");
CREATE INDEX IF NOT EXISTS "IX_Stages_TransitionPolicy" ON "Stages" ("TransitionPolicy");

