-- Create SLAConfigurations table
CREATE TABLE IF NOT EXISTS "SLAConfigurations" (
    "SLAConfigurationId" SERIAL PRIMARY KEY,
    "WorkflowId" INTEGER NOT NULL,
    "PriorityLevelsJson" JSONB NOT NULL DEFAULT '{}',
    "CreatedAt" TIMESTAMP NOT NULL,
    "UpdatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "UQ_SLAConfigurations_WorkflowId" UNIQUE ("WorkflowId")
);

-- Create index on WorkflowId for faster lookups
CREATE INDEX IF NOT EXISTS "IX_SLAConfigurations_WorkflowId" ON "SLAConfigurations" ("WorkflowId");

-- Add comment to table
COMMENT ON TABLE "SLAConfigurations" IS 'Stores SLA configuration for workflows with priority level response times';

