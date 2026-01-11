-- Create SLAAssignments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'SLAAssignments'
    ) THEN
        CREATE TABLE "SLAAssignments" (
            "SLAAssignmentId" UUID PRIMARY KEY,
            "TaskId" UUID NOT NULL,
            "WorkflowId" INTEGER NOT NULL,
            "Priority" VARCHAR(50) NOT NULL,
            "ResponseTimeMinutes" INTEGER NOT NULL,
            "SLAStartTime" TIMESTAMP NOT NULL,
            "SLADeadline" TIMESTAMP NOT NULL,
            "IsOverdue" BOOLEAN NOT NULL DEFAULT FALSE,
            "CreatedAt" TIMESTAMP NOT NULL,
            "WorkflowSelectedEventId" UUID
        );

        -- Create indexes
        CREATE UNIQUE INDEX "IX_SLAAssignments_TaskId" ON "SLAAssignments" ("TaskId");
        CREATE INDEX "IX_SLAAssignments_WorkflowId" ON "SLAAssignments" ("WorkflowId");
        CREATE INDEX "IX_SLAAssignments_SLADeadline" ON "SLAAssignments" ("SLADeadline");
        CREATE INDEX "IX_SLAAssignments_IsOverdue" ON "SLAAssignments" ("IsOverdue");

        RAISE NOTICE 'SLAAssignments table created successfully.';
    ELSE
        RAISE NOTICE 'SLAAssignments table already exists.';
    END IF;
END $$;
