/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';

const useAuthStore = create((set, get) => ({
  isAuthenticated: false,
  currentUser: null,
  accessToken: localStorage.getItem('access_token') || null,
  isLoading: false,
  error: null,

  // Fetches the full user profile from the API (Safe background fetch)
  fetchCurrentUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return null;

    try {
      const response = await fetch('/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        
        // Merge with existing data to ensure name is priority for greeting
        const user = {
          ...userData,
          firstName: userData.first_name,
          lastName: userData.last_name,
          picture: userData.profile_photo_url,
          name: userData.first_name || userData.email.split('@')[0]
        };
        set({ currentUser: user, isAuthenticated: true });
        return user;
      }
    } catch (error) {
      console.warn("Silent failure fetching user profile:", error);
    }
    return null;
  },

  // Initialize state from localStorage or URL token
  initializeAuth: async () => {
    // 1. Check URL for token (from Google OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
      localStorage.setItem('access_token', tokenFromUrl);
      // Clean URL without refreshing
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken.exp * 1000 > Date.now()) {
          // Set initial minimal user data from JWT
          const initialUser = {
            id: decodedToken.user_id,
            name: decodedToken.sub.split('@')[0],
            email: decodedToken.sub,
            role: decodedToken.role,
            picture: decodedToken.picture,
          };
          set({ isAuthenticated: true, currentUser: initialUser, accessToken: token, error: null });
          
          // Fetch full profile in background without blocking
          get().fetchCurrentUser();
        } else {
          get().logout();
        }
      } catch (error) {
        console.error("Failed to decode token:", error);
        get().logout();
      }
    }
  },

  loginWithPassword: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/v1/login/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Login failed');
      }

      const { access_token } = await response.json();
      localStorage.setItem('access_token', access_token);
      
      const decodedToken = jwtDecode(access_token);
      const initialUser = {
        id: decodedToken.user_id,
        name: decodedToken.sub.split('@')[0],
        email: decodedToken.sub,
        role: decodedToken.role,
        picture: decodedToken.picture,
      };
      
      set({ 
        isAuthenticated: true, 
        currentUser: initialUser, 
        accessToken: access_token, 
        isLoading: false,
        error: null 
      });

      // Background profile fetch
      get().fetchCurrentUser();
      
      return true;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  // Generic login for externally provided tokens (OAuth)
  login: (token) => {
    localStorage.setItem('access_token', token);
    const decodedToken = jwtDecode(token);
    const initialUser = {
      id: decodedToken.user_id,
      name: decodedToken.sub.split('@')[0],
      email: decodedToken.sub,
      role: decodedToken.role,
      picture: decodedToken.picture,
    };
    set({ isAuthenticated: true, currentUser: initialUser, accessToken: token, error: null });
    get().fetchCurrentUser();
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ isAuthenticated: false, currentUser: null, accessToken: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
