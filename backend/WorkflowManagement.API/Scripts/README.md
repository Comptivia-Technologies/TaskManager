# Database Migration Scripts

This folder contains scripts and tools for database migrations and maintenance.

## Quick Fix: Run Migration Tool

The easiest way to run the migration is using the .NET migration tool:

### Option 1: Using .NET Migration Tool (Recommended)

1. Navigate to the Scripts folder:
   ```powershell
   cd backend/WorkflowManagement.API/Scripts
   ```

2. Build and run the migration tool:
   ```powershell
   dotnet run --project MigrationTool.csproj
   ```

   Or with custom connection string:
   ```powershell
   dotnet run --project MigrationTool.csproj -- "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=YOUR_PASSWORD"
   ```

### Option 2: Using PowerShell Script (if psql is in PATH)

```powershell
cd backend/WorkflowManagement.API
.\Scripts\RunMigration.ps1
```

### Option 3: Using SQL Script Directly (if psql is available)

Find your PostgreSQL installation and use the full path:
```powershell
# Typical PostgreSQL installation paths:
# "C:\Program Files\PostgreSQL\15\bin\psql.exe"
# "C:\Program Files\PostgreSQL\14\bin\psql.exe"

& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -U postgres -d WorkflowManagement -f Scripts/MigrateStagesTeamId.sql
```

### Option 4: Using pgAdmin or Another SQL Client

1. Open pgAdmin or your preferred PostgreSQL client
2. Connect to your database
3. Open and run `Scripts/MigrateStagesTeamId.sql`

## Available Scripts

### 1. `MigrationTool.cs` / `MigrationTool.csproj`
**Purpose**: .NET console application to run the migration

**Usage**:
```powershell
cd Scripts
dotnet run --project MigrationTool.csproj
```

### 2. `MigrateStagesTeamId.sql`
**Purpose**: SQL script to add TeamId column to Stages table

**What it does**:
- Checks if TeamId column already exists
- Creates a default team if none exists
- Adds TeamId column to Stages table
- Sets default values for existing stages
- Adds foreign key constraint

### 3. `CheckDatabaseStructure.sql`
**Purpose**: Check the current structure of database tables

**Usage**: Run in any PostgreSQL client to see table structures

### 4. `ResetDatabase.sql`
**Purpose**: Completely reset the database (WARNING: Deletes all data!)

**When to use**: Development only, when you want a fresh start

## Connection String

Default connection string used by the migration tool:
```
Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=test1234
```

To use a different connection string, pass it as an argument:
```powershell
dotnet run --project MigrationTool.csproj -- "Host=localhost;Port=5432;Database=WorkflowManagement;Username=postgres;Password=YOUR_PASSWORD"
```

## Troubleshooting

### "psql is not recognized"
- Use the .NET migration tool instead (Option 1)
- Or find your PostgreSQL installation path and use the full path to psql.exe

### "Connection refused" or "Password authentication failed"
- Check your PostgreSQL is running
- Verify username and password in the connection string
- Update the connection string in `MigrationTool.cs` or pass it as an argument

### "Column already exists"
- The migration has already been run - no action needed

### "Table does not exist"
- Run the API first to create tables, then run the migration
- Or use `ResetDatabase.sql` to start fresh
