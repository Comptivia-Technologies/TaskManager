import { slaService } from '../../services/slaService';
import slaApi from '../../services/slaApi';

jest.mock('../../services/slaApi');

const mockedSlaApi = slaApi as jest.Mocked<typeof slaApi>;

describe('slaService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll returns data from slaApi', async () => {
    const data = [{ workflowId: 'w1', workflowName: 'W1', priorityLevels: {} }];
    mockedSlaApi.get.mockResolvedValue({ data });
    expect(await slaService.getAll()).toEqual(data);
    expect(mockedSlaApi.get).toHaveBeenCalledWith('/api/sla-configurations');
  });

  it('getByWorkflowId, create, update, delete call correct endpoints', async () => {
    const config = { workflowId: 'w1', workflowName: 'W1', priorityLevels: {} };
    mockedSlaApi.get.mockResolvedValue({ data: config });
    mockedSlaApi.post.mockResolvedValue({ data: config });
    mockedSlaApi.put.mockResolvedValue({ data: config });
    mockedSlaApi.delete.mockResolvedValue(undefined);

    await slaService.getByWorkflowId('w1');
    expect(mockedSlaApi.get).toHaveBeenCalledWith('/api/sla-configurations/workflow/w1');
    await slaService.create({ workflowId: 'w1', priorityLevels: {} });
    expect(mockedSlaApi.post).toHaveBeenCalledWith('/api/sla-configurations', expect.any(Object));
    await slaService.update('w1', { priorityLevels: {} });
    expect(mockedSlaApi.put).toHaveBeenCalledWith('/api/sla-configurations/workflow/w1', { priorityLevels: {} });
    await slaService.delete('w1');
    expect(mockedSlaApi.delete).toHaveBeenCalledWith('/api/sla-configurations/workflow/w1');
  });
});
