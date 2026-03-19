import { permissionService } from '../../services/permissionService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('permissionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getAll returns PermissionRead[]', async () => {
    const data = [{ permissionId: '1', code: 'read', name: 'Read' }];
    mockedApi.get.mockResolvedValue({ data });
    const result = await permissionService.getAll();
    expect(mockedApi.get).toHaveBeenCalledWith('/api/permissions');
    expect(result).toEqual(data);
  });
});
