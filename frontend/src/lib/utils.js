/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Image, FileText, File as FileGeneric } from 'lucide-react'; // Simplified imports


export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Function to generate a consistent color for a given string (e.g., username)
export function getUserColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
}

// Function to get Lucide icon based on file type/extension
export function getFileIcon(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'webp':
    case 'svg':
      return Image;
    case 'pdf':
    case 'doc':
    case 'docx':
    case 'xls':
    case 'xlsx':
    case 'txt':
    case 'md':
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'html':
    case 'css':
    case 'json':
    case 'py':
      return FileText; // Use FileText for common document/code types
    default:
      return FileGeneric; // Generic file icon
  }
}

// Function to truncate long filenames
export function truncateFilename(filename, maxLength = 20) {
  if (filename.length <= maxLength) {
    return filename;
  }
  const extension = filename.split('.').pop();
  const name = filename.substring(0, filename.length - extension.length - 1);
  const truncatedName = name.substring(0, maxLength - extension.length - 3); // -3 for "..."
  return `${truncatedName}...${extension}`;
}

// Function to get a friendly label for MIME types
export function getFriendlyFileType(mimeType, filename = "") {
  if (!mimeType) return "FILE";

  const mimeMap = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
    'application/vnd.ms-powerpoint': 'PPT',
    'text/plain': 'TXT',
    'text/markdown': 'MD',
    'application/json': 'JSON',
    'application/javascript': 'JS',
    'text/html': 'HTML',
    'text/css': 'CSS'
  };

  if (mimeMap[mimeType]) return mimeMap[mimeType];

  // Fallback for images
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();

  // Fallback for other types: extract from filename extension if available
  if (filename && filename.includes('.')) {
    const ext = filename.split('.').pop().toUpperCase();
    if (ext && ext.length <= 4) return ext;
  }

  // Last resort: truncate the second part of the mime type
  const typePart = mimeType.split('/')[1] || 'FILE';
  return typePart.length > 8 ? typePart.substring(0, 8).toUpperCase() : typePart.toUpperCase();
}

// Function to generate consistent pastel colors for tags
export function getTagColor(name) {
  const colors = [
    { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
    { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
    { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
    { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Function to normalize AI provider names to match backend Enums
export function normalizeProvider(provider) {
  if (!provider) return '';
  return provider.toLowerCase() === 'google' ? 'GEMINI' : provider.toUpperCase();
}
