-- Migration: Create PriorityRules table
-- Database: PriorityRuleEngine

CREATE TABLE IF NOT EXISTS "PriorityRules" (
    "RuleId" SERIAL PRIMARY KEY,
    "RuleName" VARCHAR(200) NOT NULL,
    "Priority" VARCHAR(50) NOT NULL,
    "Salience" INTEGER NOT NULL DEFAULT 0,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "ConditionsJson" TEXT NOT NULL,
    "MaxWorkloadScore" INTEGER,
    "TeamName" VARCHAR(200),
    "CreatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "UpdatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient rule queries
CREATE INDEX IF NOT EXISTS "IX_PriorityRules_IsActive_Salience" 
    ON "PriorityRules" ("IsActive", "Salience" DESC);

-- Create index for team-based queries
CREATE INDEX IF NOT EXISTS "IX_PriorityRules_TeamName" 
    ON "PriorityRules" ("TeamName") 
    WHERE "TeamName" IS NOT NULL;

