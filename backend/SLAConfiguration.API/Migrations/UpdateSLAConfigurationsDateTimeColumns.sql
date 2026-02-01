-- Update SLAConfigurations table to use timestamp with time zone
-- Run this if the table was created with timestamp without time zone

ALTER TABLE "SLAConfigurations" 
ALTER COLUMN "CreatedAt" TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN "UpdatedAt" TYPE TIMESTAMP WITH TIME ZONE;

