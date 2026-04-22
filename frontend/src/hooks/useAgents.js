import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useAgents = (options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => get('/api/v1/agents'),
    ...options
  });
};
