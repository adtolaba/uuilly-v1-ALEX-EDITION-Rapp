/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState, useEffect } from "react"
import { Loader2, Sparkles } from "lucide-react"

const REASSURING_PHRASES = [
  "Preparando tu respuesta...",
  "Buscando en mis conocimientos...",
  "Redactando una respuesta detallada...",
  "Casi listo, un momento...",
  "Analizando la información..."
]

export function ProcessingIndicator({ agentName, agentIcon, loadingMessage }) {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % REASSURING_PHRASES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex w-full gap-4 py-8 px-4 md:px-6 animate-in fade-in duration-500">
      <div className="max-w-3xl mx-auto w-full flex gap-4 md:gap-6">
        <div className="h-8 w-8 flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 text-primary/40 animate-spin" />
        </div>
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            {agentIcon && <span className="text-xs">{agentIcon}</span>}
            <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground/40 uppercase">
              {agentName || "Alex"}
            </p>
            {!agentIcon && <Sparkles className="w-3 h-3 text-primary/20 animate-pulse" />}
          </div>
          
          <p className="text-sm font-medium text-muted-foreground/60 transition-all duration-500 italic">
            {loadingMessage || REASSURING_PHRASES[phraseIndex]}
          </p>
        </div>
      </div>
    </div>
  )
}
