-- Migration: Add WorkflowId column to PriorityRules table
-- Database: PriorityRuleEngine

-- Add WorkflowId column (nullable - NULL = global rule, specific ID = workflow-specific rule)
ALTER TABLE "PriorityRules" 
ADD COLUMN IF NOT EXISTS "WorkflowId" INTEGER;

-- Create index for efficient workflow-based rule queries
CREATE INDEX IF NOT EXISTS "IX_PriorityRules_WorkflowId_IsActive" 
    ON "PriorityRules" ("WorkflowId", "IsActive") 
    WHERE "WorkflowId" IS NOT NULL;

-- Create index for global rules (where WorkflowId IS NULL)
CREATE INDEX IF NOT EXISTS "IX_PriorityRules_GlobalRules" 
    ON "PriorityRules" ("IsActive", "Salience" DESC) 
    WHERE "WorkflowId" IS NULL;

