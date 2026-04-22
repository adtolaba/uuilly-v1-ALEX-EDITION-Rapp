/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react';
import { BrainCircuit } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AgentMemoryConfig({
  memoryEnabled, setMemoryEnabled,
  memoryScope, setMemoryScope,
  hasMemoryCredentials
}) {
  return (
    <TooltipProvider>
      <div className="space-y-3 rounded-lg border p-3 shadow-sm bg-primary/5 border-primary/10">
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="agent-memory-toggle" className="text-sm font-semibold flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-primary" />
              Persistent Memory
            </label>
            <p className="text-[10px] text-muted-foreground italic">Alex aprende y recuerda hechos sobre los usuarios.</p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Switch 
                  id="agent-memory-toggle"
                  checked={memoryEnabled} 
                  onCheckedChange={setMemoryEnabled} 
                  disabled={!hasMemoryCredentials}
                />
              </div>
            </TooltipTrigger>
            {!hasMemoryCredentials && (
              <TooltipContent side="left" className="max-w-[200px] text-xs">
                <p>Memory cannot be enabled because no active AI credentials with 'Memory Extraction' task were found. Please configure them in the AI settings.</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
        
        {memoryEnabled && (
          <div className="grid gap-2 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <label htmlFor="agent-memory-scope" className="text-xs font-medium text-muted-foreground">Memory Scope</label>
            <Select value={memoryScope} onValueChange={setMemoryScope}>
              <SelectTrigger id="agent-memory-scope" className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual (Per User)</SelectItem>
                <SelectItem value="GLOBAL">Global (Shared by all)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
