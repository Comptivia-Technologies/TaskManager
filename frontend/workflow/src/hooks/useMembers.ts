import { memberService } from '../services/memberService';
import { Member } from '../types';
import { useCollection } from './useCollection';

export const useMembers = () => {
  const { items, loading, error, refetch } = useCollection<Member>(memberService.getAll, 'members');
  return { members: items, loading, error, refetch };
};
