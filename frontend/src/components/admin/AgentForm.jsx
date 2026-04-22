/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Bot, Loader2 } from "lucide-react"
import useUI from "../../hooks/useUI"
import { AgentGeneralInfo } from "./agent/AgentGeneralInfo"
import { AgentLLMSettings } from "./agent/AgentLLMSettings"
import { AgentMemoryConfig } from "./agent/AgentMemoryConfig"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { useApi } from "../../hooks/useApi"
import { useTags } from "../../hooks/useTags"
import { useAICredentials } from "../../hooks/useAICredentials"

const initialState = {
  name: "",
  description: "",
  type: "n8n",
  url: "",
  flowiseHost: "http://localhost:3001",
  flowiseId: "",
  isActive: true,
  isStreamingEnabled: false,
  icon: "",
  isEmojiPickerOpen: false,
  agentAuthStrategy: "NONE",
  agentAuthHeaderName: "X-Api-Key",
  agentAuthSecret: "",
  memoryEnabled: false,
  memoryScope: "INDIVIDUAL",
  tags: [],
}

function agentReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value }
    case "SET_STATE":
      return { ...state, ...action.payload }
    case "RESET":
      return { ...initialState, ...action.payload }
    default:
      return state
  }
}

/**
 * Helper to initialize state from agent prop
 */
function initAgentState(agent) {
  if (!agent) return initialState

  let flowiseHost = "http://localhost:3001"
  let flowiseId = ""
  let url = agent.url || ""

  if (agent.type === "flowise" && agent.url) {
    const parts = agent.url.split("/api/v1/prediction/")
    if (parts.length === 2) {
      flowiseHost = parts[0]
      flowiseId = parts[1]
    }
  }

  return {
    ...initialState,
    name: agent.name || "",
    description: agent.description || "",
    type: agent.type || "n8n",
    url: url,
    flowiseHost,
    flowiseId,
    isActive: agent.is_active ?? true,
    isStreamingEnabled: agent.is_streaming_enabled ?? false,
    icon: agent.icon || "",
    agentAuthStrategy: agent.agent_auth_strategy || "NONE",
    agentAuthHeaderName: agent.agent_auth_header_name || "X-Api-Key",
    agentAuthSecret: agent.agent_auth_secret || "",
    memoryEnabled: agent.memory_enabled || false,
    memoryScope: agent.memory_scope || "INDIVIDUAL",
    tags: agent.tags ? agent.tags.map((t) => (typeof t === "string" ? t : t.name)) : [],
  }
}

/**
 * AgentForm component for creating or editing AI assistant configurations.
 * Refactored: useReducer + TanStack Query + Mutation.
 */
export function AgentForm({ agent, open, onOpenChange, onSuccess }) {
  const ui = useUI()
  const queryClient = useQueryClient()
  const { post, put } = useApi()
  const [state, dispatch] = useReducer(agentReducer, agent, initAgentState)

  // Fetch external data via React Query
  const { data: allGlobalTags = [] } = useTags({ enabled: open });
  const { data: credentials = [] } = useAICredentials({ enabled: open });

  const hasMemoryCredentials = credentials.some(
    (c) =>
      c.is_active &&
      (typeof c.tasks === "string" ? JSON.parse(c.tasks) : c.tasks).includes("extraction")
  )

  const agentMutation = useMutation({
    mutationFn: async (body) => {
      const url = agent ? `/api/v1/agents/${agent.id}` : "/api/v1/agents"
      return agent ? put(url, body) : post(url, body)
    },
    onSuccess: () => {
      ui.toast.success(`Agente ${state.name} guardado exitosamente`)
      queryClient.invalidateQueries({ queryKey: ["agents"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      if (onSuccess) onSuccess()
      onOpenChange(false)
    },
    onError: (error) => {
      console.error("Error saving agent:", error)
      ui.toast.error("Error al guardar el agente")
    }
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    let finalUrl = state.url
    if (state.type === "flowise") {
      const host = state.flowiseHost.replace(/\/$/, "")
      finalUrl = `${host}/api/v1/prediction/${state.flowiseId}`
    }

    const body = {
      name: state.name,
      description: state.description,
      type: state.type,
      url: finalUrl,
      is_active: state.isActive,
      is_streaming_enabled: state.isStreamingEnabled,
      icon: state.icon,
      agent_auth_strategy: state.agentAuthStrategy,
      agent_auth_header_name: state.agentAuthStrategy === "HEADER" ? state.agentAuthHeaderName : null,
      agent_auth_secret: state.agentAuthSecret,
      memory_enabled: state.memoryEnabled,
      memory_scope: state.memoryScope,
      config: "{}",
      tags: state.tags,
    }

    agentMutation.mutate(body)
  }

  const setField = (field) => (value) => dispatch({ type: "SET_FIELD", field, value })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[450px] overflow-y-auto custom-scrollbar">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-6 w-6 text-primary" />
              <SheetTitle>{agent ? "Editar Agente" : "Crear Nuevo Agente"}</SheetTitle>
            </div>
            <SheetDescription className="sr-only">Formulario para gestionar la configuración del agente.</SheetDescription>
          </SheetHeader>

          <div className="space-y-6 py-4">
            <AgentGeneralInfo
              name={state.name}
              setName={setField("name")}
              icon={state.icon}
              setIcon={setField("icon")}
              description={state.description}
              setDescription={setField("description")}
              tags={state.tags}
              setTags={setField("tags")}
              allGlobalTags={allGlobalTags}
              isEmojiPickerOpen={state.isEmojiPickerOpen}
              setIsEmojiPickerOpen={setField("isEmojiPickerOpen")}
            />

            <AgentLLMSettings
              type={state.type}
              setType={setField("type")}
              url={state.url}
              setUrl={setField("url")}
              flowiseHost={state.flowiseHost}
              setFlowiseHost={setField("flowiseHost")}
              flowiseId={state.flowiseId}
              setFlowiseId={setField("flowiseId")}
              isActive={state.isActive}
              setIsActive={setField("isActive")}
              isStreamingEnabled={state.isStreamingEnabled}
              setIsStreamingEnabled={setField("isStreamingEnabled")}
              agentAuthStrategy={state.agentAuthStrategy}
              setAgentAuthStrategy={setField("agentAuthStrategy")}
              agentAuthHeaderName={state.agentAuthHeaderName}
              setAgentAuthHeaderName={setField("agentAuthHeaderName")}
              agentAuthSecret={state.agentAuthSecret}
              setAgentAuthSecret={setField("agentAuthSecret")}
              isEditMode={!!agent}
            />

            <AgentMemoryConfig
              memoryEnabled={state.memoryEnabled}
              setMemoryEnabled={setField("memoryEnabled")}
              memoryScope={state.memoryScope}
              setMemoryScope={setField("memoryScope")}
              hasMemoryCredentials={hasMemoryCredentials}
            />
          </div>

          <SheetFooter className="pt-4 border-t">
            <Button type="submit" className="w-full" disabled={agentMutation.isPending}>
              {agentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (agent ? "Actualizar Agente" : "Crear Agente")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
