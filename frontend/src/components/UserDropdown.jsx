/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from "react"
import { Settings, LogOut, User } from "lucide-react"
import { useNavigate } from 'react-router-dom'
import { UserAvatar } from "./UserAvatar"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { cn, getUserColor } from "@/lib/utils"

export function UserDropdown({ user, onLogout, onAdminClick }) {
  const navigate = useNavigate();

  // Callback for navigating to admin panel within the shell
  const handleGoToSettings = () => {
    if (onAdminClick) {
      onAdminClick();
    } else {
      console.log("Navigating to Admin Panel/Settings (legacy)")
      navigate('/admin'); 
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 3xl:h-10 3xl:w-10 p-0 rounded-full">
          <UserAvatar user={user} className="h-9 w-9 3xl:h-10 3xl:w-10" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 3xl:w-64" align="end" forceMount>
        <DropdownMenuLabel className="font-normal p-2 3xl:p-3">
          <div className="flex flex-col space-y-1 3xl:space-y-2">
            <p className="text-sm 3xl:text-sm font-medium leading-none">
              {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : (user.name || user.email)}
            </p>
            <p className="text-xs 3xl:text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {(user.role === "ADMIN" || user.role === "SUPERVISOR") && (
          <>
            <DropdownMenuItem className="gap-2 3xl:gap-3 cursor-pointer text-sm 3xl:text-sm py-2 3xl:py-2.5" onClick={handleGoToSettings}>
              <Settings className="h-4 w-4 3xl:h-5 3xl:w-5" />
              Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem className="gap-2 3xl:gap-3 text-white focus:text-white cursor-pointer text-sm 3xl:text-sm py-2 3xl:py-2.5" onClick={onLogout}>
          <LogOut className="h-4 w-4 3xl:h-5 3xl:w-5 text-white" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
