/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { cn } from '@/lib/utils'
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Type,
  ChevronDown
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"
import { Button } from './ui/button'
import { Separator } from './ui/separator'

const MenuBar = ({ editor }) => {
  if (!editor) {
    return null
  }

  const setHeading = (level) => {
    if (level === 'paragraph') {
      editor.chain().focus().setParagraph().run()
    } else {
      editor.chain().focus().toggleHeading({ level: parseInt(level) }).run()
    }
  }

  const getCurrentHeading = () => {
    if (editor.isActive('heading', { level: 1 })) return '1'
    if (editor.isActive('heading', { level: 2 })) return '2'
    return 'paragraph'
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/5 shrink-0">
      <Select value={getCurrentHeading()} onValueChange={setHeading}>
        <SelectTrigger className="h-8 w-[130px] text-xs border-none bg-transparent hover:bg-muted focus:ring-0 focus:ring-offset-0">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paragraph" className="text-xs">Normal Text</SelectItem>
          <SelectItem value="1" className="text-xs font-bold text-lg">Heading 1</SelectItem>
          <SelectItem value="2" className="text-xs font-bold">Heading 2</SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", editor.isActive('bold') && "bg-muted text-primary")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", editor.isActive('italic') && "bg-muted text-primary")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", editor.isActive('bulletList') && "bg-muted text-primary")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", editor.isActive('orderedList') && "bg-muted text-primary")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function TipTapEditor({ initialContent, onChange, className }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Disable built-in heading to use our own extension if needed or just use starter kit's
      }),
      Heading.configure({
        levels: [1, 2],
      }),
      Placeholder.configure({
        placeholder: 'Write something...',
      }),
      Markdown,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.storage.markdown.getMarkdown())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none p-6 text-sm overflow-y-auto h-full custom-scrollbar',
      },
    },
  })

  return (
    <div className={cn("flex flex-col h-full border rounded-xl overflow-hidden bg-background shadow-soft-sm", className)}>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="flex-1 min-h-0 overflow-hidden" />
    </div>
  )
}
