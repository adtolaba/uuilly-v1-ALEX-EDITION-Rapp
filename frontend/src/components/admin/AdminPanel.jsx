/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserManagement } from "./UserManagement"
import { AgentManagement } from "./AgentManagement"
import { AdminDashboard } from "./AdminDashboard"
import { TagManagement } from "./TagManagement"
import { AICredentialsSettings } from "./AICredentialsSettings"
import { AutoTitlesSettings } from "./AutoTitlesSettings"
import { MemoryManagement } from "./MemoryManagement"
import { BackupSettings } from "./BackupSettings"
import { ChevronsLeft, Database, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNavigate } from 'react-router-dom'

/**
 * AdminPanel component that provides a tabbed interface for system management.
 * @param {Object} props
 * @param {Object} props.currentUser The currently logged in user.
 * @param {boolean} props.isWsConnected WebSocket connection status.
 * @returns {JSX.Element}
 */
export function AdminPanel({ currentUser, isWsConnected }) {
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'ADMIN';
  const isSupervisor = currentUser?.role === 'SUPERVISOR';

  return (
    <div data-testid="admin-panel" className="flex-1 flex flex-col h-screen overflow-hidden pt-2 md:pt-4 3xl:pt-6 px-4 md:px-8 3xl:px-12 pb-4 md:pb-8 3xl:pb-12 bg-background">
      <div className="max-w-5xl 3xl:max-w-[1400px] mx-auto w-full h-full flex flex-col">
        <Tabs defaultValue="dashboard" className="flex-1 flex flex-col min-h-0 space-y-4">
          <TabsList className="shrink-0 w-fit">
            <TabsTrigger value="dashboard">Panel</TabsTrigger>
            <TabsTrigger value="users">Usuarios</TabsTrigger>
            {isAdmin && <TabsTrigger value="agents">Asistentes</TabsTrigger>}
            {isAdmin && <TabsTrigger value="tags">Etiquetas</TabsTrigger>}
            {isAdmin && <TabsTrigger value="ai-keys">Credenciales AI</TabsTrigger>}
            {isAdmin && <TabsTrigger value="titling">Auto Títulos</TabsTrigger>}
            <TabsTrigger value="memory">Memoria</TabsTrigger>
            {isAdmin && <TabsTrigger value="backup">Respaldo</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="dashboard" className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            <AdminDashboard currentUser={currentUser} isWsConnected={isWsConnected} />
          </TabsContent>

          <TabsContent value="users" className="flex-1 min-h-0">
            <Card className="h-full flex flex-col overflow-hidden shadow-soft border-muted-foreground/10">
              <CardHeader className="shrink-0 pb-4 px-6 3xl:px-8">
                <CardTitle className="text-xl">Gestión de Usuarios</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 px-6 pb-6 3xl:px-8 3xl:pb-8 pt-0">
                <UserManagement currentUser={currentUser} />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="agents" className="flex-1 min-h-0">
              <Card className="h-full flex flex-col overflow-hidden shadow-soft border-muted-foreground/10">
                <CardHeader className="shrink-0 pb-4 px-6 3xl:px-8">
                  <CardTitle className="text-xl">Gestión de Asistentes</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 px-6 pb-6 3xl:px-8 3xl:pb-8 pt-0">
                  <AgentManagement />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="tags" className="flex-1 min-h-0">
              <Card className="h-full flex flex-col overflow-hidden shadow-soft border-muted-foreground/10">
                <CardHeader className="shrink-0 pb-4 px-6 3xl:px-8">
                  <CardTitle className="text-xl">Gestión de Etiquetas</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 px-6 pb-6 3xl:px-8 3xl:pb-8 pt-0">
                  <TagManagement />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="titling" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <AutoTitlesSettings />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="ai-keys" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <AICredentialsSettings />
            </TabsContent>
          )}

          <TabsContent value="memory" className="flex-1 min-h-0">
            <Card className="h-full flex flex-col overflow-hidden shadow-soft border-muted-foreground/10">
              <CardHeader className="shrink-0 pb-4 px-6 3xl:px-8">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Recuerdos Almacenados
                </CardTitle>
                <CardDescription className="text-sm">Visualiza y gestiona los hechos atómicos aprendidos por Alex.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 px-6 pb-6 3xl:px-8 3xl:pb-8 pt-0">
                <MemoryManagement currentUser={currentUser} />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="backup" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <BackupSettings />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
