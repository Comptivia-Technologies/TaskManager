import { stageService } from '../../services/stageService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('stageService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll returns data from api.get', async () => {
    const data = [{ stageId: '1', stageName: 'S1', stageOrder: 1, workflowId: 'w1', teamId: 't1', teamName: 'T1', stageType: 'Process', transitionPolicy: 'OnComplete', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });
    expect(await stageService.getAll()).toEqual(data);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/stages');
  });

  it('getById, create, update, delete call correct endpoints', async () => {
    const stage = { stageId: '1', stageName: 'S1', stageOrder: 1, workflowId: 'w1', teamId: 't1', teamName: 'T1', stageType: 'Process', transitionPolicy: 'OnComplete', createdAt: '', updatedAt: '' };
    mockedApi.get.mockResolvedValue({ data: stage });
    mockedApi.post.mockResolvedValue({ data: stage });
    mockedApi.put.mockResolvedValue({ data: stage });
    mockedApi.delete.mockResolvedValue(undefined);

    await stageService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/stages/1');
    await stageService.create({ stageName: 'S1', stageOrder: 1, workflowId: 'w1', teamId: 't1', stageType: 'Process', transitionPolicy: 'OnComplete' });
    expect(mockedApi.post).toHaveBeenCalledWith('/api/stages', expect.any(Object));
    await stageService.update('1', { stageName: 'S1', stageOrder: 1, teamId: 't1', stageType: 'Process', transitionPolicy: 'OnComplete' });
    expect(mockedApi.put).toHaveBeenCalledWith('/api/stages/1', expect.any(Object));
    await stageService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/stages/1');
  });

  it('getByWorkflow calls correct endpoint', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await stageService.getByWorkflow('w1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/stages/workflow/w1');
  });
});
