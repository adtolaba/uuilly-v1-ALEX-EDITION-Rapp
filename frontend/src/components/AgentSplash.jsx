/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useMemo } from "react"
import { Bot, MessageSquare, Clock, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import useChatStore from "../store/chatStore"

export function AgentSplash({ agentName, agentDescription, onSelectConversation, selectedAgentId, agentIcon }) {
  const { conversations } = useChatStore()

  // Filter conversations for this specific agent and get the 3 most recent
  const recentAgentConversations = useMemo(() => {
    if (!conversations || !selectedAgentId) return []
    
    return Object.values(conversations)
      .flat()
      .filter(conv => String(conv.agent_id) === String(selectedAgentId))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 3)
  }, [conversations, selectedAgentId])

  return (
    <div className="relative flex-1 flex flex-col items-center p-6 h-full">
      {/* Dynamic Spacer to push content down from the top without strict centering */}
      <div className="flex-[0.3] min-h-[5vh]" />

      {/* Main Content (Ethereal & Minimalist) */}
      <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-1000">
        
        {/* Agent Identity */}
        <div className="space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center ring-1 ring-primary/10 text-5xl">
            {agentIcon || <Bot className="w-12 h-12 text-primary/60" />}
          </div>
          
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-foreground/90">
              {agentName}
            </h2>
            {agentDescription && (
              <p className="text-muted-foreground/80 text-sm max-w-xl md:max-w-2xl mx-auto leading-relaxed px-4 md:px-0">
                {agentDescription}
              </p>
            )}
          </div>
        </div>

        {/* Recent Activity (Modern Pills) */}
        {recentAgentConversations.length > 0 && (
          <div className="w-full space-y-5">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
              <Clock className="w-3 h-3" />
              Conversaciones recientes
            </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {recentAgentConversations.map(conv => (
                <Button
                  key={conv.id}
                  variant="ghost"
                  className="h-auto py-2 px-4 rounded-full border border-muted/20 bg-muted/5 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all group flex items-center gap-2"
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <span className="text-xs font-medium max-w-[150px] truncate">{conv.title}</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 -translate-y-0.5 group-hover:opacity-100 transition-all" />
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Start Guide */}
        <div className="pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-[11px] font-semibold text-primary/60 border border-primary/10">
            <MessageSquare className="w-3 h-3" />
            Envía un mensaje para comenzar un nuevo chat
          </div>
        </div>
      </div>

      {/* Bottom Spacer to account for the fixed/floating input box area */}
      <div className="flex-1 pb-20" />
    </div>
  )
}
