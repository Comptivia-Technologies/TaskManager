import { priorityRulesService } from '../../services/priorityRulesService';
import priorityRulesApi from '../../services/priorityRulesApi';

jest.mock('../../services/priorityRulesApi');

const mockedApi = priorityRulesApi as jest.Mocked<typeof priorityRulesApi>;

describe('priorityRulesService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll calls api with activeOnly param', async () => {
    const data = [{ ruleId: '1', ruleName: 'R1', priority: 'High', salience: 1, isActive: true, conditionsJson: '{}', createdAt: '', updatedAt: '' }];
    mockedApi.get.mockResolvedValue({ data });
    await priorityRulesService.getAll(true);
    expect(mockedApi.get).toHaveBeenCalledWith('/api/priority-rules', { params: { activeOnly: true } });
    await priorityRulesService.getAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/api/priority-rules', { params: { activeOnly: false } });
  });

  it('getById, create, update, delete call correct endpoints', async () => {
    const rule = { ruleId: '1', ruleName: 'R1', priority: 'High', salience: 1, isActive: true, conditionsJson: '{}', createdAt: '', updatedAt: '' };
    mockedApi.get.mockResolvedValue({ data: rule });
    mockedApi.post.mockResolvedValue({ data: rule });
    mockedApi.put.mockResolvedValue({ data: rule });
    mockedApi.delete.mockResolvedValue(undefined);

    await priorityRulesService.getById('1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/priority-rules/1');
    await priorityRulesService.create({ ruleName: 'R1', priority: 'High', salience: 1, isActive: true, conditionsJson: '{}' });
    expect(mockedApi.post).toHaveBeenCalledWith('/api/priority-rules', expect.any(Object));
    await priorityRulesService.update('1', { ruleName: 'R1', priority: 'High', salience: 1, isActive: true, conditionsJson: '{}' });
    expect(mockedApi.put).toHaveBeenCalledWith('/api/priority-rules/1', expect.any(Object));
    await priorityRulesService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/priority-rules/1');
  });
});
