import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useSettings = (options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => get('/api/v1/settings'),
    ...options
  });
};

export const useSettingsMutation = () => {
  const queryClient = useQueryClient();
  const { put, post } = useApi();

  const updateMutation = useMutation({
    mutationFn: (data) => put('/api/v1/settings', data),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const resetPromptMutation = useMutation({
    mutationFn: () => post('/api/v1/settings/reset-prompt'),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return { updateMutation, resetPromptMutation };
};

export const useModels = (provider, credentialId, options = {}) => {
  const { get } = useApi();
  
  return useQuery({
    queryKey: ['models', provider, credentialId],
    queryFn: () => {
      if (!provider) return [];
      let url = `/api/v1/settings/models?provider=${provider}`;
      if (credentialId) url += `&credential_id=${credentialId}`;
      return get(url);
    },
    enabled: !!provider,
    ...options
  });
};
