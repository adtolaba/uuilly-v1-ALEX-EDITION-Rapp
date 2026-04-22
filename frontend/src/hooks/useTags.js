import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useTags = (options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => get('/api/v1/tags'),
    ...options
  });
};

export const useTagsMutation = () => {
  const queryClient = useQueryClient();
  const { post, del } = useApi();

  const createMutation = useMutation({
    mutationFn: (name) => post('/api/v1/tags', { name: name.trim().toLowerCase() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/api/v1/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      // Tags are used in users and agents, so we might want to invalidate those too
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  return { createMutation, deleteMutation };
};
