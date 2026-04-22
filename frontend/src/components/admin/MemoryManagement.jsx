/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Trash2, Search, BrainCircuit, User, Bot, Clock, Plus, X, Settings2, Save, Pencil, UploadCloud, FileText } from "lucide-react"
import useUI from "@/hooks/useUI"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn, normalizeProvider } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AdvancedSearchModal } from "./AdvancedSearchModal"
import { useMemories, useMemoriesMutation } from "../../hooks/useMemories"
import { useAgents } from "../../hooks/useAgents"
import { useUsers } from "../../hooks/useUsers"
import { useSettings, useSettingsMutation, useModels } from "../../hooks/useSettings"
import { useAICredentials } from "../../hooks/useAICredentials"
import { useLLMConfig } from "../../hooks/useLLMConfig"

const initialState = {
  searchTerm: "",
  selectedAgentId: "all",
  selectedUserId: "all",
  memoryType: "all",
  accordionValue: "",
  selectedIds: [],
  isAdding: false,
  editingFact: null,
  showBulkModal: false,
  bulkFile: null,
  bulkAgentId: "",
  newFact: { fact: "", agent_id: "", user_id: null }
};

function memoryReducer(state, action) {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'TOGGLE_SELECT':
      const id = action.payload;
      return {
        ...state,
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter(i => i !== id)
          : [...state.selectedIds, id]
      };
    case 'SELECT_ALL':
      return { ...state, selectedIds: action.payload };
    case 'OPEN_ADD_FORM':
      return { ...state, isAdding: true, editingFact: null };
    case 'OPEN_EDIT_FORM':
      return { ...state, isAdding: false, editingFact: action.payload };
    case 'CLOSE_FORM':
      return { ...state, isAdding: false, editingFact: null, newFact: { fact: "", agent_id: "", user_id: null } };
    case 'UPDATE_NEW_FACT':
      return { ...state, newFact: { ...state.newFact, ...action.payload } };
    case 'UPDATE_EDITING_FACT':
      return { ...state, editingFact: { ...state.editingFact, ...action.payload } };
    case 'RESET_BULK_MODAL':
      return { ...state, showBulkModal: false, bulkFile: null, bulkAgentId: "" };
    default:
      return state;
  }
}

/**
 * MemoryManagement component for viewing, filtering and creating atomic facts.
 * Refactored: useReducer + TanStack Query.
 */
