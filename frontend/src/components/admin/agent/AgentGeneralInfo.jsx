/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Bot, Tag, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getTagColor, cn } from "@/lib/utils";

export function AgentGeneralInfo({ 
  name, setName, 
  icon, setIcon, 
  description, setDescription,
  tags, setTags,
  allGlobalTags,
  isEmojiPickerOpen, setIsEmojiPickerOpen
}) {
  const toggleTag = (tagName) => {
    if (tags.includes(tagName)) {
      setTags(tags.filter(t => t !== tagName));
    } else {
      setTags([...tags, tagName]);
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="flex items-end gap-3">
        <div className="grid gap-2 flex-1">
          <label htmlFor="agent-name" className="text-sm font-medium">Name</label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Asistente de Marketing"
            required
            autoComplete="off"
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="agent-icon-trigger" className="text-sm font-medium">Icon</label>
          <Popover open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
            <PopoverTrigger asChild>
              <Button 
                id="agent-icon-trigger"
                variant="outline" 
                type="button"
                className="h-10 w-10 p-0 flex items-center justify-center text-xl"
                title="Select Emoji"
              >
                {icon || <Bot className="h-5 w-5 text-muted-foreground" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[350px] p-0 border-none shadow-xl overflow-hidden" 
              align="end"
              onWheel={(e) => e.stopPropagation()}
            >
              <EmojiPicker 
                onEmojiClick={(emojiData) => {
                  setIcon(emojiData.emoji);
                  setIsEmojiPickerOpen(false);
                }}
                autoFocusSearch={false}
                theme="auto"
                width="100%"
                height={400}
              />
              {icon && (
                <div className="p-2 border-t bg-muted/20 flex justify-center">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2"
                    onClick={() => {
                      setIcon("");
                      setIsEmojiPickerOpen(false);
                    }}
                  >
                    <X className="h-3 w-3" />
                    Reset to Default Bot
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid gap-2">
        <label htmlFor="agent-description" className="text-sm font-medium">Description</label>
        <Input
          id="agent-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of the agent's purpose."
          autoComplete="off"
        />
      </div>

      <div className="grid gap-2 relative">
        <label htmlFor="agent-tags-trigger" className="text-sm font-medium">Required Tags</label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              id="agent-tags-trigger"
              variant="outline" 
              className="w-full justify-between font-normal text-muted-foreground hover:text-foreground"
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>Select tags...</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px] max-h-[300px] overflow-y-auto custom-scrollbar" align="start">
            <DropdownMenuLabel>Available Tags</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allGlobalTags.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground italic text-center">No tags available</div>
            ) : (
              allGlobalTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={tags.includes(tag.name)}
                  onCheckedChange={() => toggleTag(tag.name)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {tags.map((tag) => {
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
                  onClick={() => removeTag(tag)}
                  className="rounded-full opacity-60 hover:opacity-100 hover:bg-muted p-0.5 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {tags.length === 0 && (
            <span className="text-[10px] 3xl:text-xs text-muted-foreground italic">No tags assigned</span>
          )}
        </div>
      </div>
    </div>
  );
}
