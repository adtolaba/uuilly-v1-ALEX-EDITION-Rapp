/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer } from "react"
import { Search, Plus, Bot, Settings2, Trash2, Loader2, BrainCircuit, Info } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AgentForm } from "./AgentForm"
import { getTagColor, cn } from "@/lib/utils"
import useUI from "../../hooks/useUI"
import { useAgents } from "../../hooks/useAgents"

const initialState = {
  searchQuery: "",
  isFormOpen: false,
  editingAgent: null,
};

function agentManagementReducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'OPEN_FORM':
      return { ...state, isFormOpen: true, editingAgent: action.payload || null };
    case 'CLOSE_FORM':
      return { ...state, isFormOpen: false, editingAgent: null };
    default:
      return state;
  }
}

/**
 * AgentManagement component for configuring and managing AI assistants.
 * Refactored to use useReducer and TanStack Query.
 */
export function AgentManagement() {
  const ui = useUI()
  const [state, dispatch] = useReducer(agentManagementReducer, initialState);
  
  // Data Fetching via React Query
  const { data: agents = [], isLoading, refetch } = useAgents();

  const handleDeleteAgent = async (agent) => {
    if (!agent) return

    ui.confirm(
      "Eliminar Agente",
      `¿Estás seguro de que deseas eliminar a ${agent.name}?`,
      async () => {
        try {
          const token = localStorage.getItem("access_token")
          const response = await fetch(`/api/v1/agents/${agent.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (response.ok) {
            ui.toast.success(`Agente ${agent.name} eliminado exitosamente`)
            refetch() // Invalidate/Refetch
          } else {
            const data = await response.json()
            ui.toast.error(data.detail || "Error al eliminar agente")
          }
        } catch (error) {
          console.error("Error deleting agent:", error)
          ui.toast.error("Error de conexión")
        }
      }
    )
  }

  const filteredAgents = agents.filter((agent) =>
    (agent?.name || "").toLowerCase().includes(state.searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar agentes..."
            className="pl-8"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
            autoComplete="off"
          />
        </div>
        <Button className="gap-2" onClick={() => dispatch({ type: 'OPEN_FORM' })}>
          <Plus className="h-4 w-4" />
          Añadir Agente
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 rounded-xl border bg-card/30 backdrop-blur-sm shadow-soft">
        <Table>
          <TableHeader className="bg-secondary sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pl-6">Agente</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Tipo</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Estado</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Etiquetas</TableHead>
              <TableHead className="text-right text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center px-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando agentes...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAgents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center px-6">
                  <div className="flex justify-center">
                    <Alert className="max-w-xs border-dashed bg-muted/20">
                      <Info className="h-4 w-4" />
                      <AlertDescription>No se encontraron agentes que coincidan con la búsqueda.</AlertDescription>
                    </Alert>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAgents.map((agent) => (
                <TableRow key={agent?.id} className="group/row">
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 flex items-center justify-center bg-primary/10 rounded-md text-primary shrink-0 text-lg">
                        {agent?.icon || <Bot className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate">{agent?.name || "Sin nombre"}</span>
                          {agent?.memory_enabled && (
                            <BrainCircuit title="Memoria Activada" className="h-3.5 w-3.5 text-primary shrink-0 cursor-help" aria-label="Memoria Activada" />
                          )}
                        </div>
                        <span className="text-[10px] 3xl:text-xs text-muted-foreground truncate max-w-[200px]">
                          {agent?.url || "Sin URL"}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <span className="text-xs capitalize">{agent?.type || "desconocido"}</span>
                  </TableCell>
                  <TableCell className="px-6">
                    <Badge variant={agent?.is_active ? "default" : "secondary"} className="text-[10px] 3xl:text-xs px-1.5 py-0">
                      {agent?.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex flex-wrap gap-1">
                      {agent?.tags?.length > 0 ? (
                         agent.tags.map((tag) => {
                          const tagName = typeof tag === 'string' ? tag : tag?.name;
                          if (!tagName) return null;
                          const colors = getTagColor(tagName);
                          return (
                            <Badge 
                              key={tag?.id || tagName} 
                              variant="outline" 
                              className={cn("text-[10px] 3xl:text-xs px-1.5 py-0 whitespace-nowrap border", colors.bg, colors.text, colors.border)}
                            >
                              {tagName}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-[10px] 3xl:text-xs text-muted-foreground italic">Sin etiquetas</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => dispatch({ type: 'OPEN_FORM', payload: agent })}
                        title="Editar Agente"
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => handleDeleteAgent(agent)}
                        title="Eliminar Agente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      <AgentForm 
        key={`agent-form-${state.editingAgent?.id || 'new'}`}
        open={state.isFormOpen} 
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CLOSE_FORM' });
        }} 
        agent={state.editingAgent} 
        onSuccess={() => {
          refetch();
          dispatch({ type: 'CLOSE_FORM' });
        }} 
      />
    </div>
  )
}
