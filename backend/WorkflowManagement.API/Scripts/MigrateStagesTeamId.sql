-- Migration Script: Add TeamId column to Stages table
-- Run this script manually in PostgreSQL to update the database schema
-- Usage: psql -U postgres -d WorkflowManagement -f MigrateStagesTeamId.sql

-- Step 1: Check if column already exists (optional - will fail gracefully if it does)
DO $$ 
BEGIN
    -- Check if TeamId column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'Stages' 
        AND column_name = 'TeamId'
    ) THEN
        -- Step 2: Ensure Teams table exists and has at least one team
        -- If no teams exist, create a default team
        IF NOT EXISTS (SELECT 1 FROM "Teams" LIMIT 1) THEN
            INSERT INTO "Teams" ("TeamName", "Description", "CreatedAt", "UpdatedAt") 
            VALUES ('Default Team', 'Default team for stages', NOW(), NOW());
        END IF;

        -- Step 3: Add TeamId column (nullable first to handle existing data)
        ALTER TABLE "Stages" 
        ADD COLUMN "TeamId" UUID;

        -- Step 4: Set default value for existing stages (if any)
        UPDATE "Stages" 
        SET "TeamId" = (SELECT "TeamId" FROM "Teams" LIMIT 1) 
        WHERE "TeamId" IS NULL;

        -- Step 5: Make column NOT NULL
        ALTER TABLE "Stages" 
        ALTER COLUMN "TeamId" SET NOT NULL;

        -- Step 6: Add default value constraint
        ALTER TABLE "Stages" 
        ALTER COLUMN "TeamId" SET DEFAULT (SELECT "TeamId" FROM "Teams" LIMIT 1);

        -- Step 7: Add foreign key constraint
        ALTER TABLE "Stages" 
        ADD CONSTRAINT "FK_Stages_Teams_TeamId" 
        FOREIGN KEY ("TeamId") REFERENCES "Teams" ("TeamId") ON DELETE RESTRICT;

        RAISE NOTICE 'TeamId column added successfully to Stages table.';
    ELSE
        RAISE NOTICE 'TeamId column already exists in Stages table.';
    END IF;
END $$;



