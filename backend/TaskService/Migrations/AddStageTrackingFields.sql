-- Migration: Add Stage Tracking Fields to Tasks Table
-- Database: TaskService
-- Description: Adds CurrentStageId, CurrentStageStartedAt, StageTimeoutAt, and event tracking fields

-- Add new columns to Tasks table
ALTER TABLE "Tasks" 
ADD COLUMN IF NOT EXISTS "CurrentStageId" INTEGER,
ADD COLUMN IF NOT EXISTS "CurrentStageStartedAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "StageTimeoutAt" TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS "TaskStageStartedEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskStageCompletedEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskStageEscalationTriggeredEventId" UUID,
ADD COLUMN IF NOT EXISTS "TaskCompletedEventId" UUID;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "IX_Tasks_CurrentStageId" ON "Tasks" ("CurrentStageId");
CREATE INDEX IF NOT EXISTS "IX_Tasks_StageTimeoutAt" ON "Tasks" ("StageTimeoutAt") WHERE "StageTimeoutAt" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Tasks_TaskStageStartedEventId" ON "Tasks" ("TaskStageStartedEventId") WHERE "TaskStageStartedEventId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Tasks_TaskStageCompletedEventId" ON "Tasks" ("TaskStageCompletedEventId") WHERE "TaskStageCompletedEventId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Tasks_TaskStageEscalationTriggeredEventId" ON "Tasks" ("TaskStageEscalationTriggeredEventId") WHERE "TaskStageEscalationTriggeredEventId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Tasks_TaskCompletedEventId" ON "Tasks" ("TaskCompletedEventId") WHERE "TaskCompletedEventId" IS NOT NULL;

