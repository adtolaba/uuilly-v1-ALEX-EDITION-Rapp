/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer, useEffect } from "react"
import { PanelLeftOpen, Plus } from "lucide-react"
import { Button } from "./ui/button"
import { Separator } from "./ui/separator"
import { cn } from "@/lib/utils"
import useChatStore from "../store/chatStore"
import useUI from "../hooks/useUI"
import { formatToMarkdown, formatToText, triggerDownload } from "../lib/exportUtils"
import { SidebarHeader } from "./sidebar/SidebarHeader"
import { ConversationList } from "./sidebar/ConversationList"
import { UserDropdown } from "./UserDropdown"
import logoSvg from "../assets/branding/avatar_logo.svg"

const initialState = {
  searchQuery: "",
  editingId: null,
  editingTitle: "",
  downloadingId: null,
  expandedGroups: [],
}

function sidebarReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value }
    case "START_EDITING":
      return { ...state, editingId: action.payload.id, editingTitle: action.payload.title }
    case "STOP_EDITING":
      return { ...state, editingId: null, editingTitle: "" }
    case "ADD_EXPANDED_GROUPS":
      return { ...state, expandedGroups: [...new Set([...state.expandedGroups, ...action.payload])] }
    default:
      return state
  }
}

export function Sidebar({
  className,
  onSelectChat,
  onNewChat,
  user,
  isSidebarOpen = true,
  onToggleSidebar,
  isAtWelcomeScreen = false,
  onLogout,
  onAdminClick,
}) {
  const ui = useUI()
  const [state, dispatch] = useReducer(sidebarReducer, initialState)

  const {
    conversations,
    activeChatId,
    loading,
    error,
    fetchConversations,
    setActiveChatId,
    updateConversationTitle,
    deleteConversation,
    fetchMessages,
  } = useChatStore()

  useEffect(() => {
    if (user && user.id) {
      fetchConversations()
    }
  }, [user, fetchConversations])

  const handleUpdateConversationTitle = async (conversationId, newTitle) => {
    if (!user || !user.id) {
      ui.toast.error("User not logged in.")
      return
    }
    await updateConversationTitle(conversationId, newTitle)
  }

  const handleDeleteConversation = async (conversationId) => {
    ui.confirm("Eliminar conversación", "¿Estás seguro de que deseas eliminar esta conversación?", async () => {
      await deleteConversation(conversationId)
      if (activeChatId === conversationId) {
        onNewChat() // If deleted chat was active, go to new chat view
      }
    })
  }

  const handleDownload = async (chat, format) => {
    dispatch({ type: "SET_FIELD", field: "downloadingId", value: chat.id })
    try {
      const rawMessages = await fetchMessages(chat.id)
      const messages = rawMessages.map((m) => ({
        role: m.sender === "bot" ? "assistant" : "user",
        content: m.text,
      }))

      const dateStr = new Date().toISOString().split("T")[0]
      const sanitizedTitle = chat.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()

      if (format === "markdown") {
        const content = formatToMarkdown(chat.title, messages)
        triggerDownload(content, `${sanitizedTitle}_${dateStr}.md`, "text/markdown")
      } else {
        const content = formatToText(messages)
        triggerDownload(content, `${sanitizedTitle}_${dateStr}.txt`, "text/plain")
      }

      ui.toast.success(`Conversación descargada como ${format}`)
    } catch (err) {
      ui.toast.error("Error al descargar la conversación")
      console.error(err)
    } finally {
      dispatch({ type: "SET_FIELD", field: "downloadingId", value: null })
    }
  }

  const startEditing = (chat) => {
    dispatch({ type: "START_EDITING", payload: { id: chat.id, title: chat.title } })
  }

  const saveEdit = () => {
    if (state.editingTitle.trim() && state.editingId) {
      handleUpdateConversationTitle(state.editingId, state.editingTitle)
    }
    dispatch({ type: "STOP_EDITING" })
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault()
      saveEdit()
    }
    if (e.key === "Escape") {
      dispatch({ type: "STOP_EDITING" })
    }
  }

  const handleChatSelect = (id) => {
    if (state.editingId === id) return
    setActiveChatId(id)
    onSelectChat(id)
  }

  const filteredConversations = Object.values(conversations)
    .flat()
    .filter((conv) => conv && conv.title && conv.title.toLowerCase().includes(state.searchQuery.toLowerCase()))

  const grouped = filteredConversations.reduce((acc, conv) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const convDate = new Date(conv.created_at)
    let group = "Anteriores"
    if (convDate >= today) {
      group = "Hoy"
    } else if (convDate >= yesterday) {
      group = "Ayer"
    } else if (convDate >= sevenDaysAgo) {
      group = "Últimos 7 días"
    }
    if (!acc[group]) acc[group] = []
    acc[group].push(conv)
    return acc
  }, {})

  const allGroups = Object.keys(grouped)

  useEffect(() => {
    if (allGroups.length > 0) {
      const newGroups = allGroups.filter((g) => !state.expandedGroups.includes(g))
      if (newGroups.length > 0) {
        dispatch({ type: "ADD_EXPANDED_GROUPS", payload: newGroups })
      }
    }
  }, [allGroups.length, state.expandedGroups])

  if (!isSidebarOpen) {
    return (
      <nav
        className={cn(
          "hidden md:flex flex-col h-full bg-background border-r w-16 py-4 transition-all duration-300 items-center gap-4",
          className
        )}
        aria-label="Collapsed Sidebar"
      >
        <div className="flex flex-col items-center gap-4">
          <img src={logoSvg} alt="Alex" className="h-8 w-auto mb-2" />
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent text-muted-foreground"
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onNewChat}
          disabled={isAtWelcomeScreen}
          aria-label="Nuevo chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </nav>
    )
  }

  return (
    <nav className={cn("flex flex-col h-full bg-background border-r transition-all duration-300", className)} aria-label="Chat History Sidebar">
      <SidebarHeader
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={onToggleSidebar}
        onNewChat={onNewChat}
        isAtWelcomeScreen={isAtWelcomeScreen}
      />

      <Separator />

      <ConversationList
        searchQuery={state.searchQuery}
        setSearchQuery={(val) => dispatch({ type: "SET_FIELD", field: "searchQuery", value: val })}
        editingId={state.editingId}
        setEditingId={(val) => dispatch({ type: "SET_FIELD", field: "editingId", value: val })}
        editingTitle={state.editingTitle}
        setEditingTitle={(val) => dispatch({ type: "SET_FIELD", field: "editingTitle", value: val })}
        loading={loading}
        error={error}
        activeChatId={activeChatId}
        grouped={grouped}
        expandedGroups={state.expandedGroups}
        setExpandedGroups={(val) => dispatch({ type: "SET_FIELD", field: "expandedGroups", value: val })}
        handleChatSelect={handleChatSelect}
        startEditing={startEditing}
        saveEdit={saveEdit}
        handleKeyDown={handleKeyDown}
        handleDownload={handleDownload}
        handleDeleteConversation={handleDeleteConversation}
        downloadingId={state.downloadingId}
      />

      {/* Sidebar Footer with User Menu (Visible only on Mobile) */}
      <div className="p-4 border-t md:hidden shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-2">
            <p className="text-sm font-bold truncate text-foreground">
              {user.firstName || user.name}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <UserDropdown 
            user={user} 
            onLogout={onLogout} 
            onAdminClick={onAdminClick}
          />
        </div>
      </div>
    </nav>
  )
}
