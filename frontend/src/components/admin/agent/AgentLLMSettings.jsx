/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React from 'react';
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";

export function AgentLLMSettings({
  type, setType,
  url, setUrl,
  flowiseHost, setFlowiseHost,
  flowiseId, setFlowiseId,
  isActive, setIsActive,
  isStreamingEnabled, setIsStreamingEnabled,
  agentAuthStrategy, setAgentAuthStrategy,
  agentAuthHeaderName, setAgentAuthHeaderName,
  agentAuthSecret, setAgentAuthSecret,
  isEditMode
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label htmlFor="agent-type" className="text-sm font-medium">Provider Type</label>
        <Select 
          value={type} 
          onValueChange={(val) => {
            setType(val);
            setAgentAuthStrategy("NONE");
            // Pre-populate URL if Flowise and new agent
            if (val === 'flowise' && !isEditMode) {
              setFlowiseHost("http://flowise:3001");
            }
          }}
        >
          <SelectTrigger id="agent-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="flowise">Flowise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === 'n8n' ? (
        <div className="grid gap-2">
          <label htmlFor="agent-url" className="text-sm font-medium">Webhook URL (n8n)</label>
          <Input
            id="agent-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://n8n:5678/webhook/..."
            required
            autoComplete="off"
          />
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <label htmlFor="flowise-host" className="text-sm font-medium">Flowise Host</label>
            <Input
              id="flowise-host"
              value={flowiseHost}
              onChange={(e) => setFlowiseHost(e.target.value)}
              placeholder="http://localhost:3001"
              required
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="flowise-id" className="text-sm font-medium">Flowise Chatflow ID</label>
            <Input
              id="flowise-id"
              value={flowiseId}
              onChange={(e) => setFlowiseId(e.target.value)}
              placeholder="a1b2c3d4..."
              required
              autoComplete="off"
            />
          </div>
        </>
      )}

      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
        <label htmlFor="agent-active-status" className="text-sm font-medium">Active Status</label>
        <Switch id="agent-active-status" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
        <label htmlFor="agent-streaming-status" className="text-sm font-medium">Enable Streaming</label>
        <Switch id="agent-streaming-status" checked={isStreamingEnabled} onCheckedChange={setIsStreamingEnabled} />
      </div>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="auth" className="border rounded-lg px-3">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Authentication (Optional)</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-1 pb-4 space-y-4">
            <div className="grid gap-2">
              <label htmlFor="agent-auth-strategy" className="text-xs font-medium text-muted-foreground">Strategy</label>
              <Select value={agentAuthStrategy} onValueChange={setAgentAuthStrategy}>
                <SelectTrigger id="agent-auth-strategy" className="h-8">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (Public)</SelectItem>
                  {type === 'n8n' && (
                    <SelectItem value="HEADER">Header Auth (n8n)</SelectItem>
                  )}
                  {type === 'flowise' && (
                    <SelectItem value="BEARER">API Key (Flowise)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {agentAuthStrategy !== "NONE" && (
              <>
                {agentAuthStrategy === "HEADER" && (
                  <div className="grid gap-2">
                    <label htmlFor="auth-header" className="text-xs font-medium text-muted-foreground">Name (Header)</label>
                    <Input
                      id="auth-header"
                      value={agentAuthHeaderName}
                      onChange={(e) => setAgentAuthHeaderName(e.target.value)}
                      placeholder="X-Api-Key"
                      className="h-8"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <label htmlFor="auth-secret" className="text-xs font-medium text-muted-foreground">
                    {agentAuthStrategy === "HEADER" ? "Value" : "API Key"}
                  </label>
                  <Input
                    id="auth-secret"
                    type="password"
                    value={agentAuthSecret}
                    onChange={(e) => setAgentAuthSecret(e.target.value)}
                    placeholder="••••••••"
                    className="h-8"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
