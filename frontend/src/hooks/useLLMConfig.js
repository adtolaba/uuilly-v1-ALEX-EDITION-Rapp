/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import { useState, useMemo } from 'react';
import { normalizeProvider } from '@/lib/utils';
import { useModels } from './useSettings';

/**
 * Custom hook to manage LLM Provider, Credential, and Model configuration.
 * Encapsulates the Provider -> Credential -> Model logical flow.
 * 
 * @param {Object} options
 * @param {string} options.initialProvider
 * @param {number|null} options.initialCredentialId
 * @param {string} options.initialModel
 * @param {Array} options.credentials - All available AI credentials
 * @param {string} options.task - The task to filter credentials by (e.g., 'extraction', 'titling')
 */
export function useLLMConfig({ 
  initialProvider = 'openai', 
  initialCredentialId = null, 
  initialModel = '',
  credentials = [],
  task = 'extraction'
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [credentialId, setCredentialId] = useState(initialCredentialId);
  const [model, setModel] = useState(initialModel);

  // Filter credentials based on current provider and target task
  const filteredCredentials = useMemo(() => {
    return credentials.filter(c => {
      const tasks = typeof c.tasks === 'string' ? JSON.parse(c.tasks) : c.tasks;
      const mappedProvider = normalizeProvider(provider);
      return tasks.includes(task) && c.provider === mappedProvider;
    });
  }, [provider, credentials, task]);

  // Fetch available models based on provider and credential
  const { 
    data: availableModels = [], 
    isLoading: fetchingModels, 
    refetch: refetchModels 
  } = useModels(provider, credentialId);

  // Cascading resets: Provider change resets credential and model
  const handleProviderChange = (newProvider) => {
    setProvider(newProvider);
    setCredentialId(null);
    setModel('');
  };

  // Cascading resets: Credential change resets model
  const handleCredentialChange = (newCredentialId) => {
    if (newCredentialId === 'none' || !newCredentialId) {
      setCredentialId(null);
    } else {
      const id = typeof newCredentialId === 'string' ? parseInt(newCredentialId, 10) : newCredentialId;
      setCredentialId(isNaN(id) ? null : id);
    }
    setModel('');
  };

  /**
   * Manually sync all values at once without triggering cascading resets.
   */
  const sync = ({ provider: p, credentialId: c, model: m }) => {
    if (p !== undefined) setProvider(p);
    if (c !== undefined) {
      const id = typeof c === 'string' ? parseInt(c, 10) : c;
      setCredentialId(isNaN(id) ? null : id);
    }
    if (m !== undefined) setModel(m || '');
  };

  return {
    provider,
    credentialId,
    model,
    setProvider: handleProviderChange,
    setCredentialId: handleCredentialChange,
    setModel,
    sync,
    filteredCredentials,
    availableModels,
    fetchingModels,
    refetchModels
  };
}
