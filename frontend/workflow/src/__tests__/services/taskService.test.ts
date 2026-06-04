import { taskService } from '../../services/taskService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('taskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAll returns array when response is array', async () => {
    const data = [{ taskId: '1', taskName: 'T', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });
    const result = await taskService.getAll();
    expect(result).toEqual(data);
  });

  it('getAll returns data when response is PaginatedTasksResponse', async () => {
    const data = [{ taskId: '1', taskName: 'T', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data: { data, totalCount: 1, page: 1, limit: 10, totalPages: 1 } });
    const result = await taskService.getAll();
    expect(result).toEqual(data);
  });

  it('getAllPaginated returns paginated shape when response is object', async () => {
    const data = [{ taskId: '1', taskName: 'T', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data: { data, totalCount: 1, page: 1, limit: 10, totalPages: 1 } });
    const result = await taskService.getAllPaginated(undefined, 1, 10);
    expect(result.data).toEqual(data);
    expect(result.totalCount).toBe(1);
  });

  it('getAllPaginated normalizes array response', async () => {
    const data = [{ taskId: '1', taskName: 'T', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });
    const result = await taskService.getAllPaginated(undefined, 1, 10);
    expect(result.data).toEqual(data);
    expect(result.totalCount).toBe(1);
    expect(result.page).toBe(1);
  });

  it('getById calls api.get', async () => {
    const task = { taskId: '1', taskName: 'T', status: 'Open', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' };
    mockedApi.get.mockResolvedValue({ data: task });
    const result = await taskService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/1');
    expect(result).toEqual(task);
  });

  it('update and delete call correct endpoints', async () => {
    mockedApi.put.mockResolvedValue({ data: {} });
    mockedApi.delete.mockResolvedValue(undefined);
    await taskService.update('1', { taskName: 'T', status: 'Open', priority: 'High' });
    expect(mockedApi.put).toHaveBeenCalledWith('/api/tasks/1', expect.any(Object));
    await taskService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/tasks/1');
  });

  it('getMemberSummary calls api.get and normalizes arrays', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        assignedToMe: [],
        completedByMe: [{ taskId: '1', taskName: 'T', status: 'In Progress', priority: 'High', workflowId: 'w1', createdAt: '', updatedAt: '' }],
        escalatedByMe: [],
      },
    });
    const result = await taskService.getMemberSummary('m1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/member/summary/m1');
    expect(result.completedByMe).toHaveLength(1);
    expect(result.escalatedByMe).toEqual([]);
  });

  it('getAudit calls api.get with audit path', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await taskService.getAudit('task-1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/task-1/audit');
  });

  it('getByWorkflow, getByStage, getByMember call correct endpoints', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    await taskService.getByWorkflow('w1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/workflow/w1');
    await taskService.getByStage('s1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/stage/s1');
    await taskService.getByMember('m1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/tasks/member/m1');
  });

  it('getAll returns [] when response is object without data array', async () => {
    mockedApi.get.mockResolvedValue({ data: {} as any });
    const result = await taskService.getAll();
    expect(result).toEqual([]);
  });

  it('getAll returns [] when paginated data field is not an array', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: 'x' as any, totalCount: 0 } });
    const result = await taskService.getAll();
    expect(result).toEqual([]);
  });

  it('getAllPaginated adds priority param when non-empty', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], totalCount: 0, page: 1, limit: 10, totalPages: 0 },
    });
    await taskService.getAllPaginated(' High ', 2, 5);
    expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('priority=High'));
    expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('page=2'));
    expect(mockedApi.get).toHaveBeenCalledWith(expect.stringContaining('limit=5'));
  });

  it('getAllPaginated skips priority param when blank', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], totalCount: 0, page: 1, limit: 10, totalPages: 0 },
    });
    await taskService.getAllPaginated('   ', 1, 10);
    const url = (mockedApi.get.mock.calls[0] as string[])[0] as string;
    expect(url).not.toContain('priority=');
  });

  it('getAllPaginated normalizes object with missing data array', async () => {
    mockedApi.get.mockResolvedValue({ data: { totalCount: 3, page: 2, limit: 5, totalPages: 1 } as any });
    const result = await taskService.getAllPaginated();
    expect(result.data).toEqual([]);
    expect(result.totalCount).toBe(3);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(5);
    expect(result.totalPages).toBe(1);
  });

  it('getAllPaginated empty array yields totalPages 0', async () => {
    mockedApi.get.mockResolvedValue({ data: [] });
    const result = await taskService.getAllPaginated();
    expect(result.data).toEqual([]);
    expect(result.totalPages).toBe(0);
  });

  it('getAllPaginated coalesces missing pagination fields on object body', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: [] } as any });
    const result = await taskService.getAllPaginated();
    expect(result.totalCount).toBe(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(0);
  });
});
