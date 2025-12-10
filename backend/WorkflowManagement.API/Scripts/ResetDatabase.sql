-- Script to completely reset the database (WARNING: This deletes all data!)
-- Use this only in development when you want a fresh start

-- Drop all tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS "Tasks" CASCADE;
DROP TABLE IF EXISTS "Stages" CASCADE;
DROP TABLE IF EXISTS "Workflows" CASCADE;
DROP TABLE IF EXISTS "Members" CASCADE;
DROP TABLE IF EXISTS "Teams" CASCADE;

-- The database will be recreated automatically by Entity Framework's EnsureCreated()
-- when you restart the application



