/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState } from 'react'
import { Filter, User, Bot, BrainCircuit, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useUsers } from '../../hooks/useUsers'

/**
 * AdvancedSearchModal component for granular memory filtering.
 * Refactored: useEffect removed, uses TanStack Query + Key Pattern for reset.
 */
export function AdvancedSearchModal({ 
  agents, 
  onFilterChange, 
  currentFilters
}) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Local state for the modal fields - initialized from currentFilters
  const [localFilters, setLocalFilters] = useState({
    agentId: currentFilters.agentId || 'all',
    userId: currentFilters.userId || 'all',
    memoryType: currentFilters.memoryType || 'all'
  })

  // Fetch users via React Query
  const { data: users = [], isLoading: isLoadingUsers } = useUsers({
    enabled: isOpen // Only fetch when modal opens
  });

  const handleApply = () => {
    onFilterChange(localFilters)
    setIsOpen(false)
  }

  const handleReset = () => {
    const reset = { agentId: 'all', userId: 'all', memoryType: 'all' }
    setLocalFilters(reset)
    onFilterChange(reset)
    setIsOpen(false)
  }

  const activeFiltersCount = [
    localFilters.agentId !== 'all',
    localFilters.userId !== 'all',
    localFilters.memoryType !== 'all'
  ].filter(Boolean).length

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' className='h-9 gap-2 relative'>
          <Filter className='h-4 w-4' />
          <span className='hidden sm:inline'>Búsqueda Avanzada</span>
          <span className='sm:hidden'>Filtrar</span>
          {activeFiltersCount > 0 && (
            <Badge variant='default' className='ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]'>
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[450px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <BrainCircuit className='h-5 w-5 text-primary' />
            Búsqueda Avanzada de Memoria
          </DialogTitle>
          <DialogDescription className='text-xs'>
            Busca hechos atómicos a través de usuarios, agentes y tipos de memoria.
          </DialogDescription>
        </DialogHeader>

        <div className='grid gap-6 py-4'>
          {/* Agent Filter */}
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2'>
              <Bot className='h-3.5 w-3.5' />
              Filtrar por Agente
            </label>
            <Select 
              value={localFilters.agentId} 
              onValueChange={(val) => setLocalFilters({...localFilters, agentId: val})}
            >
              <SelectTrigger className='h-10 text-sm'>
                <SelectValue placeholder='Todos los agentes' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los agentes</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Filter */}
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2'>
              <User className='h-3.5 w-3.5' />
              Filtrar por Usuario
            </label>
            <Select 
              value={localFilters.userId} 
              onValueChange={(val) => setLocalFilters({...localFilters, userId: val})}
              disabled={isLoadingUsers}
            >
              <SelectTrigger className='h-10 text-sm'>
                {isLoadingUsers ? (
                  <div className='flex items-center gap-2'>
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    <span>Cargando usuarios...</span>
                  </div>
                ) : (
                  <SelectValue placeholder='Todos los usuarios' />
                )}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Todos los usuarios</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {u.first_name || u.last_name ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : u.email}
                    {u.role === 'ADMIN' && <span className='ml-2 text-[10px] opacity-50'>(Admin)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Memory Type Filter */}
          <div className='space-y-2'>
            <label className='text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2'>
              <Filter className='h-3.5 w-3.5' />
              Tipo de Memoria
            </label>
            <div className='flex gap-2'>
              <Button 
                variant={localFilters.memoryType === 'all' ? 'default' : 'outline'} 
                className='flex-1 h-10 text-xs'
                onClick={() => setLocalFilters({...localFilters, memoryType: 'all'})}
              >
                Todos
              </Button>
              <Button 
                variant={localFilters.memoryType === 'global' ? 'default' : 'outline'} 
                className='flex-1 h-10 text-xs'
                onClick={() => setLocalFilters({...localFilters, memoryType: 'global'})}
              >
                Global
              </Button>
              <Button 
                variant={localFilters.memoryType === 'private' ? 'default' : 'outline'} 
                className='flex-1 h-10 text-xs'
                onClick={() => setLocalFilters({...localFilters, memoryType: 'private'})}
              >
                Privada
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className='gap-2 sm:gap-0'>
          <Button variant='ghost' className='text-xs' onClick={handleReset}>
            Restablecer Filtros
          </Button>
          <Button onClick={handleApply}>
            Buscar Recuerdos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
