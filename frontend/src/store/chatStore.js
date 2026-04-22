/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  conversations: {}, // Grouped conversations
  activeChatId: null,
  loading: false,
  error: null,

  setActiveChatId: (id) => set({ activeChatId: id }),

  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/conversations`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch conversations");
      }
      const data = await response.json();
      const grouped = get().groupConversations(data);
      set({ conversations: grouped, loading: false });
    } catch (err) {
      console.error("Error fetching conversations:", err);
      set({ error: err.message, loading: false });
    }
  },

  addConversation: (conversation) => {
    set((state) => {
      const allConvs = Object.values(state.conversations).flat();
      // Check if conversation already exists
      if (allConvs.some(c => c.id === conversation.id)) return state;
      
      const updatedList = [conversation, ...allConvs];
      return { conversations: get().groupConversations(updatedList) };
    });
  },

  onTitleUpdate: (conversationId, newTitle) => {
    set((state) => {
      const updatedConversations = { ...state.conversations };
      let found = false;

      // Iterate through all groups to find and update the conversation
      for (const group in updatedConversations) {
        updatedConversations[group] = updatedConversations[group].map(conv => {
          if (conv.id === conversationId) {
            found = true;
            return { ...conv, title: newTitle };
          }
          return conv;
        });
        if (found) break;
      }

      return { conversations: updatedConversations };
    });
  },

  updateConversationTitle: async (conversationId, newTitle) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/conversations/${conversationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (!response.ok) {
        throw new Error("Failed to update conversation title");
      }
      // Re-fetch to update all groupings if date changed or just to be sure
      await get().fetchConversations();
    } catch (err) {
      console.error("Error updating conversation title:", err);
      set({ error: err.message });
    }
  },

  deleteConversation: async (conversationId) => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to delete conversation");
      }
      if (get().activeChatId === conversationId) {
        set({ activeChatId: null });
      }
      await get().fetchConversations();
    } catch (err) {
      console.error("Error deleting conversation:", err);
      set({ error: err.message });
    }
  },

  fetchMessages: async (conversationId) => {
    set({ loading: true, error: null });
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      set({ loading: false });
      return data;
    } catch (err) {
      console.error("Error fetching messages:", err);
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  groupConversations: (data) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groupedData = data.reduce((acc, conv) => {
      const convDate = new Date(conv.created_at);
      let group = "Older";
      if (convDate >= today) {
        group = "Today";
      } else if (convDate >= yesterday) {
        group = "Yesterday";
      } else if (convDate >= sevenDaysAgo) {
        group = "Previous 7 Days";
      }
      if (!acc[group]) acc[group] = [];
      acc[group].push(conv);
      return acc;
    }, {
      "Today": [],
      "Yesterday": [],
      "Previous 7 Days": [],
      "Older": []
    });

    // Remove empty groups if necessary or keep them for consistent UI
    return groupedData;
  }
}));

export default useChatStore;
