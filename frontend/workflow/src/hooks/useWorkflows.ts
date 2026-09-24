import { workflowService } from '../services/workflowService';
import { Workflow } from '../types';
import { useCollection } from './useCollection';

export const useWorkflows = () => {
  const { items, loading, error, refetch } = useCollection<Workflow>(workflowService.getAll, 'workflows');
  return { workflows: items, loading, error, refetch };
};
