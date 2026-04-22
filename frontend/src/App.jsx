/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Paperclip, ArrowUp, Menu, Plus, X, UploadCloud, PanelLeftOpen, Bot, Loader2, BrainCircuit } from 'lucide-react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import UIDialog from '@/components/UIDialog'
import { Sidebar } from '@/components/Sidebar'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { AgentSplash } from '@/components/AgentSplash'
import { ChatMessage } from '@/components/ChatMessage'
import { ProcessingIndicator } from '@/components/ProcessingIndicator'
import { UserDropdown } from '@/components/UserDropdown'
import { AdminPanel } from '@/components/admin/AdminPanel'
import { Button } from '@/components/ui/button'
import { cn, getFileIcon, truncateFilename } from '@/lib/utils'
import { LoginPage } from '@/pages/LoginPage'
import { useNavigate, Routes, Route } from 'react-router-dom'
import useAuthStore from '@/store/authStore'; // Import useAuthStore
import useChatStore from '@/store/chatStore'; // Import useChatStore
import { uploadFile } from '@/api/apiClient';
import useUI from '@/hooks/useUI';
import useStreamingBuffer from "./hooks/useStreamingBuffer";

// UI Integration Complete
export function App() {
  const ui = useUI();
  const [currentView, setCurrentView] = useState('chat') // 'chat' or 'admin'
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isDragOver, setIsDragOver] = useState(false)
  const wsInstanceRef = useRef(null);
  const streamMetadataRef = useRef({ id: null, conversation_id: null });
  const [isWsConnected, setIsWsConnected] = useState(false) // New state for WebSocket connection status
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingResponse, setIsLoadingResponse] = useState(false) // New state for processing indicator
  const [loadingMessage, setLoadingMessage] = useState(null) // Custom message for the indicator
  const [isChatHistoryLoading, setIsChatHistoryLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState(localStorage.getItem("lastUsedAgentId") || null) // State for selected agent from WelcomeScreen
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [activeAgentName, setActiveAgentName] = useState("") // New state for current agent name
  const [activeAgentDescription, setActiveAgentDescription] = useState("") // New state for current agent desc
  const [activeAgentIcon, setActiveAgentIcon] = useState("") // New state for current agent icon
  const [isAtWelcomeScreen, setIsAtWelcomeScreen] = useState(true) // Track if we are on the welcome screen
  const [isInputLocked, setIsInputLocked] = useState(false) // State to prevent double sends
  const [isExtractingMemory, setIsExtractingMemory] = useState(false) // State for learning indicator
  const [isMemoryMode, setIsMemoryMode] = useState(false) // State for manual memory teaching mode
  const [reconnectAttempt, setReconnectAttempt] = useState(0) // Counter to trigger reconnection
  const reconnectCountRef = useRef(0); // Track number of consecutive failures for backoff

  // Use state from authStore
  const { isAuthenticated, currentUser, accessToken, initializeAuth, logout: storeLogout } = useAuthStore();
  
  // Use state from chatStore
  const { activeChatId, setActiveChatId, addConversation, onTitleUpdate } = useChatStore();

  const navigate = useNavigate();

  // Stabilize store objects to prevent Effect loops
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Intercept global fetch to handle auth expiration (401)
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      
      if (response.status === 401) {
        // Prevent infinite loops if the login call itself fails with 401
        const url = args[0] instanceof URL ? args[0].href : args[0];
        if (!url.includes('/api/v1/login/')) {
          console.warn("Unauthorized request detected. Logging out...");
          storeLogout();
          navigate('/login');
        }
      }
      
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [storeLogout, navigate]);

  const { displayedText, isFlushing, addChunk, reset: resetBuffer } = useStreamingBuffer({
    baseInterval: 20,
    burstThreshold: 4,
    maxSpeedMultiplier: 4
  });

  // Commit buffered text to the active message in the array
  useEffect(() => {
    if (displayedText) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.role === "assistant" && lastMsg.is_active_stream) {
          // Update the existing streaming message
          return prev.map((msg, idx) => 
            idx === prev.length - 1 ? { ...msg, content: displayedText } : msg
          );
        } else {
          // Add as a new streaming message if not present
          return [...prev, { 
            role: "assistant", 
            content: displayedText, 
            is_active_stream: true,
            conversation_id: activeChatIdRef.current 
          }];
        }
      });
    }
  }, [displayedText]);

  // Mark streaming message as permanent when done
  useEffect(() => {
    if (!isStreaming && !isFlushing && displayedText) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.is_active_stream) {
          return prev.map((msg, idx) => 
            idx === prev.length - 1 
              ? { 
                  ...msg, 
                  is_active_stream: false,
                  id: streamMetadataRef.current.id || msg.id,
                  conversation_id: streamMetadataRef.current.conversation_id || msg.conversation_id
                } 
              : msg
          );
        }
        return prev;
      });
      resetBuffer();
      // Clear metadata for next stream
      streamMetadataRef.current = { id: null, conversation_id: null };
    }
  }, [isStreaming, isFlushing, resetBuffer, displayedText]);

  const textareaRef = useRef(null)
  const messagesEndRef = useRef(null)
  const escapePressTimer = useRef(null)
  const fileInputRef = useRef(null)
  const footerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(160); // Default fallback
  const activeChatIdRef = useRef(activeChatId);

  // Resize observer to track dynamic footer height (textarea expansion)
  useEffect(() => {
    if (!footerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === footerRef.current) {
          setFooterHeight(entry.contentRect.height);
        }
      }
    });
    
    observer.observe(footerRef.current);
    return () => observer.disconnect();
  }, [isAuthenticated, isAtWelcomeScreen, currentView]);

  // Keep ref in sync with state for WebSocket closure access
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Initialize auth state from localStorage on App mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Effect to save selectedAgentId to local storage whenever it changes (moved from WelcomeScreen)
  useEffect(() => {
    if (selectedAgentId) {
      localStorage.setItem("lastUsedAgentId", selectedAgentId);
    } else {
      localStorage.removeItem("lastUsedAgentId");
    }
  }, [selectedAgentId]);

  // WebSocket Connection Management
  useEffect(() => {
    if (!isAuthenticated || !currentUser) return;

    // Reset connection state immediately
    setIsWsConnected(false);

    // Close any existing WebSocket connection managed by this effect
    if (wsInstanceRef.current && wsInstanceRef.current.readyState === WebSocket.OPEN) {
      wsInstanceRef.current.close();
      setIsWsConnected(false);
      wsInstanceRef.current = null; // Clear ref
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const newWs = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsInstanceRef.current = newWs; // Store the new instance in ref

    newWs.onopen = () => {
      console.log(`WebSocket connected to secure /ws. Authenticating...`);
      // Send auth message immediately
      newWs.send(JSON.stringify({
        type: "auth",
        token: accessToken
      }));
    };

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // 0. Handle Auth/System Events
      if (data.type === "auth_success") {
        console.log(`WebSocket authenticated for user ${data.user_id}`);
        setIsWsConnected(true);
        reconnectCountRef.current = 0; // Reset backoff on success
        return;
      }

      if (data.type === "ping") {
        newWs.send(JSON.stringify({ type: "pong" }));
        return;
      }

      // 1. Handle System/Admin Events
      if (data.type === "new_conversation") {
        addConversation(data.conversation);
        return;
      }

      if (data.type === "title_update") {
        onTitleUpdate(data.conversation_id, data.title);
        return;
      }

      if (data.type === "memory_update") {
        setIsExtractingMemory(false);
        setIsInputLocked(false); // Release lock if it was held by extraction
        setIsLoadingResponse(false);
        setLoadingMessage(null); 
        ui.toast.success(data.message || "Alex ha aprendido algo nuevo", {
          description: `Guardados ${data.count} nuevos recuerdos.`,
          icon: <BrainCircuit className="h-4 w-4 text-primary" />,
          duration: 4000
        });
        return;
      }

      if (data.type === "extraction_started") {
        setIsLoadingResponse(true);
        setLoadingMessage("Analizando material...");
        return;
      }
      
      if (data.type === "memory_extraction_started") {
        setIsExtractingMemory(true);
        return;
      }

      if (data.type === "memory_extraction_finished") {
        setIsExtractingMemory(false);
        setIsInputLocked(false);
        setIsLoadingResponse(false);
        setLoadingMessage(null);
        return;
      }

      if (data.type === "bulk_upload_finished") {
        ui.toast.success(data.message || "Carga masiva completada", {
          description: `Extraídos ${data.count} nuevos recuerdos.`,
          icon: <BrainCircuit className="h-4 w-4 text-primary" />,
          duration: 5000
        });
        // Dispatch custom event to refresh MemoryManagement table if it's open
        window.dispatchEvent(new CustomEvent('refresh-memories'));
        return;
      }

      if (data.type === "bulk_upload_error") {
        ui.toast.error("Error en la carga masiva", {
          description: data.message,
          duration: 6000
        });
        return;
      }

      // 2. Filter Chat-related messages
      const isChatContent = data.response || data.error || data.is_streaming || data.done;
      if (!isChatContent) return;

      // 3. Check Context Ownership (Multi-chat isolation)
      if (data.conversation_id && String(data.conversation_id) !== String(activeChatIdRef.current)) {
        console.log(`Background event for chat ${data.conversation_id}, ignoring.`);
        return;
      }

      // 4. Update UI State
      setIsInputLocked(false);

      if (data.is_streaming) {
        setIsLoadingResponse(false);
        setLoadingMessage(null);
        setIsStreaming(true);
        if (data.id) streamMetadataRef.current.id = data.id;
        if (data.conversation_id) streamMetadataRef.current.conversation_id = data.conversation_id;
        addChunk(data.response);
      } else if (data.done) {
        // DIRECTLY update IDs in the messages state to avoid race conditions with effects
        if (data.id || data.conversation_id) {
          setMessages(prev => {
            if (prev.length === 0) return prev;
            return prev.map((msg, idx) => 
              idx === prev.length - 1 
                ? { 
                    ...msg, 
                    id: data.id || msg.id, 
                    conversation_id: data.conversation_id || msg.conversation_id 
                  } 
                : msg
            );
          });
        }

        if (data.id) streamMetadataRef.current.id = data.id;
        if (data.conversation_id) streamMetadataRef.current.conversation_id = data.conversation_id;

        // If it was NOT streaming (e.g. a simple sync response), add it now
        if (!isStreaming) {
           if (data.sender === "bot") {
             setIsLoadingResponse(false);
             setLoadingMessage(null);
             setMessages(prevMessages => [...prevMessages, { 
              id: data.id,
              conversation_id: data.conversation_id,
              role: "assistant", 
              content: data.response 
            }]);
           } else {
             // It's a user message acknowledgement, update the last user message with its ID
             setMessages(prev => prev.map((msg, idx) => 
               (idx === prev.length - 1 && msg.role === "user" && !msg.id) 
                 ? { ...msg, id: data.id } 
                 : msg
             ));
           }
        }
        setIsStreaming(false);
      }
 else if (data.response) {
        // Fallback for non-streaming messages without 'done' flag
        if (data.sender === "bot") {
          setIsLoadingResponse(false);
          setLoadingMessage(null);
          setMessages(prevMessages => [...prevMessages, { 
            id: data.id,
            conversation_id: data.conversation_id,
            role: "assistant", 
            content: data.response 
          }]);
        }
        setIsStreaming(false);
      }
 else if (data.error) {
        console.error("WS Error:", data.error);
        setIsStreaming(false);
      }
    };

    newWs.onclose = () => {
      console.log("WebSocket disconnected.");
      setIsStreaming(false);
      setIsWsConnected(false);
      setIsLoadingResponse(false);
      wsInstanceRef.current = null;

      // Exponential Backoff Reconnection
      if (isAuthenticated && currentUserRef.current) {
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 30000);
        console.log(`Attempting reconnection in ${delay}ms (Attempt ${reconnectCountRef.current + 1})`);
        
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectCountRef.current += 1;
          setReconnectAttempt(prev => prev + 1);
        }, delay);
      }
    };

    newWs.onerror = (error) => {
      // Only log if it's a real error and not an intentional closure
      if (newWs.readyState !== WebSocket.CLOSED && newWs.readyState !== WebSocket.CLOSING) {
        console.error("WebSocket error:", error);
      }
      setIsStreaming(false);
      setIsWsConnected(false);
      setIsLoadingResponse(false);
      if (wsInstanceRef.current === newWs) wsInstanceRef.current = null;
    };

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      // Only close if it's not already closed
      if (newWs.readyState === WebSocket.OPEN || newWs.readyState === WebSocket.CONNECTING) {
        newWs.close();
      }
      if (wsInstanceRef.current === newWs) {
        wsInstanceRef.current = null;
        setIsWsConnected(false);
      }
    };
  }, [isAuthenticated, accessToken, reconnectAttempt]);

  // Logout function
  const handleLogout = () => {
    storeLogout(); // Use the logout function from the store
    setActiveChatId(null)
    setMessages([])
    setInputValue("")
    setSelectedFiles([])
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsInstanceRef.current) { // Use wsInstanceRef.current
      wsInstanceRef.current.close(); // Use wsInstanceRef.current
      wsInstanceRef.current = null; // Clear ref
      setIsWsConnected(false);
    }
    navigate('/login'); // Redirect to login page
  }

  // Effect to auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  // Effect to scroll to bottom when messages change or a chat is selected
  useEffect(() => {
    if (messagesEndRef.current) {
      // Use "auto" behavior when streaming or loading history for more direct scrolling, "smooth" for static changes
      const behavior = (isFlushing || isStreaming || isLoadingResponse || isChatHistoryLoading || isExtractingMemory) ? "auto" : "smooth";
      messagesEndRef.current.scrollIntoView({ behavior });

      // Extra scroll after a short delay when messages change or history loads to account for layout shifts
      // from animations (500ms) and Markdown rendering.
      if (messages.length > 0) {
        const timer = setTimeout(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto" });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }
    // Auto-focus textarea whenever chat is active
    if (!isAtWelcomeScreen && currentView === 'chat' && textareaRef.current) {
      // Skip if a dialog/modal is currently open to avoid focus theft
      const isDialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (!isDialogOpen) {
        textareaRef.current.focus();
      }
    }
  }, [messages, isAtWelcomeScreen, currentView, isFlushing, isStreaming, isLoadingResponse, isChatHistoryLoading, isExtractingMemory, footerHeight]);


  // Effect to handle global auto-focus restoration
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Restore focus to textarea if clicking empty space and chat is active
      if (!isAtWelcomeScreen && currentView === 'chat' && textareaRef.current) {
        // Skip if a dialog/modal is currently open to avoid focus theft
        const isDialogOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');
        if (isDialogOpen) return;

        // Only re-focus if the user isn't trying to select text or interacting with another input
        const isInput = ['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'A'].includes(e.target.tagName);
        if (!isInput && window.getSelection().toString().length === 0) {
          textareaRef.current.focus();
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [isAtWelcomeScreen, currentView]);

  const handleSelectChat = async (id) => {
    const isAlreadyActive = activeChatId === id && currentView === 'chat';

    setActiveChatId(id)
    setCurrentView('chat')
    setIsAtWelcomeScreen(false) // Exit welcome screen when a chat is selected
    setInputValue("")
    setSelectedFiles([])
    setIsMemoryMode(false) // Reset learning mode on chat switch
    if (isAlreadyActive) return;

    setIsChatHistoryLoading(true)
    setMessages([]) // Clear previous messages immediately
    try {
      const token = localStorage.getItem("access_token")

      // Fetch conversation details to get agent name
      const convResponse = await fetch(`/api/v1/conversations/${id}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      if (!convResponse.ok) {
        throw new Error("Failed to fetch conversation details")
      }
      const conversationDetails = await convResponse.json()
      const agentObj = conversationDetails.agent;
      setSelectedAgent(agentObj);
      const agentName = agentObj ? agentObj.name : "Unknown Agent";
      const agentDesc = agentObj ? agentObj.description : "";
      const agentIcon = agentObj ? agentObj.icon : "";
      setActiveAgentName(agentName);
      setActiveAgentDescription(agentDesc);
      setActiveAgentIcon(agentIcon);
      
      // Update selectedAgentId when selecting an existing chat
      if (conversationDetails.agent_id) {
        setSelectedAgentId(String(conversationDetails.agent_id));
      }


      // Fetch chat messages
      const msgResponse = await fetch(`/api/v1/conversations/${id}/messages`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      if (!msgResponse.ok) {
        throw new Error("Failed to fetch chat history")
      }
      const data = await msgResponse.json()
      const formattedMessages = data.map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.sender === 'user' ? 'user' : 'assistant', // Map 'user'/'bot' to 'user'/'assistant'
        content: msg.text,
        timestamp: msg.timestamp,
        files: msg.files, // Include files from history
        agentName: msg.sender === 'bot' ? agentName : undefined // Pass agentName for bot messages
      }));

      setMessages(formattedMessages)
    } catch (error) {
      console.error("Error fetching chat history:", error)
      // Optionally, set an error state and display it to the user
    } finally {
      setIsChatHistoryLoading(false)
    }
  }

  const handleNewChat = (newAgentId = null) => {
    // If called from an onClick event, the first argument will be the event object.
    // We must ensure we don't store the event object in the state.
    let agentId = (typeof newAgentId === 'object' && newAgentId !== null) ? null : newAgentId;

    if (agentId) {
      setSelectedAgentId(agentId);
      setIsAtWelcomeScreen(false);
    } else {
      setIsAtWelcomeScreen(true);
      setActiveAgentName(""); // Clear agent name on welcome screen
      setActiveAgentDescription("");
      setActiveAgentIcon("");
    }
    setActiveChatId(null)
    setCurrentView('chat')
    setMessages([])
    setInputValue("")
    setSelectedFiles([])
    setIsMemoryMode(false) // Reset learning mode on new chat
  }

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const validateFiles = (files) => {
    const validFiles = [];
    let hasTooLarge = false;

    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        hasTooLarge = true;
      } else {
        validFiles.push(file);
      }
    });

    if (hasTooLarge) {
      ui.toast.error("Algunos archivos superan los 5MB y fueron omitidos.");
    }

    return validFiles;
  };

  const handleSelectAgent = (agent) => {
    setSelectedAgentId(String(agent.id));
    setSelectedAgent(agent);
    setActiveAgentName(agent.name || "");
    setActiveAgentDescription(agent.description || "");
    setActiveAgentIcon(agent.icon || "");
    setIsAtWelcomeScreen(false);
    setIsMemoryMode(false); // Reset learning mode on agent selection
    localStorage.setItem("lastUsedAgentId", String(agent.id));
  }

  const [pendingMessages, setPendingMessages] = useState([]);

  // This effect is responsible for sending messages from the queue when the WebSocket is ready.
  useEffect(() => {
    if (wsInstanceRef.current && wsInstanceRef.current.readyState === WebSocket.OPEN && isWsConnected && pendingMessages.length > 0) {
      console.log("Checking message queue. WS State:", wsInstanceRef.current?.readyState, "isWsConnected:", isWsConnected, "Queue size:", pendingMessages.length);
      const messageToSend = pendingMessages[0]; // Get the first message from the queue
      console.log("Sending message from queue:", messageToSend);
      wsInstanceRef.current.send(JSON.stringify(messageToSend));
      setPendingMessages(prev => prev.slice(1)); // Remove the sent message from the queue
      
      // Start "Thinking" indicator as soon as we actually SEND the message to the WS
      setIsLoadingResponse(true);
    }
  }, [isWsConnected, pendingMessages]); // Removed ws from dependencies

  const handleDeleteMessage = async (messageId, chatId) => {
    if (!messageId || !chatId) return;
    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`/api/v1/conversations/${chatId}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${token}` }
      })
      // 404 means already deleted, which is fine for background cleanup
      if (!response.ok && response.status !== 404) {
        console.warn(`Failed to cleanup message ${messageId}:`, response.status);
      }
    } catch (error) {
      // Silence network errors for cleanup
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() && selectedFiles.length === 0) return;
    if (isStreaming || isLoadingResponse || isInputLocked) {
      console.log("Still processing, please wait.");
      return;
    }

    setIsInputLocked(true);
    setIsLoadingResponse(true);

    const sendMessagePayload = async (chatId) => {
      if (!selectedAgentId) {
        console.error("Attempted to send message without selectedAgentId");
        return;
      }

      let uploadedFiles = [];
      if (selectedFiles.length > 0) {
        try {
          // Upload all files in parallel with conversation ID
          uploadedFiles = await Promise.all(selectedFiles.map(file => uploadFile(file, chatId)));
        } catch (error) {
          console.error("Error uploading files:", error);
          ui.toast.error("No se pudieron subir los archivos. Por favor, intenta de nuevo.");
          setIsInputLocked(false);
          return;
        }
      }

      const userMessage = {
        role: "user",
        content: inputValue.trim(),
        conversation_id: chatId,
        files: uploadedFiles // Use metadata from server (includes URL)
      };
      setMessages(prev => [...prev, userMessage]);
  
      const payload = {
        text: inputValue.trim(),
        agent_id: selectedAgentId,
        conversation_id: chatId,
        user_id: currentUser.id,
        files: uploadedFiles,
        is_memory: isMemoryMode
      };
      
      console.log("Queuing message:", payload);
      setPendingMessages(prev => [...prev, payload]);
  
      setInputValue("");
      setSelectedFiles([]);
      setIsMemoryMode(false); // Disable memory mode after sending
      setIsAtWelcomeScreen(false); // Ensure we are not on welcome screen
    };
  
    if (!activeChatId) {
      if (!selectedAgentId) {
        ui.toast.info("Por favor, selecciona un asistente antes de comenzar una conversación.");
        return;
      }
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch("/api/v1/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            agent_id: selectedAgentId,
            title: inputValue.trim().substring(0, 25) || "New Chat"
          })
        });
        if (!response.ok) throw new Error("Failed to create conversation");
        const newConv = await response.json();
        
        // Add to store and set active
        addConversation(newConv);
        setActiveChatId(newConv.id); 
        
        // Now queue the message with the new conversation ID
        await sendMessagePayload(newConv.id);

      } catch (error) {
        console.error("Error creating conversation:", error);
        ui.toast.error("No se pudo iniciar un nuevo chat. " + error.message);
        setIsInputLocked(false);
      }
    } else {
      // If a chat is already active, just queue the message
      await sendMessagePayload(activeChatId);
    }
  };

  const handleKeyDownInTextarea = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    } else if (e.key === "Escape") {
      if (escapePressTimer.current) {
        clearTimeout(escapePressTimer.current)
        escapePressTimer.current = null
        setInputValue("")
      } else {
        escapePressTimer.current = setTimeout(() => {
          escapePressTimer.current = null
        }, 300)
      }
    }
  }

  const handleFileChange = (e) => {
    if (e.target.files) {
      const validFiles = validateFiles(Array.from(e.target.files));
      if (validFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
      }
      e.target.value = null;
      // Refocus chat input
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }

  const handleRemoveFile = (index) => {
    setSelectedFiles(prevFiles => prevFiles.filter((_, i) => i !== index))
  }

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      const validFiles = validateFiles(Array.from(event.dataTransfer.files));
      if (validFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validFiles]);
      }
      event.dataTransfer.clearData();
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, []);

  const handlePaste = useCallback((event) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    let hasImages = false;
    const pastedFiles = [];

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Check if it's an image from clipboard (usually named "image.png")
          let finalFile = file;
          if (file.name === 'image.png' || !file.name) {
            const now = new Date();
            const timestamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').replace('T', '_');
            const newName = `screenshot_${timestamp}.png`;
            finalFile = new File([file], newName, { type: file.type });
          }
          pastedFiles.push(finalFile);
          hasImages = true;
        }
      }
    }

    if (hasImages) {
      const validFiles = validateFiles(pastedFiles);
      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles]);
      }
      
      // Refocus just in case, though paste usually keeps focus
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="uuilly-ui-theme">
      <Toaster position="top-center" richColors closeButton />
      <UIDialog />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {isAuthenticated ? (
          <>
            <Route path="/" element={
              <div className="flex h-screen w-full overflow-hidden bg-background font-sans text-sm 3xl:text-base">
                {/* Sidebar Wrapper */}
                <div className={cn(
                  "fixed inset-y-0 left-0 z-50 md:relative md:flex h-full flex-col transition-all duration-300 ease-in-out overflow-hidden shadow-2xl md:shadow-none bg-background",
                  isSidebarOpen ? "translate-x-0 w-[280px] md:w-sidebar" : "-translate-x-full md:translate-x-0 w-0 md:w-16"
                )}>
                  <Sidebar 
                    className="shrink-0 h-full w-full" 
                    onSelectChat={handleSelectChat} 
                    onNewChat={handleNewChat}
                    user={currentUser}
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isAtWelcomeScreen={isAtWelcomeScreen && currentView === 'chat'}
                    onLogout={handleLogout}
                    onAdminClick={() => setCurrentView('admin')}
                  />
                </div>

                {/* Mobile Backdrop Overlay */}
                {isSidebarOpen && (
                  <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 md:hidden animate-in fade-in duration-300" 
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                  />
                )}
                
                {/* Main Content Area */}
                <main 
                  className={cn(
                    "flex-1 flex flex-col min-w-0 bg-background relative h-full transition-all duration-300 ease-in-out",
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                >
                  {/* Drag & Drop Overlay ... (omitted) */}

                  {/* Top Bar Controls - Dedicated space to prevent invasion */}
                  <header className="h-14 3xl:h-16 shrink-0 flex items-center justify-between px-4 3xl:px-6 z-20">
                    <div className="flex items-center gap-3 3xl:gap-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                        className="md:hidden"
                        aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                        data-testid="mobile-hamburger"
                      >
                        <Menu className="h-5 w-5 3xl:h-6 3xl:w-6" />
                      </Button>
                      
                      {/* Active Agent Indicator */}
                      {!isAtWelcomeScreen && activeAgentName && (
                        <div className="flex items-center gap-2 3xl:gap-2.5 px-2 3xl:px-2.5 py-1 rounded-lg bg-muted/30 border border-muted/20 animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="h-6 w-6 flex items-center justify-center rounded-md bg-primary/10 text-primary text-sm shrink-0">
                            {activeAgentIcon || <Bot className="h-3.5 w-3.5 3xl:h-4 3xl:w-4" />}
                          </div>
                          <span className="text-sm 3xl:text-sm font-medium truncate max-w-[150px] md:max-w-[300px] 3xl:max-w-[400px]">
                            {activeAgentName}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 3xl:gap-4">
                      <div className="hidden md:block">
                        <UserDropdown 
                          user={currentUser} 
                          onLogout={handleLogout} 
                          onAdminClick={() => setCurrentView('admin')}
                        />
                      </div>
                    </div>
                  </header>
                  
                  {/* Content Area */}
                  <div className="flex-1 flex flex-col overflow-hidden relative">
                    {currentView === 'admin' ? (
                      <AdminPanel currentUser={currentUser} isWsConnected={isWsConnected} />
                    ) : (

                      <div className={cn(
                        "flex-1 flex flex-col min-h-0",
                        !isAtWelcomeScreen ? "overflow-y-auto custom-scrollbar pb-10" : "overflow-hidden"
                      )}>
                        {isAtWelcomeScreen ? (
                          <div className="h-full flex items-start justify-center">
                            <WelcomeScreen user={currentUser} onSelectAgent={handleSelectAgent} selectedAgentId={selectedAgentId} />
                          </div>
                        ) : isChatHistoryLoading ? (
                          <div className="flex-1 flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30" />
                          </div>
                        ) : messages.length === 0 ? (
                          <AgentSplash 
                            agentName={activeAgentName} 
                            agentDescription={activeAgentDescription}
                            agentIcon={activeAgentIcon}
                            selectedAgentId={selectedAgentId}
                            onSelectConversation={handleSelectChat}
                          />
                        ) : (
                          <>
                            {messages.map((m, i) => {
                              // Special Logic for Editability:
                              const isLast = i === messages.length - 1;
                              const isSecondToLast = i === messages.length - 2;
                              const lastMsg = messages[messages.length - 1];
                              const isLastAnAck = lastMsg && lastMsg.role === 'assistant' && 
                                                 (lastMsg.content?.toLowerCase().includes('message updated') || lastMsg.content?.length < 50);
                              
                              // If the last message is an acknowledgment, ONLY the second-to-last is editable.
                              // Otherwise, ONLY the last one is editable.
                              const isEditable = isLastAnAck ? isSecondToLast : isLast;

                              return (
                                <ChatMessage 
                                  key={i} 
                                  message={m} 
                                  user={currentUser} 
                                  isEditable={isEditable}
                                  onStartThinking={() => setIsLoadingResponse(true)}
                                  onMessageUpdate={(updatedMsg) => {
                                    setMessages(prev => {
                                      let newMessages = prev.map((msg, idx) => 
                                        idx === i ? { ...msg, ...updatedMsg, content: updatedMsg.text } : msg
                                      );
                                      
                                      // Cleanup logic: If we edited a message that wasn't the last one
                                      // (it had an acknowledgement after it), delete that acknowledgement.
                                      if (i < prev.length - 1) {
                                        const nextMsg = prev[i + 1];
                                        const isAck = nextMsg.role === 'assistant' && 
                                                     (nextMsg.content?.toLowerCase().includes('message updated') || nextMsg.content?.length < 50);
                                        
                                        if (isAck) {
                                          if (nextMsg.id) {
                                            handleDeleteMessage(nextMsg.id, m.conversation_id || nextMsg.conversation_id);
                                          }
                                          newMessages = newMessages.filter((_, idx) => idx !== i + 1);
                                        }
                                      }
                                      return newMessages;
                                    })
                                  }}
                                />
                              );
                            })}

                            {/* Show ProcessingIndicator only when wait between user send and first bot response token */}
                            {isLoadingResponse && (
                              <ProcessingIndicator 
                                agentName={activeAgentName} 
                                agentIcon={activeAgentIcon} 
                                loadingMessage={loadingMessage}
                              />
                            )}
                            
                            {/* Learning Indicator (Persistent Memory) */}
                            {isExtractingMemory && (
                              <div className="flex items-center gap-2 px-8 py-2 text-xs text-muted-foreground animate-pulse">
                                <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                                <span>Alex está aprendiendo...</span>
                              </div>
                            )}
                            {/* Dynamic spacer to allow scrolling past the floating footer that expands */}
                            <div style={{ height: `${footerHeight}px` }} className="shrink-0" />
                            <div ref={messagesEndRef} />
                          </>
                        )}
                      </div>
                    )}
                     
                    {/* Modern Footer Message Input Area */}
                    {!isAtWelcomeScreen && currentView !== 'admin' && (
                      <div ref={footerRef} className="absolute bottom-0 left-0 right-0 w-full bg-gradient-to-t from-background via-background/95 to-transparent pt-20 3xl:pt-16 pb-6 md:pb-12 pointer-events-none">
                        <div className="max-w-4xl 3xl:max-w-5xl mx-auto px-4 3xl:pb-4 pointer-events-auto">
                          {selectedFiles.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2 p-2 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                              {selectedFiles.map((file, index) => {
                                const Icon = getFileIcon(file.name);
                                return (
                                  <div key={file.name + index} className="flex items-center gap-1 bg-secondary rounded-full pl-2 pr-1 py-0.5 text-xs text-secondary-foreground">
                                    <Icon className="h-3 w-3" />
                                    <span>{truncateFilename(file.name)}</span>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full p-0.5" onClick={() => handleRemoveFile(index)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                          <div className={cn(
                            "relative border rounded-2xl bg-muted/10 backdrop-blur-md transition-all p-3 3xl:p-4 shadow-sm",
                            isInputLocked && "opacity-60 cursor-not-allowed",
                            isMemoryMode ? "border-primary ring-2 ring-primary/20 shadow-[0_0_20px_-3px_rgba(255,61,0,0.4)] bg-primary/5" : "border-muted-foreground/20 focus-within:border-muted-foreground/40"
                          )}>
                            <textarea
                              ref={textareaRef}
                              placeholder={isInputLocked ? "Procesando..." : (isMemoryMode ? "Alex está escuchando para aprender algo nuevo..." : "Escribe tu mensaje o adjunta archivos...")}
                              className={cn(
                                "w-full bg-transparent border-none outline-none resize-none text-sm 3xl:text-base min-h-[50px] 3xl:min-h-[60px] max-h-[200px] 3xl:max-h-[300px] placeholder:text-muted-foreground/50 focus:ring-0 p-1 custom-scrollbar font-sans transition-all",
                                isMemoryMode && "text-primary dark:text-primary font-medium"
                              )}
                              rows={1}
                              value={inputValue}
                              onChange={(e) => setInputValue(e.target.value)}
                              onKeyDown={handleKeyDownInTextarea}
                              disabled={isInputLocked}
                            />
                            <div className="flex items-center justify-between mt-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="file"
                                  ref={fileInputRef}
                                  multiple
                                  className="hidden"
                                  onChange={handleFileChange}
                                  disabled={isInputLocked}
                                />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-transparent" 
                                  onClick={() => fileInputRef.current.click()}
                                  disabled={isInputLocked}
                                >
                                  <Paperclip className="h-5 w-5" />
                                </Button>

                                {selectedAgent?.memory_enabled && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8 rounded-lg transition-all",
                                      isMemoryMode ? "text-primary bg-primary/20 hover:bg-primary/30 ring-1 ring-primary/50" : "text-muted-foreground hover:bg-muted/20"
                                    )}
                                    onClick={() => {
                                      setIsMemoryMode(!isMemoryMode)
                                      // Refocus textarea after state change
                                      setTimeout(() => textareaRef.current?.focus(), 0)
                                    }}
                                    title={isMemoryMode ? "Desactivar modo aprendizaje" : "Activar modo aprendizaje (Alex lo recordará)"}
                                    disabled={isInputLocked}
                                  >
                                    <BrainCircuit className={cn("h-4 w-4", isMemoryMode && "animate-pulse")} />
                                  </Button>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {isMemoryMode && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in zoom-in duration-300 mr-2">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                    </span>
                                    <span className="text-[11px] font-bold text-primary dark:text-primary uppercase tracking-tighter">
                                      Modo Aprendizaje
                                    </span>
                                  </div>
                                )}
                                <Button 
                                  variant={isMemoryMode ? "default" : "secondary"}
                                  size="icon" 
                                  className={cn(
                                    "h-8 w-8 rounded-full transition-all shadow-md",
                                    isMemoryMode ? "bg-primary hover:bg-primary/90 text-white" : "bg-secondary hover:bg-secondary/80",
                                    isInputLocked && "opacity-50"
                                  )}
                                  onClick={handleSendMessage}
                                  disabled={isInputLocked}
                                >
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </main>
              </div>
            } />
          </>
        ) : (
          <Route path="*" element={<LoginPage />} />
        )}
      </Routes>
    </ThemeProvider>
  )
}
