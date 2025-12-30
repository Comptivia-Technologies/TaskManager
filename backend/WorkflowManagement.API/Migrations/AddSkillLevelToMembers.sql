-- Migration: Add SkillLevel column to Members table
-- Date: 2025-12-29
-- Description: Adds SkillLevel field (1-5) to Members table for workload calculations
-- Database: PostgreSQL

-- Step 1: Check if column already exists, if not add it as nullable first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Members' 
        AND column_name = 'SkillLevel'
    ) THEN
        ALTER TABLE "Members" ADD COLUMN "SkillLevel" INTEGER;
        RAISE NOTICE 'SkillLevel column added to Members table';
    ELSE
        RAISE NOTICE 'SkillLevel column already exists';
    END IF;
END $$;

-- Step 2: Set default value (3) for any existing NULL records
UPDATE "Members"
SET "SkillLevel" = 3
WHERE "SkillLevel" IS NULL;

-- Step 3: Make the column NOT NULL
DO $$
BEGIN
    -- Check if column is currently nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'Members' 
        AND column_name = 'SkillLevel'
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "Members" ALTER COLUMN "SkillLevel" SET NOT NULL;
        RAISE NOTICE 'SkillLevel column set to NOT NULL';
    ELSE
        RAISE NOTICE 'SkillLevel column is already NOT NULL';
    END IF;
END $$;

-- Step 4: Add check constraint to ensure skill level is between 1 and 5
DO $$
BEGIN
    -- Drop constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'CK_Members_SkillLevel_Range'
    ) THEN
        ALTER TABLE "Members" DROP CONSTRAINT "CK_Members_SkillLevel_Range";
        RAISE NOTICE 'Existing constraint dropped';
    END IF;
    
    -- Add the constraint
    ALTER TABLE "Members"
    ADD CONSTRAINT "CK_Members_SkillLevel_Range" 
    CHECK ("SkillLevel" >= 1 AND "SkillLevel" <= 5);
    
    RAISE NOTICE 'Check constraint added: SkillLevel must be between 1 and 5';
END $$;

-- Step 5: Create index for better query performance
CREATE INDEX IF NOT EXISTS "IX_Members_SkillLevel" 
ON "Members" ("SkillLevel");

-- Verification query (uncomment to run)
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
-- AND table_name = 'Members' 
-- AND column_name = 'SkillLevel';
