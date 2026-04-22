/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Input } from "./ui/input"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import logoSvg from "../assets/branding/avatar_logo.svg"
import fireSvg from "../assets/branding/fire.svg"
import { AgentCard } from "./AgentCard"
import { useAgents } from "../hooks/useAgents"

const WelcomeHeader = ({ user, isManyAgents, searchQuery, setSearchQuery, integrated = false }) => (
  <div className={cn(
    "flex flex-col items-center space-y-3 3xl:space-y-4",
    integrated ? "mb-4 3xl:mb-6" : "mb-1.5 3xl:mb-3 shrink-0"
  )}>
    <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
      <img 
        src={logoSvg} 
        alt="Alex Branding" 
        className="h-16 md:h-24 3xl:h-32 w-auto mb-2.5 drop-shadow-lg"
      />
      <div className="text-center" id="welcome-title">
        <h2 className="text-xl md:text-2xl 3xl:text-3xl font-bold text-white flex items-center justify-center gap-2 transition-all">
          Hola, {user.firstName || user.name}
          <img src={fireSvg} alt="fire" className="h-5 w-5 md:h-7 md:w-7 animate-pulse" />
        </h2>
        <p className="text-primary text-[10px] 3xl:text-xs font-bold uppercase tracking-wider mt-1.5">
          Selecciona un asistente para comenzar una nueva conversación
        </p>
      </div>
    </div>

    {/* Search Input (Only if many agents) */}
    {isManyAgents && (
      <div className="w-full max-w-sm 3xl:max-w-md relative group transition-all">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 3xl:h-4 3xl:w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar asistentes..." 
          className="h-9 3xl:h-10 pl-9 3xl:pl-10 text-sm bg-background/50 backdrop-blur-sm border-muted-foreground/10 focus-visible:ring-primary/20"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
    )}
  </div>
);

export function WelcomeScreen({ user, onSelectAgent, selectedAgentId }) {
  const [searchQuery, setSearchQuery] = useState("")
  
  const { data: agents = [], isLoading, error } = useAgents({
    enabled: !!user?.id,
    select: (data) => {
      // Reorder agents: selectedAgentId comes first
      return [...data].sort((a, b) => {
        if (String(a.id) === selectedAgentId) return -1;
        if (String(b.id) === selectedAgentId) return 1;
        return 0;
      });
    }
  })

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agent.description && agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [agents, searchQuery]);

  if (!user) {
    return null;
  }

  const handleAgentClick = (agent) => {
    onSelectAgent(agent);
  }

  const isManyAgents = agents.length > 9;

  return (
    <main 
      className={cn(
        "flex-1 flex flex-col h-full w-full overflow-hidden",
        isManyAgents ? "pt-1 md:pt-1.5 3xl:pt-2" : "pt-6 md:pt-10 3xl:pt-16"
      )} 
      aria-labelledby="welcome-title"
    >
      {/* Anchored Header Section (if many agents) */}
      {isManyAgents && (
        <WelcomeHeader 
          user={user} 
          isManyAgents={isManyAgents} 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
        />
      )}

      {/* Scrollable Agent Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={cn(
          "min-h-full flex flex-col items-center px-4 pb-4",
          isManyAgents ? "pt-1" : "pt-4"
        )}>
          {/* Integrated Header Section (if few agents) */}
          {!isManyAgents && (
            <WelcomeHeader 
              user={user} 
              isManyAgents={isManyAgents} 
              searchQuery={searchQuery} 
              setSearchQuery={setSearchQuery}
              integrated={true} 
            />
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-12" aria-busy="true" aria-label="Loading assistants">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Card className="border-destructive/20 bg-destructive/5 max-w-md mx-auto" role="alert">
              <CardHeader className="text-center p-4">
                <CardTitle className="text-destructive text-sm font-bold">Connection Error</CardTitle>
                <CardDescription className="text-xs">{error.message || "Failed to fetch agents"}</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div 
              className="flex flex-wrap justify-center gap-4 3xl:gap-6 w-full max-w-5xl 3xl:max-w-7xl mx-auto"
              role="list"
              aria-label="Available AI assistants"
            >
              {filteredAgents.map(agent => (
                <div 
                  key={agent.id}
                  className="flex w-full sm:w-[calc(50%-8px)] lg:w-[calc(33.333%-11px)] max-w-[320px] 3xl:max-w-[380px] shrink-0"
                >
                  <AgentCard 
                    agent={agent} 
                    onClick={handleAgentClick} 
                    isSelected={String(agent.id) === selectedAgentId} 
                  />
                </div>
              ))}
              {!isLoading && filteredAgents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 space-y-2 w-full" role="status">
                  <p className="text-muted-foreground text-sm italic">
                    No se encontraron asistentes que coincidan con "{searchQuery}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
