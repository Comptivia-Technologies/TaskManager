import { workloadService } from '../../services/workloadService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('workloadService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getByMemberId returns WorkloadResponse', async () => {
    const data = {
      memberId: 'm1',
      memberName: 'M1',
      memberEmail: 'm@b.com',
      workloadScore: 50,
      workloadStatus: 'Available' as const,
      metrics: {} as any,
      breakdown: {} as any,
      calculatedAt: new Date().toISOString(),
    };
    mockedApi.get.mockResolvedValue({ data });
    const result = await workloadService.getByMemberId('m1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workload/m1');
    expect(result).toEqual(data);
  });
});
