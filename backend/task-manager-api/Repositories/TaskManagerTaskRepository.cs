using TaskManager.API.Data;
using TaskManager.API.Models;

namespace TaskManager.API.Repositories;

public class TaskManagerTaskRepository : Repository<TaskManagerTask>, ITaskManagerTaskRepository
{
    public TaskManagerTaskRepository(TaskManagerDbContext context) : base(context)
    {
    }
}


