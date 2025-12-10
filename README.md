# Workflow Management Application

A full-stack workflow management application built with React TypeScript frontend, .NET 8 Web API backend, and PostgreSQL database.

## Features

- **Teams Management**: Create, read, update, and delete teams
- **Members Management**: Manage team members with role assignments
- **Workflow Creation**: Multi-step workflow creation process
- **Kanban Board**: Visual workflow management with drag-and-drop task movement
- **Task Management**: Create, assign, and track tasks across workflow stages

## Architecture

### Backend (.NET 8 Web API)
- **Repository Pattern**: Generic and specific repositories for data access
- **Service Layer**: Business logic and validation
- **Entity Framework Core**: PostgreSQL database access
- **AutoMapper**: DTO mapping
- **RESTful API**: Full CRUD operations for all entities

### Frontend (React TypeScript)
- **React 18+**: Modern React with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **@dnd-kit**: Drag-and-drop functionality for Kanban board
- **Axios**: HTTP client for API calls
- **React Hook Form**: Form validation
- **React Toastify**: Toast notifications

## Prerequisites

- .NET 8 SDK
- Node.js 16+ and npm
- PostgreSQL 12+
- Visual Studio 2022 or VS Code (for backend)
- Code editor (for frontend)

## Database Setup

1. Install PostgreSQL if not already installed
2. Create a new database:
   ```sql
   CREATE DATABASE WorkflowManagement;
   ```
3. Update the connection string in `backend/WorkflowManagement.API/appsettings.json`:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5432;Database=WorkflowManagement;Username=your_username;Password=your_password"
     }
   }
   ```

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend/WorkflowManagement.API
   ```

2. Restore NuGet packages:
   ```bash
   dotnet restore
   ```

3. The database will be created automatically when you run the application (using `EnsureCreated()`). For production, use migrations:
   ```bash
   dotnet ef migrations add InitialCreate
   dotnet ef database update
   ```

4. Run the application:
   ```bash
   dotnet run
   ```

   The API will be available at `https://localhost:5001` or `http://localhost:5000`

5. Swagger documentation is available at `https://localhost:5001/swagger` (in development mode)

## Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

   The application will open at `http://localhost:3000`

## API Endpoints

### Teams
- `GET /api/teams` - Get all teams
- `GET /api/teams/{id}` - Get team by ID
- `POST /api/teams` - Create team
- `PUT /api/teams/{id}` - Update team
- `DELETE /api/teams/{id}` - Delete team
- `GET /api/teams/{id}/members` - Get team members
- `GET /api/teams/{id}/workflows` - Get team workflows

### Members
- `GET /api/members` - Get all members
- `GET /api/members/{id}` - Get member by ID
- `POST /api/members` - Create member
- `PUT /api/members/{id}` - Update member
- `DELETE /api/members/{id}` - Delete member
- `GET /api/members/{id}/tasks` - Get member tasks

### Workflows
- `GET /api/workflows` - Get all workflows
- `GET /api/workflows/{id}` - Get workflow by ID
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/{id}` - Update workflow
- `DELETE /api/workflows/{id}` - Delete workflow
- `GET /api/workflows/{id}/stages` - Get workflow stages
- `GET /api/workflows/{id}/tasks` - Get workflow tasks

### Stages
- `GET /api/stages` - Get all stages
- `GET /api/stages/{id}` - Get stage by ID
- `POST /api/stages` - Create stage
- `PUT /api/stages/{id}` - Update stage
- `DELETE /api/stages/{id}` - Delete stage
- `GET /api/stages/workflow/{workflowId}` - Get stages by workflow

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/{id}` - Get task by ID
- `POST /api/tasks` - Create task
- `PUT /api/tasks/{id}` - Update task
- `DELETE /api/tasks/{id}` - Delete task
- `GET /api/tasks/workflow/{workflowId}` - Get tasks by workflow
- `GET /api/tasks/stage/{stageId}` - Get tasks by stage
- `GET /api/tasks/member/{memberId}` - Get tasks by member

## Workflow Creation Process

The workflow creation follows a 5-step process:

1. **Workflow Name**: Enter the workflow name
2. **Description**: Add an optional description
3. **Add Stages**: Create workflow stages with names and order
4. **Select Team**: Choose the team for the workflow
5. **Add Tasks**: Create tasks with assignments to stages and members

After creation, the workflow is displayed in a Kanban board where tasks can be dragged between stages.

## Database Schema

### Teams
- TeamId (PK)
- TeamName
- Description
- CreatedAt
- UpdatedAt

### Members
- MemberId (PK)
- FirstName
- LastName
- Email
- TeamId (FK)
- Role
- CreatedAt
- UpdatedAt

### Workflows
- WorkflowId (PK)
- WorkflowName
- Description
- TeamId (FK)
- CreatedAt
- UpdatedAt

### Stages
- StageId (PK)
- StageName
- StageOrder
- WorkflowId (FK)
- CreatedAt

### Tasks
- TaskId (PK)
- TaskName
- Description
- Status
- Priority
- DueDate
- WorkflowId (FK)
- StageId (FK, nullable)
- AssignedToMemberId (FK, nullable)
- CreatedAt
- UpdatedAt

## CORS Configuration

The backend is configured to allow requests from `http://localhost:3000` (React app). Update the CORS policy in `Program.cs` if you need to change the allowed origins.

## Error Handling

- Global exception handling middleware in the backend
- Toast notifications for user feedback in the frontend
- Proper HTTP status codes (200, 201, 204, 400, 404, 500)

## Testing the Application

1. Start the backend API
2. Start the frontend application
3. Create a team
4. Add members to the team
5. Create a workflow with stages and tasks
6. View the workflow in the Kanban board
7. Drag tasks between stages

## Production Considerations

- Use Entity Framework migrations instead of `EnsureCreated()`
- Configure proper CORS for production domains
- Add authentication and authorization
- Implement proper error logging
- Add input validation and sanitization
- Configure HTTPS
- Set up environment-specific configuration files

## License

This project is provided as-is for educational and development purposes.



