import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useUsers = (options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['users'],
    queryFn: () => get('/api/v1/users'),
    ...options
  });
};
