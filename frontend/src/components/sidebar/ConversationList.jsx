/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useEffect, useRef } from 'react';
import { Search, MessageSquare, MoreVertical, Edit2, FileText, Download, Trash2, Loader2, AlertCircle } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { cn } from "@/lib/utils";

export function ConversationList({
  searchQuery, setSearchQuery,
  editingId, setEditingId,
  editingTitle, setEditingTitle,
  loading, error,
  activeChatId,
  grouped,
  expandedGroups, setExpandedGroups,
  handleChatSelect,
  startEditing,
  saveEdit,
  handleKeyDown,
  handleDownload,
  handleDeleteConversation,
  downloadingId
}) {
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      // Select text for better UX when renaming
      editInputRef.current.select();
    }
  }, [editingId]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Search Bar */}
      <div className="px-4 pt-4 pb-2 3xl:pt-5 3xl:pb-3">
        <div className="relative">
          <input type="text" name="prevent_autofill_email" className="hidden" aria-hidden="true" tabIndex="-1" />
          <input type="password" name="prevent_autofill_pass" className="hidden" aria-hidden="true" tabIndex="-1" />
          
          <Search className="absolute left-2.5 top-2.5 3xl:top-3 h-3.5 w-3.5 3xl:h-4 3xl:w-4 text-muted-foreground" aria-hidden="true" />
          <Input 
            name="chat_history_search_query"
            placeholder="Buscar chats..."
            className="pl-9 3xl:pl-10 h-8 3xl:h-10 text-[13px] 3xl:text-sm border-none bg-muted/40 focus-visible:ring-1 focus-visible:ring-primary/20 transition-all w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            aria-label="Search through your chat history"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2 pr-4 pl-2 3xl:py-3" role="list" aria-label="Chat groups">
          {loading ? (
            <div className="flex items-center justify-center py-10" aria-busy="true" aria-label="Loading conversations">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : error ? (
            <div className="px-2 py-2" role="alert">
              <Alert variant="destructive" className="py-2 px-3">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                <AlertTitle className="text-[10px] 3xl:text-xs font-bold">Error</AlertTitle>
                <AlertDescription className="text-[10px] 3xl:text-xs leading-tight">
                  {error}
                </AlertDescription>
              </Alert>
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-[11px] 3xl:text-sm text-muted-foreground italic">No se encontraron conversaciones.</p>
            </div>
          ) : (
            <Accordion 
              type="multiple" 
              value={expandedGroups} 
              onValueChange={setExpandedGroups}
              className="w-full"
            >
              {Object.entries(grouped).map(([group, chats]) => (
                <AccordionItem key={group} value={group} className="border-none" role="listitem">
                  <AccordionTrigger className="hover:no-underline px-2 py-2 text-[9px] 3xl:text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/40 transition-colors hover:text-muted-foreground/60 [&[data-state=open]>svg]:rotate-90">
                    {group}
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-0.5 3xl:space-y-0.5" role="list" aria-label={`Chats from ${group}`}>
                      {chats.map(chat => (
                        <div key={chat.id} className="group relative flex items-center w-full min-w-0" role="listitem">
                          <Button
                            variant={activeChatId === chat.id ? "secondary" : "ghost"}
                            className={cn(
                              "w-full justify-start gap-2.5 3xl:gap-3 px-2.5 3xl:px-3 py-1.5 3xl:py-2 h-auto font-normal pr-10 3xl:pr-10 overflow-hidden text-[13px] 3xl:text-sm transition-all duration-200 !whitespace-nowrap min-w-0 flex",
                              activeChatId === chat.id 
                                ? "bg-secondary shadow-soft border-transparent" 
                                : "hover:bg-accent/50",
                              editingId === chat.id && "bg-accent/80"
                            )}
                            onDoubleClick={() => startEditing(chat)}
                            onClick={() => handleChatSelect(chat.id)}
                            aria-label={`Select chat: ${chat.title}`}
                            aria-current={activeChatId === chat.id ? "true" : undefined}
                          >
                            <MessageSquare className={cn(
                              "h-3.5 w-3.5 3xl:h-4 3xl:w-4 shrink-0 transition-colors duration-200",
                              activeChatId === chat.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                            )} aria-hidden="true" />
                            {editingId === chat.id ? (
                              <Input
                                ref={editInputRef}
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                                className="h-5 3xl:h-6 flex-1 min-w-0 px-1 py-0 text-[13px] 3xl:text-sm focus-visible:ring-1 focus-visible:ring-primary border-none bg-transparent"
                                aria-label="Edit chat title"
                              />
                            ) : (
                              <span className="truncate flex-1 text-left block max-w-[155px] 3xl:max-w-[185px]">{chat.title}</span>
                            )}
                          </Button>
                          {/* Chat Action Menu */}
                          {!editingId && (
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <DropdownMenu>

                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-muted-foreground hover:bg-transparent"
                                    aria-label={`More actions for chat: ${chat.title}`}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-soft-md">
                                  <DropdownMenuItem 
                                    className="gap-2 cursor-pointer text-xs py-2"
                                    onClick={() => startEditing(chat)}
                                  >
                                    <Edit2 className="h-3 w-3" aria-hidden="true" />
                                    Renombrar
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuSeparator />
                                  
                                  <DropdownMenuItem 
                                    className="gap-2 cursor-pointer text-xs py-2"
                                    disabled={downloadingId === chat.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(chat, 'text');
                                    }}
                                  >
                                    <FileText className="h-3 w-3" aria-hidden="true" />
                                    Descargar como .txt
                                  </DropdownMenuItem>
                                  
                                  <DropdownMenuItem 
                                    className="gap-2 cursor-pointer text-xs py-2"
                                    disabled={downloadingId === chat.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownload(chat, 'markdown');
                                    }}
                                  >
                                    <Download className="h-3 w-3" aria-hidden="true" />
                                    Descargar como .md
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator />

                                  <DropdownMenuItem 
                                    className="gap-2 text-destructive focus:text-destructive cursor-pointer text-xs py-2"
                                    onClick={() => handleDeleteConversation(chat.id)}
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
