import { memberService } from '../../services/memberService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('memberService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAll calls api.get and returns data', async () => {
    const data = [{ memberId: '1', firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'Dev', skillLevel: 1, createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });

    const result = await memberService.getAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/api/members');
    expect(result).toEqual(data);
  });

  it('getById calls api.get with id', async () => {
    const member = { memberId: '1', firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'Dev', skillLevel: 1, createdAt: '', updatedAt: '' };
    mockedApi.get.mockResolvedValue({ data: member });

    const result = await memberService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/members/1');
    expect(result).toEqual(member);
  });

  it('create calls api.post', async () => {
    const create = { firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'Dev', skillLevel: 1 };
    const created = { ...create, memberId: '1', createdAt: '', updatedAt: '' };
    mockedApi.post.mockResolvedValue({ data: created });

    const result = await memberService.create(create);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/members', create);
    expect(result).toEqual(created);
  });

  it('update calls api.put', async () => {
    const update = { firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'Dev', skillLevel: 1 };
    mockedApi.put.mockResolvedValue({ data: { memberId: '1', ...update, createdAt: '', updatedAt: '' } });

    await memberService.update('1', update);
    expect(mockedApi.put).toHaveBeenCalledWith('/api/members/1', update);
  });

  it('delete calls api.delete', async () => {
    mockedApi.delete.mockResolvedValue(undefined);
    await memberService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/members/1');
  });

  it('getTasks calls api.get', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await memberService.getTasks('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/members/1/tasks');
  });
});
