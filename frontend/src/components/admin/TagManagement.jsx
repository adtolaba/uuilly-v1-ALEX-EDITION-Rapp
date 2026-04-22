/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer } from "react"
import { Search, Tag, Trash2, Plus, Loader2 } from "lucide-react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { getTagColor, cn } from "@/lib/utils"
import useUI from "../../hooks/useUI"
import { useTags, useTagsMutation } from "../../hooks/useTags"

const initialState = {
  searchQuery: "",
  newTagName: "",
};

function tagManagementReducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_NEW_TAG_NAME':
      return { ...state, newTagName: action.payload };
    case 'RESET_FORM':
      return { ...state, newTagName: "" };
    default:
      return state;
  }
}

/**
 * TagManagement component for viewing and managing global system tags.
 * Refactored: useReducer + TanStack Query.
 */
export function TagManagement() {
  const ui = useUI()
  const [state, dispatch] = useReducer(tagManagementReducer, initialState);

  // Queries & Mutations
  const { data: tags = [], isLoading } = useTags();
  const { createMutation, deleteMutation } = useTagsMutation();

  const handleCreateTag = (e) => {
    e.preventDefault()
    if (!state.newTagName.trim()) return

    createMutation.mutate(state.newTagName, {
      onSuccess: () => {
        ui.toast.success(`Etiqueta "${state.newTagName}" creada exitosamente`)
        dispatch({ type: 'RESET_FORM' })
      },
      onError: (err) => {
        ui.toast.error("Error al crear la etiqueta")
      }
    });
  }

  const handleDeleteTag = (tag) => {
    ui.confirm(
      "Eliminar Etiqueta",
      `¿Estás seguro de que deseas eliminar la etiqueta "${tag.name}"? Esto podría afectar a usuarios y agentes asociados.`,
      async () => {
        deleteMutation.mutate(tag.id, {
          onSuccess: () => {
            ui.toast.success(`Etiqueta "${tag.name}" eliminada exitosamente`)
          },
          onError: () => {
            ui.toast.error("Error al eliminar la etiqueta")
          }
        });
      }
    )
  }

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar etiquetas..."
            className="pl-8"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
            autoComplete="off"
          />
        </div>

        <form onSubmit={handleCreateTag} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Nueva etiqueta..."
            value={state.newTagName}
            onChange={(e) => dispatch({ type: 'SET_NEW_TAG_NAME', payload: e.target.value })}
            className="h-9"
            autoComplete="off"
          />
          <Button type="submit" size="sm" disabled={createMutation.isPending || !state.newTagName.trim()} className="shrink-0">
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Añadir Etiqueta
          </Button>
        </form>
      </div>

      <ScrollArea className="flex-1 min-h-0 rounded-xl border bg-card/30 backdrop-blur-sm shadow-soft">
        <Table>
          <TableHeader className="bg-secondary sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="w-[300px] text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pl-6">Nombre de Etiqueta</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Tipo</TableHead>
              <TableHead className="text-right text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center px-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando etiquetas...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredTags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center px-6">
                  No se encontraron etiquetas.
                </TableCell>
              </TableRow>
            ) : (
              filteredTags.map((tag) => (
                <TableRow key={tag.id} className="group/row">
                  <TableCell className="font-medium pl-6">
                    <div className="flex items-center gap-2">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {(() => {
                        const colors = getTagColor(tag.name);
                        return (
                          <Badge 
                            variant="outline" 
                            className={cn("text-[10px] 3xl:text-xs px-1.5 py-0 border", colors.bg, colors.text, colors.border)}
                          >
                            {tag.name}
                          </Badge>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <span className="text-xs text-muted-foreground capitalize">Global</span>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteTag(tag)}
                        disabled={deleteMutation.isPending && deleteMutation.variables === tag.id}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === tag.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  )
}
