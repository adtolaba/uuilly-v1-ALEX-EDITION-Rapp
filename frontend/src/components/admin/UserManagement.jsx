/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useReducer } from "react"
import { Search, UserPlus, Trash2, UserSearch, Loader2, Pencil } from "lucide-react"
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
import { UserForm } from "./UserForm"
import { getTagColor, cn } from "@/lib/utils"
import useUI from "../../hooks/useUI"
import { useUsers } from "../../hooks/useUsers"

const initialState = {
  searchQuery: "",
  isFormOpen: false,
  editingUser: null,
};

function userManagementReducer(state, action) {
  switch (action.type) {
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'OPEN_FORM':
      return { ...state, isFormOpen: true, editingUser: action.payload || null };
    case 'CLOSE_FORM':
      return { ...state, isFormOpen: false, editingUser: null };
    default:
      return state;
  }
}

/**
 * UserManagement component for viewing and managing system users.
 * Refactored: useReducer + TanStack Query.
 */
export function UserManagement({ currentUser }) {
  const ui = useUI()
  const isAdmin = currentUser?.role === "ADMIN"
  const isSupervisor = currentUser?.role === "SUPERVISOR"
  const [state, dispatch] = useReducer(userManagementReducer, initialState);

  // Fetch users via React Query
  const { data: users = [], isLoading, refetch } = useUsers();

  const handleDeleteUser = async (user) => {
    ui.confirm(
      "Eliminar Usuario",
      `¿Estás seguro de que deseas eliminar a ${user.email}?`,
      async () => {
        try {
          const token = localStorage.getItem("access_token")
          const response = await fetch(`/api/v1/users/${user.id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          if (response.ok) {
            ui.toast.success(`Usuario ${user.email} eliminado exitosamente`)
            refetch() // Invalidate/Refetch
          } else {
            const data = await response.json()
            ui.toast.error(data.detail || "Error al eliminar usuario")
          }
        } catch (error) {
          console.error("Error deleting user:", error)
          ui.toast.error("Error de conexión")
        }
      }
    )
  }

  const filteredUsers = users.filter(
    (user) => {
      const matchesSearch = user.email.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        (user.first_name && user.first_name.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
        (user.last_name && user.last_name.toLowerCase().includes(state.searchQuery.toLowerCase()));
      
      if (isAdmin) return matchesSearch;
      if (isSupervisor) return matchesSearch && user.role === "USER";
      return matchesSearch;
    }
  )

  return (
    <div className="flex flex-col h-full space-y-4 min-h-0">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuarios..."
            className="pl-8"
            value={state.searchQuery}
            onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
            autoComplete="off"
          />
        </div>
        <Button className="gap-2" onClick={() => dispatch({ type: 'OPEN_FORM' })}>
          <UserPlus className="h-4 w-4" />
          Añadir Usuario
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0 rounded-xl border bg-card/30 backdrop-blur-sm shadow-soft">
        <Table>
          <TableHeader className="bg-secondary sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pl-6">Usuario</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Rol</TableHead>
              <TableHead className="text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 px-6">Etiquetas</TableHead>
              <TableHead className="text-right text-[10px] 3xl:text-xs font-bold uppercase tracking-wider text-muted-foreground/50 py-3 pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center px-6">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Cargando usuarios...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center px-6">
                  <div className="flex justify-center">
                    <Alert className="max-w-xs border-dashed bg-muted/20">
                      <UserSearch className="h-4 w-4" />
                      <AlertDescription>No se encontraron usuarios que coincidan con la búsqueda.</AlertDescription>
                    </Alert>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="group/row">
                  <TableCell className="pl-6">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {user.first_name || user.last_name 
                          ? `${user.first_name || ""} ${user.last_name || ""}`.trim() 
                          : "Sin nombre"}
                      </span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(user.tags) && user.tags.length > 0 ? (
                        user.tags.map((tag) => {
                          const tagName = typeof tag === 'string' ? tag : tag?.name;
                          const colors = getTagColor(tagName);
                          return (
                            <Badge 
                              key={tag.id || tagName} 
                              variant="outline" 
                              className={cn("text-[10px] 3xl:text-xs px-1.5 py-0 border", colors.bg, colors.text, colors.border)}
                            >
                              {tagName}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin etiquetas</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                        onClick={() => dispatch({ type: 'OPEN_FORM', payload: user })}
                        title="Editar Usuario"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => handleDeleteUser(user)}
                        title="Eliminar Usuario"
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

      <UserForm 
        key={`user-form-${state.editingUser?.id || 'new'}`}
        open={state.isFormOpen} 
        onOpenChange={(open) => {
          if (!open) dispatch({ type: 'CLOSE_FORM' });
        }} 
        user={state.editingUser} 
        onSuccess={() => {
          refetch();
          dispatch({ type: 'CLOSE_FORM' });
        }} 
        currentUser={currentUser}
      />
    </div>
  )
}
