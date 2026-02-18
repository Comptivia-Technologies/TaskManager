namespace Workload.API.Repositories;

public interface IRepository<T> where T : class
{
    System.Threading.Tasks.Task<IEnumerable<T>> GetAllAsync();
    System.Threading.Tasks.Task<T?> GetByIdAsync(Guid id);
    System.Threading.Tasks.Task<T> AddAsync(T entity);
    System.Threading.Tasks.Task<T> UpdateAsync(T entity);
    System.Threading.Tasks.Task<bool> DeleteAsync(Guid id);
}

