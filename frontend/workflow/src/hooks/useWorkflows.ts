import { useState, useEffect, useCallback } from 'react';
import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';

export const useWorkflows = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workflowService.getAll();
      setWorkflows(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return { workflows, loading, error, refetch: fetchWorkflows };
};



