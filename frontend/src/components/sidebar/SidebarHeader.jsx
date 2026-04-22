/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react';
import { PanelLeftClose, Plus } from "lucide-react";
import { Button } from "../ui/button";
import logoSvg from "../../assets/branding/avatar_logo.svg";

export function SidebarHeader({ isSidebarOpen, onToggleSidebar, onNewChat, isAtWelcomeScreen }) {
  return (
    <div className="py-4 3xl:py-5 pl-4 pr-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={logoSvg} alt="Alex" className="h-9 3xl:h-11 w-auto" />
          <div className="flex flex-col -space-y-1">
            <h1 className="text-xl 3xl:text-2xl font-bold text-foreground transition-all leading-none">Alex</h1>
            <span className="text-[11px] 3xl:text-[12px] font-normal text-primary tracking-tight">powered by di Paola</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 3xl:h-9 3xl:w-9 text-muted-foreground hover:text-foreground hidden md:flex"
          onClick={onToggleSidebar}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4 3xl:h-5 3xl:w-5" />
        </Button>
      </div>
      <Button 
        className="w-full justify-start gap-2 h-9 3xl:h-11 text-sm 3xl:text-base transition-all shadow-md" 
        variant="default" 
        onClick={onNewChat}
        disabled={isAtWelcomeScreen}
        aria-label="Nuevo chat"
      >
        <Plus className="h-4 w-4 3xl:h-5 3xl:w-5" aria-hidden="true" />
        Nuevo Chat
      </Button>
    </div>
  );
}
