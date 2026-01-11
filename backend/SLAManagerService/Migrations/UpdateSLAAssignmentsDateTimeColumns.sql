-- Update SLAAssignments table to use timestamp with time zone
-- This ensures UTC times are stored and retrieved correctly
-- Run this migration to fix timezone issues with SLA deadlines

-- Note: If existing data was stored in IST, this migration will interpret it as IST
-- You may need to adjust existing data if it was stored incorrectly

ALTER TABLE "SLAAssignments" 
ALTER COLUMN "SLAStartTime" TYPE TIMESTAMP WITH TIME ZONE USING "SLAStartTime" AT TIME ZONE 'UTC',
ALTER COLUMN "SLADeadline" TYPE TIMESTAMP WITH TIME ZONE USING "SLADeadline" AT TIME ZONE 'UTC',
ALTER COLUMN "CreatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "CreatedAt" AT TIME ZONE 'UTC';

-- If the above fails because data was stored in IST, use this instead:
-- ALTER TABLE "SLAAssignments" 
-- ALTER COLUMN "SLAStartTime" TYPE TIMESTAMP WITH TIME ZONE USING "SLAStartTime" AT TIME ZONE 'Asia/Kolkata',
-- ALTER COLUMN "SLADeadline" TYPE TIMESTAMP WITH TIME ZONE USING "SLADeadline" AT TIME ZONE 'Asia/Kolkata',
-- ALTER COLUMN "CreatedAt" TYPE TIMESTAMP WITH TIME ZONE USING "CreatedAt" AT TIME ZONE 'Asia/Kolkata';

