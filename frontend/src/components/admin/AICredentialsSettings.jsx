/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, Key, Pencil } from "lucide-react"
import useUI from "@/hooks/useUI"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useAICredentials, useAICredentialsMutation } from "../../hooks/useAICredentials"

/**
 * AICredentialsSettings component for managing centralized AI credentials.
 * Refactored to use TanStack Query.
 */
export function AICredentialsSettings() {
  const { toast, confirm } = useUI()
  const [isAdding, setIsAdding] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState(null)
  
  // Queries & Mutations
  const { data: credentials = [], isLoading } = useAICredentials();
  const { createMutation, updateMutation, deleteMutation } = useAICredentialsMutation();

  const [formState, setFormState] = useState({
    name: 'Nueva Credencial',
    provider: 'OPENAI',
    api_key: '',
    is_active: true,
    tasks: ['titling', 'extraction']
  })

  const resetForm = () => {
    setIsAdding(false)
    setIsEditing(false)
    setEditingId(null)
    setFormState({ name: 'Nueva Credencial', provider: 'OPENAI', api_key: '', is_active: true, tasks: ['titling', 'extraction'] })
  }

  const handleSave = () => {
    if (!formState.name || (!isEditing && !formState.api_key)) {
      toast.error('Nombre y API Key son obligatorios')
      return
    }

    const payload = { ...formState }
    if (isEditing && !payload.api_key) {
      delete payload.api_key
    }

    if (isEditing) {
      updateMutation.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          toast.success('Credencial actualizada')
          resetForm()
        },
        onError: () => toast.error('Error al actualizar credencial')
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast.success('Credencial añadida')
          resetForm()
        },
        onError: () => toast.error('Error al añadir credencial')
      });
    }
  }

  const handleEdit = (cred) => {
    setFormState({
      name: cred.name,
      provider: cred.provider,
      api_key: '',
      is_active: cred.is_active,
      tasks: typeof cred.tasks === 'string' ? JSON.parse(cred.tasks) : cred.tasks
    })
    setEditingId(cred.id)
    setIsEditing(true)
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Eliminar Credencial",
      description: "¿Estás seguro de que deseas eliminar esta credencial? Los agentes que la usan podrían dejar de funcionar correctamente.",
      confirmLabel: "Eliminar",
      variant: "destructive"
    })

    if (!confirmed) return

    deleteMutation.mutate(id, {
      onSuccess: () => toast.success('Credencial eliminada'),
      onError: () => toast.error('Error al eliminar credencial')
    });
  }

  const toggleTask = (task) => {
    setFormState(prev => {
      const tasks = prev.tasks.includes(task)
        ? prev.tasks.filter(t => t !== task)
        : [...prev.tasks, task]
      return { ...prev, tasks }
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card className="border-muted-foreground/10 shadow-soft">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Credenciales de Inteligencia Central
            </CardTitle>
            <CardDescription className="text-sm">
              Gestiona las llaves API utilizadas para tareas de inteligencia en todo el sistema, como extracción de memoria y titulado automático.
            </CardDescription>
          </div>
          <Button 
            size="sm" 
            className="gap-2" 
            onClick={() => {
              if (isAdding) {
                resetForm()
              } else {
                setIsAdding(true)
              }
            }}
          >
            {isAdding ? "Cerrar Formulario" : <><Plus className="h-4 w-4" /> Añadir Nueva</>}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAdding && (
            <div className="p-4 rounded-lg bg-muted/30 border border-muted-foreground/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
              <h4 className="text-sm font-semibold">{isEditing ? `Editar: ${formState.name}` : "Nueva Credencial AI"}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="cred-name" className="text-xs font-medium">Nombre de la Credencial</label>
                  <Input 
                    id="cred-name"
                    placeholder="Cuenta OpenAI Trabajo" 
                    value={formState.name}
                    onChange={(e) => setFormState({...formState, name: e.target.value})}
                    size="sm"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="cred-provider" className="text-xs font-medium">Proveedor</label>
                  <Select 
                    value={formState.provider} 
                    onValueChange={(val) => setFormState({...formState, provider: val})}
                  >
                    <SelectTrigger id="cred-provider" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPENAI">OpenAI</SelectItem>
                      <SelectItem value="GEMINI">Google Gemini</SelectItem>
                      <SelectItem value="MISTRAL">Mistral AI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="cred-api-key" className="text-xs font-medium">API Key {isEditing && "(Dejar vacío para mantener actual)"}</label>
                  <Input 
                    id="cred-api-key"
                    type="password" 
                    placeholder={isEditing ? "••••••••••••" : "sk-..."}
                    value={formState.api_key}
                    onChange={(e) => setFormState({...formState, api_key: e.target.value})}
                    size="sm"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <span className="text-xs font-medium">Tareas Habilitadas</span>
                  <div className="flex flex-wrap gap-4 mt-1">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="task-titling" checked={formState.tasks.includes('titling')} onCheckedChange={() => toggleTask('titling')} />
                      <label htmlFor="task-titling" className="text-xs cursor-pointer">Titulado Automático</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="task-extraction" checked={formState.tasks.includes('extraction')} onCheckedChange={() => toggleTask('extraction')} />
                      <label htmlFor="task-extraction" className="text-xs cursor-pointer">Extracción de Memoria</label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEditing ? "Actualizar Credencial" : "Guardar Credencial")}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border border-muted-foreground/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-muted-foreground/10 text-muted-foreground text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Nombre</th>
                  <th className="px-4 py-2 font-medium">Proveedor</th>
                  <th className="px-4 py-2 font-medium">Tareas</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-foreground/10">
                {credentials.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">
                      No hay credenciales configuradas aún.
                    </td>
                  </tr>
                ) : (
                  credentials.map(cred => (
                    <tr key={cred.id} className="hover:bg-muted/20 group/row">
                      <td className="px-4 py-3 font-medium">
                        {cred.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {cred.provider}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(typeof cred.tasks === 'string' ? JSON.parse(cred.tasks) : cred.tasks).map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] uppercase">{t}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cred.is_active ? "success" : "outline"} className="text-[10px]">
                          {cred.is_active ? "ACTIVA" : "INACTIVA"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleEdit(cred)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(cred.id)} disabled={deleteMutation.isPending}>
                            {deleteMutation.isPending && deleteMutation.variables === cred.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
