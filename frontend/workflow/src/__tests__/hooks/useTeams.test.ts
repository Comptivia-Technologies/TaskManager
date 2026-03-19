import { renderHook, waitFor } from '@testing-library/react';
import { useTeams } from '../../hooks/useTeams';
import { teamService } from '../../services/teamService';

jest.mock('../../services/teamService');

const mockedTeamService = teamService as jest.Mocked<typeof teamService>;

describe('useTeams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTeamService.getAll.mockResolvedValue([]);
  });

  it('returns teams, loading, error, refetch', async () => {
    const { result } = renderHook(() => useTeams());
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.teams).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('sets error on fetch failure', async () => {
    mockedTeamService.getAll.mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useTeams());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Failed');
  });

  it('uses fallback error message when err has no message', async () => {
    mockedTeamService.getAll.mockRejectedValue({});
    const { result } = renderHook(() => useTeams());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Failed to fetch teams');
  });
});
