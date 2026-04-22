/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import axios from 'axios';
import useAuthStore from '../store/authStore'; // Import your auth store

const apiClient = axios.create({
  baseURL: '/', // Your API base URL, e.g., /api/v1
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding the authentication token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling 401 Unauthorized errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      const { logout } = useAuthStore.getState();
      logout(); // Clear auth state

      // Redirect to login page
      window.location.href = '/login'; // Redirect to login
    }
    return Promise.reject(error);
  }
);

export const uploadFile = async (file, conversationId) => {
  const formData = new FormData();
  formData.append('file', file);
  const url = conversationId ? `/api/v1/files/upload?conversation_id=${conversationId}` : '/api/v1/files/upload';
  const response = await apiClient.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export default apiClient;
