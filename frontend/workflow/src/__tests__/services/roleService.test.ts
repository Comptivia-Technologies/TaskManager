import { roleService } from '../../services/roleService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('roleService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('getByOrganization maps response to Role[]', async () => {
    const raw = [{ roleId: '1', name: 'Admin', organizationId: 'o1', permissionCodes: ['read'] }];
    mockedApi.get.mockResolvedValue({ data: raw });
    const result = await roleService.getByOrganization('o1');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/roles/organization/o1');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ roleId: '1', name: 'Admin', permissions: ['read'] });
  });

  it('getByOrganization maps null description to undefined', async () => {
    const raw = [{ roleId: '1', name: 'R1', organizationId: 'o1', permissionCodes: [], description: null }];
    mockedApi.get.mockResolvedValue({ data: raw });
    const result = await roleService.getByOrganization('o1');
    expect(result[0].description).toBeUndefined();
  });

  it('getByOrganization handles missing data and missing permissions', async () => {
    mockedApi.get.mockResolvedValue({ data: undefined as any });
    const empty = await roleService.getByOrganization('o1');
    expect(empty).toEqual([]);

    mockedApi.get.mockResolvedValue({ data: [{ roleId: '1', name: 'R1', organizationId: 'o1', permissionCodes: undefined as any }] });
    const out = await roleService.getByOrganization('o1');
    expect(out[0].permissions).toEqual([]);
  });

  it('create sends organizationId and permissionCodes', async () => {
    mockedApi.post.mockResolvedValue({ data: { roleId: '1', name: 'R1', organizationId: 'o1', permissionCodes: [] } });
    await roleService.create('o1', { name: 'R1' });
    expect(mockedApi.post).toHaveBeenCalledWith('/api/roles', { name: 'R1', description: null, organizationId: 'o1', permissionCodes: [] });
  });

  it('update and delete call correct endpoints', async () => {
    mockedApi.put.mockResolvedValue({ data: { roleId: '1', name: 'R1', permissionCodes: [] } });
    mockedApi.delete.mockResolvedValue(undefined);
    await roleService.update('1', { name: 'R2' });
    expect(mockedApi.put).toHaveBeenCalledWith('/api/roles/1', expect.any(Object));
    await roleService.delete('1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/roles/1');
  });
});
