/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState } from "react"
import { Avatar } from "./ui/avatar"
import { UserAvatar } from "./UserAvatar"
import { cn, getFileIcon, truncateFilename, getFriendlyFileType } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { ExternalLink, Maximize2, MoreVertical, FileText, FileCode, Copy, Pencil, Save, X } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogHeader, DialogFooter } from "./ui/dialog"
import { TipTapEditor } from "./TipTapEditor"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Button } from "./ui/button"
import { toast } from "sonner"
import logoSvg from "../assets/branding/avatar_logo.svg"

export function ChatMessage({ message, user, onMessageUpdate, onStartThinking, isEditable }) {
  const isAssistant = message.role === "assistant"
  const files = message.files || []
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [isSaving, setIsSaving] = useState(false)

  const handleCopy = (format) => {
    const text = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    let contentToCopy = text
    
    if (format === 'text') {
      // Basic markdown stripping for "Text" format
      contentToCopy = text.replace(/[#*`_~\[\]()]/g, '')
    }

    navigator.clipboard.writeText(contentToCopy)
    toast.success(`Copiado como ${format === 'text' ? 'Texto' : 'Markdown'}`)
  }

  const handleSaveEdit = async () => {
    if (!editContent || editContent === message.content) {
      setIsEditingModalOpen(false)
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem("access_token")
      const response = await fetch(`/api/v1/conversations/${message.conversation_id}/messages/${message.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: editContent })
      })

      if (!response.ok) {
        throw new Error("Error al guardar los cambios")
      }

      const updatedMsg = await response.json()
      
      // 1. Update local bubble content
      if (onMessageUpdate) {
        onMessageUpdate({ ...updatedMsg, content: updatedMsg.text })
      }

      // 2. Close modal immediately
      setIsEditingModalOpen(false)

      // 3. Trigger thinking indicator (Agent is processing correction)
      if (onStartThinking) onStartThinking()
      
    } catch (error) {
      console.error("Error updating message:", error)
      toast.error("Error al actualizar el mensaje")
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to check if a file is an image
  const isImage = (file) => {
    return file.type.startsWith('image/') || 
           /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name)
  }

  return (
    <div className={cn(
      "flex w-full gap-4 py-8 px-4 md:px-6 3xl:px-12 animate-in fade-in slide-in-from-bottom-2 duration-500",
      isAssistant ? "bg-muted/30" : "bg-background"
    )}>
      <div className="max-w-3xl 3xl:max-w-4xl mx-auto w-full flex gap-4 md:gap-6 3xl:gap-10 relative group">
        {isAssistant ? (
          <Avatar className="h-8 w-8 3xl:h-10 3xl:w-10 shrink-0 mt-1 border shadow-sm bg-white p-1">
            <img src={logoSvg} alt="Assistant" className="h-full w-full object-contain" />
          </Avatar>
        ) : (
          <UserAvatar user={user} className="h-8 w-8 3xl:h-10 3xl:w-10 mt-1" />
        )}
        
        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-foreground/50 uppercase">
              {isAssistant ? (message.agentName || "Alex") : "Tú"}
            </p>
            
            {/* Direct Actions (Only for bot messages) */}
            {isAssistant && (
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 group-[[data-state=open]]:opacity-100 transition-opacity absolute -right-10 top-0">
                <DropdownMenu>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-primary/10 hover:text-primary transition-all data-[state=open]:bg-primary/10 data-[state=open]:text-primary"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-[10px]">Copiar mensaje</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <DropdownMenuContent align="start" side="right" className="w-40 rounded-xl shadow-soft-md">
                    <DropdownMenuItem 
                      className="gap-2 text-xs py-2 cursor-pointer"
                      onClick={() => handleCopy('text')}
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      Copiar como Texto
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="gap-2 text-xs py-2 cursor-pointer"
                      onClick={() => handleCopy('markdown')}
                    >
                      <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                      Copiar como Markdown
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>

                  {isEditable && (
                  <Dialog open={isEditingModalOpen} onOpenChange={setIsEditingModalOpen}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-primary/10 hover:text-primary transition-all"
                              onClick={() => setEditContent(message.content)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="text-[10px]">Editar mensaje</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden rounded-2xl border-none shadow-2xl">
                      <DialogHeader className="px-6 py-3 shrink-0 border-b bg-muted/10">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                          <Pencil className="h-5 w-5 text-primary" />
                          Editar respuesta
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                          Editor WYSIWYG para corregir mensajes.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex-1 min-h-0 overflow-hidden">
                        <TipTapEditor 
                          initialContent={message.content} 
                          onChange={setEditContent}
                          className="border-none rounded-none shadow-none h-full w-full"
                        />
                      </div>

                      <DialogFooter className="p-4 shrink-0 bg-muted/30 border-t">
                        <div className="flex items-center justify-end gap-3 w-full">
                          <Button 
                            variant="ghost" 
                            onClick={() => setIsEditingModalOpen(false)}
                            disabled={isSaving}
                            className="rounded-xl px-6"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className="rounded-xl px-8 shadow-soft-sm bg-primary hover:bg-primary/90"
                          >
                            {isSaving ? (
                              <>
                                <span className="animate-spin mr-2">◌</span>
                                Guardando...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Guardar cambios
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  )}
                  </div>
                  )}

          </div>

          <div className="text-sm leading-relaxed text-foreground/90 markdown-body prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]} 
              rehypePlugins={[rehypeHighlight]}
            >
              {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
            </ReactMarkdown>
          </div>

          {/* File Attachments Section */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4">
              {files.map((file, idx) => {
                if (isImage(file)) {
                  return (
                    <Dialog key={idx}>
                      <DialogTrigger asChild>
                        <div 
                          className="relative group/img cursor-pointer overflow-hidden rounded-lg border bg-muted shadow-sm hover:shadow-md transition-all max-w-[240px]"
                        >
                          <img 
                            src={file.url} 
                            alt={file.name} 
                            className="h-auto max-h-48 w-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                            <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="w-fit max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none overflow-hidden">
                        <DialogTitle className="sr-only">Image Preview</DialogTitle>
                        <DialogDescription className="sr-only">Enlarged view of the attached image</DialogDescription>
                        <img 
                          src={file.url} 
                          alt={file.name} 
                          className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
                        />
                      </DialogContent>
                    </Dialog>
                  )
                }

                const Icon = getFileIcon(file.name)
                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-accent transition-colors group/file max-w-[200px]"
                        >
                          <div className="p-2 rounded bg-muted group-hover/file:bg-background transition-colors">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{truncateFilename(file.name)}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{getFriendlyFileType(file.type, file.name)}</p>
                          </div>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover/file:opacity-50 transition-opacity shrink-0" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{file.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
