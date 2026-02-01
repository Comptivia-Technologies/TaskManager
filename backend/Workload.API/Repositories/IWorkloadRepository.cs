using Workload.API.Models;

namespace Workload.API.Repositories;

public interface IWorkloadRepository : IRepository<Models.Workload>
{
    System.Threading.Tasks.Task<Models.Workload?> GetLatestByMemberIdAsync(int memberId);
    System.Threading.Tasks.Task<IEnumerable<Models.Workload>> GetWorkloadHistoryByMemberIdAsync(int memberId, int days = 30);
}

