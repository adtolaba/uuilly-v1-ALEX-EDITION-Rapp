/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { cn, getUserColor } from "@/lib/utils"

/**
 * UserAvatar component that displays a user's profile picture 
 * or a colored fallback with their initial.
 * 
 * @param {Object} props
 * @param {Object} props.user The user object (must have name, optionally avatar)
 * @param {string} props.className Optional additional classes
 * @returns {JSX.Element}
 */
export function UserAvatar({ user, className }) {
  if (!user) return null;
  
  // Logic:
  // 1. Picture (from Google or DB)
  // 2. First Name Initial
  // 3. Name (prefix of email) Initial
  // 4. Email Initial
  
  const avatarUrl = user.picture || user.avatar;
  const displayName = user.firstName || user.name || user.email || "User";
  const initial = displayName.charAt(0).toUpperCase();
  const avatarColor = getUserColor(displayName);

  return (
    <Avatar className={cn("shrink-0 border shadow-sm", className)}>
      <AvatarImage src={avatarUrl} alt={displayName} />
      <AvatarFallback 
        className="font-bold text-white uppercase" 
        style={{ backgroundColor: avatarColor }}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  )
}
