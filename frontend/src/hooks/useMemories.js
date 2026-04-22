import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export const useMemories = (filters = {}, options = {}) => {
  const { get } = useApi();
  
  const params = new URLSearchParams();
  if (filters.agentId && filters.agentId !== 'all') params.append('agent_id', filters.agentId);
  if (filters.userId && filters.userId !== 'all') params.append('user_id', filters.userId);
  if (filters.memoryType && filters.memoryType !== 'all') params.append('memory_type', filters.memoryType);

  const queryString = params.toString();
  const url = `/api/v1/memories${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['memories', filters],
    queryFn: () => get(url),
    ...options
  });
};

export const useMemoriesMutation = () => {
  const queryClient = useQueryClient();
  const { post, put, del } = useApi();

  const createMutation = useMutation({
    mutationFn: (data) => post('/api/v1/memories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => put(`/api/v1/memories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => del(`/api/v1/memories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => post('/api/v1/memories/bulk-delete', { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (formData) => {
      // Manual fetch for FormData until useApi supports it better or we pass it through
      const token = localStorage.getItem('access_token');
      return fetch('/api/v1/memories/bulk-upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      }).then(res => {
        if (!res.ok) throw new Error('Bulk upload failed');
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] });
    }
  });

  return { 
    createMutation, 
    updateMutation, 
    deleteMutation, 
    bulkDeleteMutation,
    bulkUploadMutation 
  };
};
