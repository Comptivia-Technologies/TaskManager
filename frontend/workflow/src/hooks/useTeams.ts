import { teamService } from '../services/teamService';
import { Team } from '../types';
import { useCollection } from './useCollection';

export const useTeams = () => {
  const { items, loading, error, refetch } = useCollection<Team>(teamService.getAll, 'teams');
  return { teams: items, loading, error, refetch };
};
