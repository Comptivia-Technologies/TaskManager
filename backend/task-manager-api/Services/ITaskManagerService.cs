using TaskManager.API.DTOs;

namespace TaskManager.API.Services;

public interface ITaskManagerService
{
    Task<IEnumerable<TaskManagerTaskReadDto>> GetAllTasksAsync();
    Task<TaskManagerTaskReadDto?> GetTaskByIdAsync(int id);
    Task<TaskManagerTaskReadDto> CreateTaskAsync(TaskManagerTaskCreateDto createDto);
}


