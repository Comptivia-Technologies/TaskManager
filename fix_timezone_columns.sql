-- Fix timezone columns in SLAAssignments table
-- Run this script: psql -h localhost -U postgres -d WorkflowManagement -f fix_timezone_columns.sql

-- Convert TIMESTAMP columns to TIMESTAMP WITH TIME ZONE
-- Using AT TIME ZONE 'UTC' to preserve the existing values as UTC

ALTER TABLE "SLAAssignments" 
    ALTER COLUMN "SLAStartTime" TYPE TIMESTAMP WITH TIME ZONE 
    USING "SLAStartTime" AT TIME ZONE 'UTC';

ALTER TABLE "SLAAssignments" 
    ALTER COLUMN "SLADeadline" TYPE TIMESTAMP WITH TIME ZONE 
    USING "SLADeadline" AT TIME ZONE 'UTC';

ALTER TABLE "SLAAssignments" 
    ALTER COLUMN "CreatedAt" TYPE TIMESTAMP WITH TIME ZONE 
    USING "CreatedAt" AT TIME ZONE 'UTC';

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'SLAAssignments' 
AND column_name IN ('SLAStartTime', 'SLADeadline', 'CreatedAt');