export function MemoryManagement({ currentUser }) {
  const { toast, confirm } = useUI()
  const isAdmin = currentUser?.role === 'ADMIN'
  const [state, dispatch] = useReducer(memoryReducer, initialState);

  // Queries
  const { data: memories = [], isLoading: loadingMemories, refetch: refetchMemories } = useMemories({
    agentId: state.selectedAgentId,
    userId: state.selectedUserId,
    memoryType: state.memoryType
  });

  const { data: agents = [] } = useAgents();
  const { data: settings, isLoading: loadingSettings } = useSettings();
  const { data: aicredentials = [] } = useAICredentials();
  
  // LLM Config logic using the new shared hook
  const llmConfig = useLLMConfig({
    initialProvider: settings?.llm_provider,
    initialCredentialId: settings?.active_extraction_cred_id,
    initialModel: settings?.memory_extraction_model,
    credentials: aicredentials,
    task: 'extraction'
  });

  // Sync with settings when they load or update
  const [hasSynced, setHasSynced] = React.useState(false);
  useEffect(() => {
    if (settings && !loadingSettings && !hasSynced) {
      llmConfig.sync({
        provider: settings.llm_provider,
        credentialId: settings.active_extraction_cred_id,
        model: settings.memory_extraction_model
      });
      setHasSynced(true);
    }
  }, [settings, loadingSettings, hasSynced]);
  
  // Mutations
  const { 
    createMutation, 
    updateMutation, 
    deleteMutation, 
    bulkDeleteMutation, 
    bulkUploadMutation 
  } = useMemoriesMutation();
  
  const { updateMutation: updateSettingsMutation, resetPromptMutation } = useSettingsMutation();

  useEffect(() => {
    const handleRefresh = () => refetchMemories();
    window.addEventListener('refresh-memories', handleRefresh);
    return () => window.removeEventListener('refresh-memories', handleRefresh);
  }, [refetchMemories]);

  const handleFilterChange = (filters) => {
    dispatch({ type: 'SET_FIELD', field: 'selectedAgentId', value: filters.agentId });
    dispatch({ type: 'SET_FIELD', field: 'selectedUserId', value: filters.userId });
    dispatch({ type: 'SET_FIELD', field: 'memoryType', value: filters.memoryType });
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate({
      ...settings,
      llm_provider: llmConfig.provider,
      active_extraction_cred_id: llmConfig.credentialId,
      memory_extraction_model: llmConfig.model
    }, {
      onSuccess: () => {
        setHasSynced(false); // Force re-sync with new settings
        toast.success('Configuración de extracción guardada');
        dispatch({ type: 'SET_FIELD', field: 'accordionValue', value: "" });
      }
    });
  };

  const handleResetPrompt = () => {
    resetPromptMutation.mutate(null, {
      onSuccess: () => toast.success('Prompt restablecido')
    });
  };

  const handleBulkDelete = () => {
    if (state.selectedIds.length === 0) return;
    confirm("Eliminar recuerdos en lote", `Estás a punto de eliminar ${state.selectedIds.length} recuerdos. Esta acción no se puede deshacer.`, () => {
      bulkDeleteMutation.mutate(state.selectedIds, {
        onSuccess: () => {
          toast.success(`${state.selectedIds.length} recuerdos eliminados`);
          dispatch({ type: 'SET_FIELD', field: 'selectedIds', value: [] });
        }
      });
    });
  };

  const handleCreate = () => {
    if (!state.newFact.fact || !state.newFact.agent_id) {
      toast.error('Hecho y Agente son obligatorios');
      return;
    }
    createMutation.mutate({ ...state.newFact, agent_id: parseInt(state.newFact.agent_id) }, {
      onSuccess: () => {
        toast.success('Hecho añadido exitosamente');
        dispatch({ type: 'CLOSE_FORM' });
      }
    });
  };

  const handleUpdate = () => {
    if (!state.editingFact?.fact) {
      toast.error('El contenido del hecho es obligatorio');
      return;
    }
    updateMutation.mutate({ id: state.editingFact.id, data: { fact: state.editingFact.fact } }, {
      onSuccess: () => {
        toast.success('Recuerdo actualizado exitosamente');
        dispatch({ type: 'CLOSE_FORM' });
      }
    });
  };

  const handleBulkUpload = () => {
    if (!state.bulkFile || !state.bulkAgentId) {
      toast.error('Archivo y Agente son obligatorios');
      return;
    }
    const formData = new FormData();
    formData.append('file', state.bulkFile);
    formData.append('agent_id', state.bulkAgentId);
    formData.append('provider', settings?.llm_provider || 'openai');
    if (settings?.memory_extraction_model) formData.append('model', settings.memory_extraction_model);

    bulkUploadMutation.mutate(formData, {
      onSuccess: () => {
        toast.success('Carga masiva iniciada', { description: "Alex está atomizando el conocimiento en segundo plano." });
        dispatch({ type: 'RESET_BULK_MODAL' });
      }
    });
  };

  const handleDelete = (id) => {
    confirm("Eliminar recuerdo", "Este hecho será eliminado permanentemente y los agentes ya no lo recordarán.", () => {
      deleteMutation.mutate(id, {
        onSuccess: () => toast.success('Recuerdo eliminado')
      });
    });
  };

  const filteredMemories = memories.filter(m => 
    m.fact.toLowerCase().includes(state.searchTerm.toLowerCase()) ||
    m.agent?.name.toLowerCase().includes(state.searchTerm.toLowerCase())
  );

  const hasActiveFilters = state.selectedAgentId !== "all" || state.selectedUserId !== "all" || state.memoryType !== "all";

  if (loadingMemories && memories.length === 0) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 h-full flex flex-col pt-2 max-w-[1600px] mx-auto w-full min-h-0">
      {isAdmin && (
        <Accordion type="single" collapsible className="w-full border rounded-xl bg-muted/20 px-4 shrink-0 shadow-soft" value={state.accordionValue} onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'accordionValue', value: val })}>
          <AccordionItem value="settings" className="border-b-0">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Settings2 className="h-4 w-4 text-primary" />
                Configuración de Extracción de Memoria
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground/70">Proveedor de Extracción</label>
                  <Select value={llmConfig.provider || 'openai'} onValueChange={llmConfig.setProvider}>
                    <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-muted-foreground/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                      <SelectItem value="mistral">Mistral AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground/70">Credencial Activa</label>
                  <Select 
                    value={llmConfig.credentialId?.toString() || "none"} 
                    onValueChange={llmConfig.setCredentialId}
                    disabled={llmConfig.filteredCredentials.length === 0}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-muted-foreground/10">
                      <SelectValue placeholder="Seleccionar credencial..." />
                    </SelectTrigger>
                    <SelectContent>
                      {llmConfig.filteredCredentials.length > 0 ? (
                        llmConfig.filteredCredentials.map(c => (
                          <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>Sin credenciales para este proveedor</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {llmConfig.filteredCredentials.length === 0 && (
                    <p className="text-[10px] text-destructive font-medium italic animate-pulse mt-1">
                      ⚠️ No se encontraron llaves para {llmConfig.provider}. Añade una en la pestaña "Llaves AI" con la tarea 'extraction' activada.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground/70">Modelo de Extracción</label>
                  <Select value={llmConfig.model || ''} onValueChange={llmConfig.setModel} disabled={llmConfig.availableModels.length === 0}>
                    <SelectTrigger className="h-9 text-xs bg-background rounded-lg border-muted-foreground/10">
                      <SelectValue placeholder={llmConfig.fetchingModels ? "Cargando modelos..." : "Seleccionar modelo..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {llmConfig.availableModels.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-medium text-muted-foreground/70">Prompt de Extracción</label>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleResetPrompt}>Restablecer predeterminado</Button>
                  </div>
                  <textarea className="flex min-h-[100px] w-full rounded-xl border border-muted-foreground/10 bg-background/50 px-4 py-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 transition-all resize-none 3xl:text-xs" value={settings?.memory_extraction_prompt || ''} onChange={(e) => updateSettingsMutation.mutate({...settings, memory_extraction_prompt: e.target.value})} placeholder="System prompt para extracción de memoria..." />
                  <p className="text-[10px] text-muted-foreground italic opacity-70">Usa {`{message}`} como marcador para el contenido de la conversación.</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" className="h-10 px-6 gap-2 rounded-xl shadow-soft" onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending}>{updateSettingsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar Configuración</Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 px-1">
        <div className="flex flex-1 gap-3 w-full">
          {state.selectedIds.length > 0 ? (
            <div className="flex items-center gap-4 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2 animate-in fade-in slide-in-from-left-2 duration-200 shadow-soft">
              <span className="text-sm font-bold text-destructive">{state.selectedIds.length} seleccionados</span>
              <div className="h-4 w-[1px] bg-destructive/20" />
              <Button variant="destructive" size="sm" className="h-9 px-4 text-xs font-bold uppercase tracking-wider shadow-md" onClick={handleBulkDelete} disabled={bulkDeleteMutation.isPending}>{bulkDeleteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />} Eliminar Seleccionados</Button>
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => dispatch({ type: 'SET_FIELD', field: 'selectedIds', value: [] })}>Cancelar</Button>
            </div>
          ) : (
            <>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar hechos..." className="pl-10 h-10 text-sm bg-background/50 border-muted-foreground/10 focus:border-primary/30 transition-all rounded-xl shadow-soft" value={state.searchTerm} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'searchTerm', value: e.target.value })} />
              </div>
              <AdvancedSearchModal key={`advanced-search-${state.selectedAgentId}-${state.selectedUserId}-${state.memoryType}`} agents={agents} onFilterChange={handleFilterChange} currentFilters={{ agentId: state.selectedAgentId, userId: state.selectedUserId, memoryType: state.memoryType }} />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-10 px-4 gap-2 rounded-xl shadow-soft" onClick={() => dispatch({ type: 'SET_FIELD', field: 'showBulkModal', value: true })}><UploadCloud className="h-4 w-4 text-primary" /><span className="hidden lg:inline">Carga Masiva</span><span className="lg:hidden">Bulk</span></Button>
          <Button size="sm" className="h-10 px-5 gap-2 rounded-xl shadow-md" onClick={() => dispatch({ type: state.isAdding ? 'CLOSE_FORM' : 'OPEN_ADD_FORM' })}><Plus className="h-4 w-4" /> Añadir Hecho</Button>
        </div>
      </div>

      {(state.isAdding || state.editingFact) && (
        <div className="p-5 rounded-xl bg-primary/5 border border-primary/10 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-2">{state.isAdding ? <Plus className="h-4 w-4 text-primary" /> : <Pencil className="h-4 w-4 text-primary" />}{state.isAdding ? "Añadir Nuevo Hecho Atómico" : "Editar Hecho Atómico"}</h4>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => dispatch({ type: 'CLOSE_FORM' })}><X className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Agente AI</label>
              {state.isAdding ? (
                <Select value={state.newFact.agent_id} onValueChange={(val) => dispatch({ type: 'UPDATE_NEW_FACT', payload: { agent_id: val } })}>
                  <SelectTrigger className="h-10 text-xs bg-background border-muted-foreground/10 rounded-lg"><SelectValue placeholder="Seleccionar agente..." /></SelectTrigger>
                  <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <div className="h-10 px-3 flex items-center bg-muted/50 rounded-lg border border-transparent text-xs text-muted-foreground">{state.editingFact.agent?.name || "N/A"}</div>}
            </div>
            <div className="md:col-span-3 space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Descripción del Hecho Atómico</label>
              <Input placeholder="¿Qué aprendió Alex?" value={state.isAdding ? state.newFact.fact : state.editingFact.fact} onChange={(e) => state.isAdding ? dispatch({ type: 'UPDATE_NEW_FACT', payload: { fact: e.target.value } }) : dispatch({ type: 'UPDATE_EDITING_FACT', payload: { fact: e.target.value } })} className="h-10 text-sm bg-background border-muted-foreground/10 rounded-lg" autoFocus />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-muted-foreground/5">
            <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'CLOSE_FORM' })}>Cancelar</Button>
            <Button size="sm" className="px-6 rounded-lg" onClick={state.isAdding ? handleCreate : handleUpdate} disabled={createMutation.isPending || updateMutation.isPending || (state.isAdding ? (!state.newFact.fact || !state.newFact.agent_id) : !state.editingFact.fact)}>{(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{state.isAdding ? "Guardar Hecho" : "Actualizar Hecho"}</Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden border rounded-xl border-muted-foreground/10 bg-card/30 backdrop-blur-sm shadow-soft flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse table-fixed">
            <thead className="bg-secondary sticky top-0 z-10 border-b border-muted-foreground/10 text-muted-foreground text-[10px] 3xl:text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-4 w-[50px] text-center"><Checkbox checked={filteredMemories.length > 0 && state.selectedIds.length === filteredMemories.length} onCheckedChange={(checked) => dispatch({ type: 'SELECT_ALL', payload: checked ? filteredMemories.map(m => m.id) : [] })} className="translate-y-[2px]" /></th>
                <th className="px-4 py-4 font-bold text-muted-foreground/70">Hecho Atómico</th>
                <th className="px-4 py-4 w-[200px] font-bold text-muted-foreground/70">Contexto / Agente</th>
                <th className="px-4 py-4 w-[120px] font-bold text-muted-foreground/70">Aprendido</th>
                <th className="px-4 py-4 w-[100px] font-bold text-muted-foreground/70 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-foreground/10">
              {filteredMemories.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-20 text-center text-muted-foreground italic text-sm"><div className="flex flex-col items-center gap-3 opacity-40"><Search className="h-10 w-10 mb-2" />{state.searchTerm || hasActiveFilters ? "No se encontraron recuerdos con los filtros actuales." : "Alex aún no ha aprendido ningún hecho."}</div></td></tr>
              ) : filteredMemories.map(m => (
                <tr key={m.id} className={cn("hover:bg-muted/20 transition-all group border-b border-muted-foreground/5 last:border-0", state.selectedIds.includes(m.id) && "bg-primary/5 shadow-inner")}>
                  <td className="px-4 py-5 text-center"><Checkbox checked={state.selectedIds.includes(m.id)} onCheckedChange={() => dispatch({ type: 'TOGGLE_SELECT', payload: m.id })} className="translate-y-[2px]" /></td>
                  <td className="px-4 py-5 align-top"><div className="flex gap-3"><div className="p-2 rounded-lg bg-primary/5 text-primary shrink-0 h-fit mt-0.5 group-hover:bg-primary/10 transition-colors"><BrainCircuit className="h-4 w-4" /></div><div className="space-y-1.5 min-w-0 flex-1"><span className="leading-relaxed text-[13px] 3xl:text-sm font-medium text-foreground/90 block whitespace-normal break-words">{m.fact}</span><span className="text-[10px] text-muted-foreground/50 font-mono">ID: {m.id}</span></div></div></td>
                  <td className="px-4 py-5 align-top"><div className="space-y-2"><div className="flex items-center gap-2 text-[11px] font-bold text-foreground/80 truncate"><Bot className="h-3.5 w-3.5 text-primary/60 shrink-0" /><span className="truncate">{m.agent?.name || 'Agente Eliminado'}</span></div><div>{m.user_id ? <div className="flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-500/5 px-2 py-0.5 rounded border border-blue-200/30 w-fit max-w-full"><User className="h-3 w-3 shrink-0" /><span className="truncate">{m.user?.email || `Usuario ${m.user_id}`}</span></div> : <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-200/30 font-bold w-fit"><Settings2 className="h-3 w-3 shrink-0" />GLOBAL</div>}</div></div></td>
                  <td className="px-4 py-5 align-top"><div className="flex flex-col gap-1 text-muted-foreground/80"><div className="flex items-center gap-1.5 text-[11px] font-medium"><Clock className="h-3 w-3.5 opacity-60" />{new Date(m.created_at).toLocaleDateString()}</div><span className="text-[9px] ml-5 opacity-50 italic">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></td>
                  <td className="px-4 py-5 text-right align-top"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-lg" onClick={() => dispatch({ type: 'OPEN_EDIT_FORM', payload: {...m} })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg" onClick={() => handleDelete(m.id)} disabled={deleteMutation.isPending && deleteMutation.variables === m.id}>{deleteMutation.isPending && deleteMutation.variables === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={state.showBulkModal} onOpenChange={(open) => !open && dispatch({ type: 'RESET_BULK_MODAL' })}>
        <DialogContent className="sm:max-w-[425px] rounded-xl border-muted-foreground/10 shadow-soft-xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5 text-primary" />Sincronización de Conocimiento</DialogTitle><DialogDescription className="text-xs">Sube documentos para entrenar la memoria colectiva de Alex.</DialogDescription></DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">1. Selecciona el Asistente Destino</label><Select value={state.bulkAgentId} onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'bulkAgentId', value: val })}><SelectTrigger className="h-10 text-xs rounded-lg border-muted-foreground/10"><SelectValue placeholder="¿Quién debería aprender esto?" /></SelectTrigger><SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">2. Subir Archivo (.txt, .md)</label><div className="border-2 border-dashed border-muted-foreground/10 rounded-xl p-6 text-center hover:border-primary/30 transition-all bg-muted/5 group cursor-pointer relative"><input type="file" accept=".txt,.md" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'bulkFile', value: e.target.files[0] })} /><div className="flex flex-col items-center gap-2">{state.bulkFile ? <div className="flex flex-col items-center gap-1 text-primary animate-in zoom-in-95 duration-200"><FileText className="h-8 w-8" /><span className="text-xs font-bold truncate max-w-[200px]">{state.bulkFile.name}</span></div> : <><UploadCloud className="h-8 w-8 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" /><span className="text-xs text-muted-foreground font-medium">Selecciona o arrastra el archivo aquí</span></>}</div></div></div>
          </div>
          <DialogFooter className="bg-muted/20 -mx-6 -mb-6 p-4 mt-2 rounded-b-xl border-t border-muted-foreground/5"><Button variant="ghost" className="rounded-lg" onClick={() => dispatch({ type: 'RESET_BULK_MODAL' })} disabled={bulkUploadMutation.isPending}>Cancelar</Button><Button className="rounded-lg px-6 shadow-md" onClick={handleBulkUpload} disabled={bulkUploadMutation.isPending || !state.bulkFile || !state.bulkAgentId}>{bulkUploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}{bulkUploadMutation.isPending ? "Procesando..." : "Empezar Aprendizaje"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
