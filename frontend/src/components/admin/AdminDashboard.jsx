/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from "react"
import { Users, Bot, Tag, Activity, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useDashboardStats } from "../../hooks/useDashboardStats"

const StatCard = ({ title, value, icon: Icon, isLoading, visible = true }) => {
  if (!visible) return null;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{isLoading ? "..." : value}</div>
      </CardContent>
    </Card>
  );
};

/**
 * AdminDashboard component that displays system statistics and activity.
 * @param {Object} props
 * @param {Object} props.currentUser The currently logged in user.
 * @param {boolean} props.isWsConnected WebSocket connection status.
 * @returns {JSX.Element}
 */
export function AdminDashboard({ currentUser, isWsConnected }) {
  const isAdmin = currentUser?.role === 'ADMIN';
  
  const { 
    data: stats = { totalUsers: 0, totalAgents: 0, totalTags: 0 }, 
    isLoading 
  } = useDashboardStats(isAdmin, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard 
          title="Total de Usuarios" 
          value={stats.totalUsers} 
          icon={Users} 
          isLoading={isLoading} 
        />
        <StatCard 
          title="Asistentes Activos" 
          value={stats.totalAgents} 
          icon={Bot} 
          isLoading={isLoading} 
          visible={isAdmin}
        />
        <StatCard 
          title="Etiquetas Globales" 
          value={stats.totalTags} 
          icon={Tag} 
          isLoading={isLoading} 
          visible={isAdmin}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Actividad del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="flex items-center">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                   <Activity className="h-4 w-4 text-primary" />
                </div>
                <div className="ml-4 space-y-1">
                  <p className="text-sm font-medium leading-none text-muted-foreground italic">
                    Próximamente: Feed de actividad en tiempo real.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Información Rápida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Base de Datos: Optimizada</span>
              </div>
              <div className="flex items-center gap-2">
                {isWsConnected ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  WebSocket: {isWsConnected ? "Conectado" : "Desconectado"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground opacity-50">
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-sm">Latencia API: 45ms</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
