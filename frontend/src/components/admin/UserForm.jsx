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
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { X, ChevronDown, Tag, Loader2 } from "lucide-react"
import { cn, getTagColor } from "@/lib/utils"
import useUI from "../../hooks/useUI"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { useApi } from "../../hooks/useApi"

const initialState = {
  email: "",
  firstName: "",
  lastName: "",
  profilePhotoUrl: "",
  role: "USER",
  password: "",
  tags: [],
}

function userReducer(state, action) {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value }
    case "TOGGLE_TAG":
      return {
        ...state,
        tags: state.tags.includes(action.payload)
          ? state.tags.filter((t) => t !== action.payload)
          : [...state.tags, action.payload],
      }
    case "REMOVE_TAG":
      return { ...state, tags: state.tags.filter((t) => t !== action.payload) }
    case "RESET":
      return { ...initialState, ...action.payload }
    default:
      return state
  }
}

function initUserState(user) {
  if (!user) return initialState
  return {
    ...initialState,
    email: user.email || "",
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    profilePhotoUrl: user.profile_photo_url || "",
    role: user.role || "USER",
    tags: user.tags ? user.tags.map((t) => (typeof t === "string" ? t : t.name)) : [],
  }
}

/**
 * UserForm component for creating or editing user details.
 * Refactored: useReducer + useMutation + TanStack Query.
 */
export function UserForm({ user, open, onOpenChange, onSuccess, currentUser }) {
  const ui = useUI()
  const queryClient = useQueryClient()
  const { post, put, get } = useApi()
  const isAdmin = currentUser?.role === "ADMIN"
  
  const [state, dispatch] = useReducer(userReducer, user, initUserState)

  // Fetch Tags via React Query
  const { data: allGlobalTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => get("/api/v1/tags"),
    enabled: open && isAdmin,
  })

  const userMutation = useMutation({
    mutationFn: async (body) => {
      const url = user ? `/api/v1/users/${user.id}` : "/api/v1/users"
      return user ? put(url, body) : post(url, body)
    },
    onSuccess: () => {
      ui.toast.success(`Usuario ${state.email} guardado exitosamente`)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      if (onSuccess) onSuccess()
      onOpenChange(false)
    },
    onError: (error) => {
      console.error("Error saving user:", error)
      ui.toast.error("Error al guardar el usuario")
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const body = {
      email: state.email,
      first_name: state.firstName,
      last_name: state.lastName,
      profile_photo_url: state.profilePhotoUrl,
      role: state.role,
      tags: state.tags,
    }

    if (state.password) {
      body.password = state.password
    }

    userMutation.mutate(body)
  }

  const setField = (field) => (value) => dispatch({ type: "SET_FIELD", field, value })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[425px] overflow-y-auto custom-scrollbar">
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>{user ? "Editar Usuario" : "Añadir Nuevo Usuario"}</SheetTitle>
            <SheetDescription className="sr-only">
              Formulario para gestionar detalles de usuario y etiquetas.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                value={state.email}
                onChange={(e) => setField("email")(e.target.value)}
                placeholder="juan@ejemplo.com"
                required
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label htmlFor="first_name" className="text-sm font-medium">Nombre</label>
                <Input
                  id="first_name"
                  value={state.firstName}
                  onChange={(e) => setField("firstName")(e.target.value)}
                  placeholder="Juan"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="last_name" className="text-sm font-medium">Apellido</label>
                <Input
                  id="last_name"
                  value={state.lastName}
                  onChange={(e) => setField("lastName")(e.target.value)}
                  placeholder="Pérez"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="profile_photo_url" className="text-sm font-medium">URL de Foto de Perfil</label>
              <Input
                id="profile_photo_url"
                type="url"
                value={state.profilePhotoUrl}
                onChange={(e) => setField("profilePhotoUrl")(e.target.value)}
                placeholder="https://ejemplo.com/foto.jpg"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="role" className="text-sm font-medium">Rol</label>
              <Select 
                value={state.role} 
                onValueChange={setField("role")} 
                disabled={!isAdmin}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Usuario</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
              {!isAdmin && (
                <p className="text-[10px] text-muted-foreground italic">Solo los administradores pueden cambiar roles.</p>
              )}
            </div>

            {isAdmin && (
              <div className="grid gap-2">
                <label htmlFor="password" { ...{ className: "text-sm font-medium" } }>Contraseña (Opcional)</label>
                <Input
                  id="password"
                  type="password"
                  value={state.password}
                  onChange={(e) => setField("password")(e.target.value)}
                  placeholder={user ? "Dejar vacío para mantener actual" : "Establecer contraseña"}
                  autoComplete="new-password"
                />
                <p className="text-[10px] text-muted-foreground italic">Usuarios sin contraseña deben usar Google OAuth.</p>
              </div>
            )}
            
            <div className="grid gap-2 relative">
              <label className="text-sm font-medium">Etiquetas</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-between font-normal text-muted-foreground hover:text-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      <span>Seleccionar etiquetas...</span>
                    </div>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
                  <DropdownMenuLabel>Etiquetas Disponibles</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allGlobalTags.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground italic text-center">No hay etiquetas disponibles</div>
                  ) : (
                    allGlobalTags.map((tag) => (
                      <DropdownMenuCheckboxItem
                        key={tag.id}
                        checked={state.tags.includes(tag.name)}
                        onCheckedChange={() => dispatch({ type: "TOGGLE_TAG", payload: tag.name })}
                        onSelect={(e) => e.preventDefault()}
                      >
                        {tag.name}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {state.tags.map((tag) => {
                  const colors = getTagColor(tag);
                  return (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className={cn("pl-2 pr-1 py-0.5 gap-1 group transition-all border", colors.bg, colors.text, colors.border)}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => dispatch({ type: "REMOVE_TAG", payload: tag })}
                        className="rounded-full opacity-60 hover:opacity-100 hover:bg-muted p-0.5 transition-all"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                {state.tags.length === 0 && (
                  <span className="text-[10px] 3xl:text-xs text-muted-foreground italic">Sin etiquetas seleccionadas</span>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="pt-4 border-t">
            <Button type="submit" className="w-full" disabled={userMutation.isPending}>
              {userMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (user ? "Actualizar Usuario" : "Guardar Usuario")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
