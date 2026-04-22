import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useDashboardStats = (isAdmin, options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['dashboard-stats', isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        const [users, agents, tags] = await Promise.all([
          get('/api/v1/users'),
          get('/api/v1/agents'),
          get('/api/v1/tags')
        ]);
        return {
          totalUsers: users.length,
          totalAgents: agents.length,
          totalTags: tags.length
        };
      } else {
        const users = await get('/api/v1/users');
        return {
          totalUsers: users.length,
          totalAgents: 0,
          totalTags: 0
        };
      }
    },
    ...options
  });
};
