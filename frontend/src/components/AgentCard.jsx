/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card"
import { Badge } from "./ui/badge"
import { Bot, MessageSquare } from "lucide-react"
import { cn, getTagColor } from "@/lib/utils"

/**
 * AgentCard component to display an AI assistant in a grid/list.
 * 
 * @param {Object} props
 * @param {Object} props.agent - The agent object
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.isSelected - Whether this agent is currently selected
 * @returns {JSX.Element}
 */
export function AgentCard({ agent, onClick, isSelected }) {
  const primaryTag = agent.tags && agent.tags.length > 0 ? agent.tags[0] : null
  const tagColors = primaryTag ? getTagColor(primaryTag) : null

  return (
    <Card
      role="listitem"
      tabIndex={0}
      onClick={() => onClick(agent)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(agent) }}
      className={cn(
        "group relative w-full flex flex-col transition-all duration-200 hover:shadow-soft-md border bg-card/30 backdrop-blur-sm active:scale-[0.98] cursor-pointer shrink-0 h-full",
        isSelected
          ? "border-primary/40 ring-1 ring-primary/10 bg-primary/5"
          : "border-muted-foreground/10 hover:border-primary/20"
      )}
      aria-label={`Select assistant: ${agent.name}`}
      aria-selected={isSelected}
    >
      <CardHeader className="p-2 3xl:p-2.5 pb-1 flex-none">
        <div className="flex items-start gap-3 3xl:gap-4">
          <div className={cn(
            "h-8 w-8 3xl:h-9 3xl:w-9 flex items-center justify-center rounded-lg shrink-0 transition-colors text-lg 3xl:text-xl",
            isSelected
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
          )} aria-hidden="true">
            {agent.icon || <Bot className="h-4 w-4 3xl:h-5 3xl:w-5" />}
          </div>
          <div className="space-y-0.5 3xl:space-y-1 min-w-0">
            <CardTitle className="text-sm 3xl:text-base font-bold truncate group-hover:text-primary transition-colors">
              {agent.name}
            </CardTitle>
            <div className="min-h-[2em] 3xl:min-h-[2.2em]">
              {agent.description && (
                <CardDescription className="text-[11px] 3xl:text-xs line-clamp-2 leading-snug text-muted-foreground/80">
                  {agent.description}
                </CardDescription>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      {/* Spacer to push content to bottom */}
      <div className="flex-grow" />

      <CardContent className="p-2 3xl:p-2.5 pt-1.5 3xl:pt-0.5 flex-none mt-auto">
        <div className="flex items-center justify-between text-[9px] 3xl:text-[11px] font-bold uppercase tracking-widest">
          <div className="flex items-center gap-1 3xl:gap-1.5">
            {primaryTag && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[8px] 3xl:text-[10px] px-1.5 py-0 border uppercase font-bold tracking-wider", 
                  tagColors.bg, 
                  tagColors.text, 
                  tagColors.border
                )}
              >
                {primaryTag}
              </Badge>
            )}
          </div>
          {isSelected && (
            <span className="text-primary/80">Recent</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
