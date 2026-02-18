using Microsoft.EntityFrameworkCore;
using Workload.API.Data;

namespace Workload.API.Repositories;

public class Repository<T> : IRepository<T> where T : class
{
    protected readonly WorkloadDbContext _context;
    protected readonly DbSet<T> _dbSet;

    public Repository(WorkloadDbContext context)
    {
        _context = context;
        _dbSet = context.Set<T>();
    }

    public virtual async System.Threading.Tasks.Task<IEnumerable<T>> GetAllAsync()
    {
        return await _dbSet.ToListAsync();
    }

    public virtual async System.Threading.Tasks.Task<T?> GetByIdAsync(Guid id)
    {
        return await _dbSet.FindAsync(id);
    }

    public virtual async System.Threading.Tasks.Task<T> AddAsync(T entity)
    {
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public virtual async System.Threading.Tasks.Task<T> UpdateAsync(T entity)
    {
        _dbSet.Update(entity);
        await _context.SaveChangesAsync();
        return entity;
    }

    public virtual async System.Threading.Tasks.Task<bool> DeleteAsync(Guid id)
    {
        var entity = await GetByIdAsync(id);
        if (entity == null)
            return false;

        _dbSet.Remove(entity);
        await _context.SaveChangesAsync();
        return true;
    }
}

