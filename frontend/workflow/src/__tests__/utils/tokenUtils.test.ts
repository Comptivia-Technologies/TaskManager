import { getOrganizationIdFromToken } from '../../utils/tokenUtils';

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

const jwtDecode = require('jwt-decode').jwtDecode;

describe('tokenUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns organizationId from decoded token', () => {
    (jwtDecode as jest.Mock).mockReturnValue({ organizationId: 'org-123' });
    expect(getOrganizationIdFromToken('token')).toBe('org-123');
  });

  it('returns null when organizationId is missing', () => {
    (jwtDecode as jest.Mock).mockReturnValue({});
    expect(getOrganizationIdFromToken('token')).toBeNull();
  });

  it('returns null when decode throws', () => {
    (jwtDecode as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid token');
    });
    expect(getOrganizationIdFromToken('bad')).toBeNull();
  });
});
