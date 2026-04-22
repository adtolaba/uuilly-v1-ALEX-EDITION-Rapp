import apiClient from '../api/apiClient';

export const useApi = () => {
  const get = async (url) => {
    const response = await apiClient.get(url);
    return response.data;
  };

  const post = async (url, data) => {
    const response = await apiClient.post(url, data);
    return response.data;
  };

  const put = async (url, data) => {
    const response = await apiClient.put(url, data);
    return response.data;
  };

  const del = async (url) => {
    const response = await apiClient.delete(url);
    return response.data;
  };

  return { get, post, put, del };
};
