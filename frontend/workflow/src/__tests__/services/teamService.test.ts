import { teamService } from '../../services/teamService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('teamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAll calls api.get', async () => {
    const data = [{ teamId: '1', teamName: 'T1', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });
    const result = await teamService.getAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/api/teams');
    expect(result).toEqual(data);
  });

  it('getById calls api.get with id', async () => {
    const team = { teamId: '1', teamName: 'T1', createdAt: '', updatedAt: '' };
    mockedApi.get.mockResolvedValue({ data: team });
    const result = await teamService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/teams/1');
    expect(result).toEqual(team);
  });

  it('create calls api.post', async () => {
    const create = { teamName: 'T1' };
    mockedApi.post.mockResolvedValue({ data: { teamId: '1', ...create, createdAt: '', updatedAt: '' } });
    await teamService.create(create);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/teams', create);
  });

  it('update calls api.put', async () => {
    const update = { teamName: 'T2' };
    mockedApi.put.mockResolvedValue({ data: {} });
    await teamService.update('1', update);
    expect(mockedApi.put).toHaveBeenCalledWith('/api/teams/1', update);
  });

  it('delete calls api.delete', async () => {
    mockedApi.delete.mockResolvedValue(undefined);
    await teamService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/teams/1');
  });

  it('getMembers and getWorkflows call correct endpoints', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await teamService.getMembers('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/teams/1/members');
    await teamService.getWorkflows('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/teams/1/workflows');
  });
});
