import { workflowService } from '../../services/workflowService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('workflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAll calls api.get', async () => {
    const data = [{ workflowId: '1', workflowName: 'W1', createdAt: '', updatedAt: '', stages: [], tasks: [] }];
    mockedApi.get.mockResolvedValue({ data });
    const result = await workflowService.getAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workflows');
    expect(result).toEqual(data);
  });

  it('getById calls api.get with id', async () => {
    const workflow = { workflowId: '1', workflowName: 'W1', createdAt: '', updatedAt: '', stages: [], tasks: [] };
    mockedApi.get.mockResolvedValue({ data: workflow });
    const result = await workflowService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workflows/1');
    expect(result).toEqual(workflow);
  });

  it('create calls api.post', async () => {
    const create = { workflowName: 'W1' };
    mockedApi.post.mockResolvedValue({ data: { workflowId: '1', ...create, createdAt: '', updatedAt: '', stages: [], tasks: [] } });
    await workflowService.create(create);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/workflows', create);
  });

  it('update and delete call correct endpoints', async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue(undefined);
    await workflowService.update('1', { workflowName: 'W2' });
    expect(mockedApi.put).toHaveBeenCalledWith('/api/workflows/1', { workflowName: 'W2' });
    await workflowService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/workflows/1');
  });

  it('getStages, getTasks, getJson, updateJson call correct endpoints', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    mockedApi.post.mockResolvedValue(undefined);
    await workflowService.getStages('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workflows/1/stages');
    await workflowService.getTasks('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workflows/1/tasks');
    await workflowService.getJson('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/workflows/1/json');
    await workflowService.updateJson('1');
    expect(mockedApi.post).toHaveBeenCalledWith('/api/workflows/1/update-json');
  });
});
