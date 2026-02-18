using Workload.API.Models;

namespace Workload.API.Repositories;

public interface IWorkloadRepository : IRepository<Models.Workload>
{
    System.Threading.Tasks.Task<Models.Workload?> GetLatestByMemberIdAsync(Guid memberId);
    System.Threading.Tasks.Task<IEnumerable<Models.Workload>> GetWorkloadHistoryByMemberIdAsync(Guid memberId, int days = 30);
}

