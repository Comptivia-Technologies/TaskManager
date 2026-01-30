-- Make TeamId nullable in Members table
ALTER TABLE "Members" 
ALTER COLUMN "TeamId" DROP NOT NULL;

