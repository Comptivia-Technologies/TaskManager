import { userService } from '../../services/userService';
import api from '../../services/api';

jest.mock('../../services/api');

const mockedApi = api as jest.Mocked<typeof api>;

describe('userService', () => {
  const origProductId = process.env.REACT_APP_PRODUCT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_PRODUCT_ID = 'product-1';
  });

  afterAll(() => {
    process.env.REACT_APP_PRODUCT_ID = origProductId;
  });

  it('getActiveOrganizationUsers returns [] when REACT_APP_PRODUCT_ID is missing', async () => {
    process.env.REACT_APP_PRODUCT_ID = '';
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result).toEqual([]);
  });

  it('getActiveOrganizationUsers maps response users', async () => {
    const apiUsers = [{ user_id: 'u1', full_name: 'U1', email: 'u@b.com', organization_id: 'o1', status: 'active', created_at: '', updated_at: '' }];
    mockedApi.get.mockResolvedValue({ data: { data: { users: apiUsers } } });
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
    expect(result[0].fullName).toBe('U1');
  });

  it('getPendingInvitations maps invitations list', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { invitations: [{ user_id: 'u2', full_name: 'U2', email: 'u2@b.com', organization_id: 'o1' }] } } });
    const result = await userService.getPendingInvitations('o1');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Pending');
  });

  it('getByOrganization Active calls API with status=active', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { users: [] } } });
    await userService.getByOrganization('o1', 'Active');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/auth/users/organization/o1?status=active');
  });

  it('updateOrganizationUser throws when product id missing', async () => {
    process.env.REACT_APP_PRODUCT_ID = '';
    await expect(
      userService.updateOrganizationUser('u1', { full_name: 'A', email: 'a@b.com', role_id: 'r', role_name: 'R' })
    ).rejects.toThrow('REACT_APP_PRODUCT_ID is not configured');
  });

  it('getByOrganization with Archived returns []', async () => {
    const result = await userService.getByOrganization('o1', 'Archived');
    expect(result).toEqual([]);
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('deleteUser and updateUserStatus call correct endpoints', async () => {
    mockedApi.delete.mockResolvedValue(undefined);
    mockedApi.patch.mockResolvedValue({ data: {} });
    await userService.deleteUser('u1');
    expect(mockedApi.delete).toHaveBeenCalledWith('/api/auth/users/u1');
    await userService.updateUserStatus('u1', 'active');
    expect(mockedApi.patch).toHaveBeenCalledWith('/api/auth/users/u1/status', { status: 'active' });
  });

  it('getActiveOrganizationUsers passes organization_id', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { users: [] } } });
    await userService.getActiveOrganizationUsers('o1');
    expect(mockedApi.get).toHaveBeenCalledWith(
      expect.stringMatching(/organization_id=o1/)
    );
  });

  it('getActiveOrganizationUsers reads users from body.data array shape', async () => {
    const apiUsers = [{ id: 'i1', full_name: 'N', email: 'e@b.com', organization_id: 'o1', status: 'pending' }];
    mockedApi.get.mockResolvedValue({ data: { data: apiUsers } });
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result[0].userId).toBe('i1');
    expect(result[0].status).toBe('Pending');
  });

  it('getActiveOrganizationUsers reads users from body.users', async () => {
    mockedApi.get.mockResolvedValue({
      data: { users: [{ user_id: 'u9', full_name: 'U9', email: 'u9@b.com', organization_id: 'o1', status: 'archived' }] },
    });
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result[0].userId).toBe('u9');
    expect(result[0].status).toBe('Archived');
  });

  it('getByOrganization Pending uses pending status', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: { users: [] } } });
    await userService.getByOrganization('o1', 'Pending');
    expect(mockedApi.get).toHaveBeenCalledWith('/api/auth/users/organization/o1?status=pending');
  });

  it('createOrganizationUser posts payload', async () => {
    mockedApi.post.mockResolvedValue({ data: { ok: true } });
    const payload = {
      organization_id: 'o1',
      email: 'e@b.com',
      full_name: 'E',
      user_type: 'standard',
      role: 'r',
      products_data: [{ product_id: 'p', role_id: 'rid', role_name: 'rn' }],
    };
    const out = await userService.createOrganizationUser(payload);
    expect(mockedApi.post).toHaveBeenCalledWith('/api/auth/organizationuser/create', payload);
    expect(out).toEqual({ ok: true });
  });

  it('updateOrganizationUser puts with product_id query', async () => {
    mockedApi.put.mockResolvedValue({ data: { updated: true } });
    const payload = { full_name: 'A', email: 'a@b.com', role_id: 'r1', role_name: 'R1' };
    const out = await userService.updateOrganizationUser('uid-1', payload);
    expect(mockedApi.put).toHaveBeenCalledWith(
      expect.stringMatching(/product_id=product-1/),
      payload
    );
    expect(out).toEqual({ updated: true });
  });

  it('maps unknown user status to Active', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          users: [{ user_id: 'ux', full_name: 'X', email: 'x@b.com', organization_id: 'o1', status: 'weird' }],
        },
      },
    });
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result[0].status).toBe('Active');
  });

  it('maps api user using id and username fallbacks', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          users: [
            {
              id: 'id1',
              username: 'un1',
              email: 'e@b.com',
              organization_id: 'o1',
              status: 'ACTIVE',
              created_at: 'c1',
              updated_at: 'u1',
            },
          ],
        },
      },
    });
    const result = await userService.getActiveOrganizationUsers('o1');
    expect(result[0].userId).toBe('id1');
    expect(result[0].fullName).toBe('un1');
    expect(result[0].status).toBe('Active');
  });

  it('maps invitation with id fallback and minimal fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: { invitations: [{ id: 'inv1', email: 'i@b.com', organization_id: 'o1' }] } },
    });
    const result = await userService.getPendingInvitations('o1');
    expect(result[0].userId).toBe('inv1');
    expect(result[0].fullName).toBe('');
  });
});
