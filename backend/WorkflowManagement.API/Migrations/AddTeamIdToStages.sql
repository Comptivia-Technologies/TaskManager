-- Migration script to add TeamId column to Stages table
-- Run this manually if you want to preserve existing data

ALTER TABLE "Stages" ADD COLUMN "TeamId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Stages" ADD CONSTRAINT "FK_Stages_Teams_TeamId" FOREIGN KEY ("TeamId") REFERENCES "Teams" ("TeamId") ON DELETE RESTRICT;

-- Update existing stages to use the first team (or a specific team)
-- UPDATE "Stages" SET "TeamId" = (SELECT "TeamId" FROM "Teams" LIMIT 1);



