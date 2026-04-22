import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useAICredentials = (options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['ai-credentials'],
    queryFn: () => get('/api/v1/ai-credentials'),
    ...options
  });
};

export const useAICredentialsMutation = () => {
  const queryClient = useQueryClient();
  const { post, put, del } = useApi();

  const createMutation = useMutation({
    mutationFn: (data) => post('/api/v1/ai-credentials', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => put(`/api/v1/ai-credentials/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/api/v1/ai-credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-credentials'] });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
};
