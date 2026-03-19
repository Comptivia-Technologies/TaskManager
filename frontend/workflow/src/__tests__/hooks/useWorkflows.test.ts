import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflows } from '../../hooks/useWorkflows';
import { workflowService } from '../../services/workflowService';

jest.mock('../../services/workflowService');

const mockedWorkflowService = workflowService as jest.Mocked<typeof workflowService>;

describe('useWorkflows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkflowService.getAll.mockResolvedValue([]);
  });

  it('returns workflows, loading, error, refetch', async () => {
    const { result } = renderHook(() => useWorkflows());
    expect(result.current.loading).toBe(true);
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.workflows).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.refetch).toBe('function');
  });

  it('sets error on fetch failure', async () => {
    mockedWorkflowService.getAll.mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Failed');
  });

  it('uses fallback error message when err has no message', async () => {
    mockedWorkflowService.getAll.mockRejectedValue({});
    const { result } = renderHook(() => useWorkflows());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 3000 });
    expect(result.current.error).toBe('Failed to fetch workflows');
  });
});
