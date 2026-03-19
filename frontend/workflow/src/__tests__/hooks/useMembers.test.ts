import { renderHook, waitFor, act } from '@testing-library/react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';

jest.mock('../../services/memberService');

const mockedMemberService = memberService as jest.Mocked<typeof memberService>;

describe('useMembers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMemberService.getAll.mockResolvedValue([]);
  });

  it('returns members, loading, error, refetch', async () => {
    const { result } = renderHook(() => useMembers());
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.members).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('sets error on fetch failure', async () => {
    mockedMemberService.getAll.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useMembers());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Network error');
  });

  it('uses fallback error message when err has no message', async () => {
    mockedMemberService.getAll.mockRejectedValue({});
    const { result } = renderHook(() => useMembers());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Failed to fetch members');
  });

  it('refetch calls memberService.getAll again', async () => {
    const { result } = renderHook(() => useMembers());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    mockedMemberService.getAll.mockResolvedValue([{ memberId: '1', firstName: 'A', lastName: 'B', email: 'a@b.com', role: 'Dev', skillLevel: 1, createdAt: '', updatedAt: '' }]);
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => {
      expect(mockedMemberService.getAll).toHaveBeenCalledTimes(2);
    }, { timeout: 3000 });
  });
});
