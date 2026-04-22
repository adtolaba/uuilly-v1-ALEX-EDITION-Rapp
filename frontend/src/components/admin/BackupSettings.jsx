/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState, useEffect } from "react"
import { 
  Download, 
  Upload, 
  RefreshCcw, 
  AlertTriangle, 
  History,
  FileJson,
  CheckCircle2,
  XCircle,
  Database
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion"

export function BackupSettings() {
  const [exportCategories, setExportCategories] = useState(["agents", "credentials", "users", "memory"])
  const [isExporting, setIsExporting] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importOverwrite, setImportOverwrite] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState("")
  const [unlockDangerZone, setUnlockDangerZone] = useState("")
  const [isResetting, setIsResetting] = useState(false)
  const [logs, setLogs] = useState([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(true)
  const [accordionValue, setAccordionValue] = useState("")

  const isDangerZoneUnlocked = unlockDangerZone === "DANGER ZONE"

  const categories = [
    { id: "agents", label: "Agents & Tags", description: "All AI assistants and their categorization." },
    { id: "credentials", label: "AI Keys & Settings", description: "API keys, models, and global system configuration." },
    { id: "users", label: "Users & Access", description: "Accounts, roles, and assigned agent permissions." },
    { id: "memory", label: "System Memory", description: "All atomic facts learned about users." }
  ]

  const fetchLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/admin/backup/logs", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (error) {
      console.error("Error fetching backup logs:", error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleExport = async () => {
    if (exportCategories.length === 0) {
      toast.error("Please select at least one category to export.")
      return
    }

    setIsExporting(true)
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/admin/backup/export", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ categories: exportCategories })
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
        a.href = url
        a.download = `uuilly_backup_${date}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success("Backup generated successfully.")
        fetchLogs()
      } else {
        const err = await res.json()
        toast.error(`Export failed: ${err.detail || "Unknown error"}`)
      }
    } catch (error) {
      toast.error("Network error during export.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Please select a JSON file to import.")
      return
    }

    setIsImporting(true)
    const formData = new FormData()
    formData.append("file", importFile)
    formData.append("categories", JSON.stringify(["agents", "credentials", "users", "memory"]))
    formData.append("overwrite", importOverwrite)

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/admin/backup/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })

      if (res.ok) {
        const result = await res.json()
        const { added, updated, skipped } = result.stats
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-bold">Import Successful</span>
            <span className="text-xs">Added: {added}, Updated: {updated}, Skipped: {skipped}</span>
          </div>
        )
        setImportFile(null)
        fetchLogs()
      } else {
        const err = await res.json()
        toast.error(`Import failed: ${err.detail || "Invalid backup file"}`)
      }
    } catch (error) {
      toast.error("Network error during import.")
    } finally {
      setIsImporting(false)
    }
  }

  const handleReset = async () => {
    if (resetConfirmation !== "RESET") return

    setIsResetting(true)
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch("/api/admin/backup/reset", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ confirmation: "RESET" })
      })

      if (res.ok) {
        toast.success("System reset successful.")
        setResetConfirmation("")
        setUnlockDangerZone("")
        setAccordionValue("")
        fetchLogs()
      } else {
        const err = await res.json()
        toast.error(`Reset failed: ${err.detail}`)
      }
    } catch (error) {
      toast.error("Network error during reset.")
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6 pb-10 pr-2">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Card */}
        <Card className="shadow-soft border-muted-foreground/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Configuration
            </CardTitle>
            <CardDescription>Generate a JSON backup of your current system state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-start space-x-3 space-y-0">
                  <Checkbox 
                    id={`export-${cat.id}`} 
                    checked={exportCategories.includes(cat.id)}
                    onCheckedChange={(checked) => {
                      if (checked) setExportCategories([...exportCategories, cat.id])
                      else setExportCategories(exportCategories.filter(id => id !== cat.id))
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor={`export-${cat.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {cat.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button 
              className="w-full mt-2" 
              onClick={handleExport} 
              disabled={isExporting || exportCategories.length === 0}
            >
              {isExporting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
              Generate & Download Backup
            </Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card className="shadow-soft border-muted-foreground/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import Configuration
            </CardTitle>
            <CardDescription>Restore or update settings from a backup file.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="backup-file">Backup JSON File</Label>
              <Input 
                id="backup-file" 
                type="file" 
                accept=".json" 
                onChange={(e) => setImportFile(e.target.files[0])}
                className="cursor-pointer file:bg-secondary file:text-secondary-foreground file:px-3 file:py-1 file:rounded-md file:mr-4 file:hover:bg-secondary/80 file:transition-colors"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-base">Overwrite Existing Data</Label>
                <CardDescription className="text-xs">
                  If enabled, existing records with matching IDs/Emails will be updated.
                </CardDescription>
              </div>
              <Switch 
                checked={importOverwrite}
                onCheckedChange={setImportOverwrite}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="outline" disabled={!importFile || isImporting}>
                  {isImporting ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Start Selective Import
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="pt-2">
                      This will import data from "{importFile?.name}". 
                      {importOverwrite ? (
                        <span className="block mt-2 font-semibold text-destructive">
                          WARNING: Overwrite is ENABLED. Existing records will be updated with data from the backup.
                        </span>
                      ) : (
                        <span className="block mt-2">
                          Overwrite is DISABLED. Only new records will be added; existing ones will be skipped.
                        </span>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImport}>Proceed with Import</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      {/* History Card */}
      <Card className="shadow-soft border-muted-foreground/10 overflow-hidden">
        <CardHeader className="border-b bg-muted/20 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            Action History
          </CardTitle>
          <CardDescription>Recent backup and restore operations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[180px]">Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLogs ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Loading history...</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No operations recorded yet.</TableCell></TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="text-xs font-mono">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.user?.email || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-semibold px-2 py-0.5">
                          {log.action_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs italic text-muted-foreground">
                        {log.strategy_used || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {log.status === "SUCCESS" ? (
                          <div className="flex items-center justify-end text-green-600 gap-1.5 font-medium text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Success
                          </div>
                        ) : (
                          <div className="flex items-center justify-end text-destructive gap-1.5 font-medium text-xs">
                            <XCircle className="h-3.5 w-3.5" />
                            Failed
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Danger Zone Accordion - Moved to the bottom */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 shadow-soft overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-destructive/20 bg-destructive/10">
          <div className="flex items-center gap-2 text-destructive font-bold uppercase tracking-wider text-xs">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </div>
          <div className="flex items-center gap-3">
            {!isDangerZoneUnlocked && (
              <Input 
                placeholder="Type 'DANGER ZONE' to unlock"
                value={unlockDangerZone}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase()
                  setUnlockDangerZone(val)
                  if (val === "DANGER ZONE") {
                    setAccordionValue("danger-zone")
                  }
                }}
                className="h-8 w-64 text-[10px] border-destructive/50 bg-background/50 placeholder:text-destructive/40 text-destructive font-mono"
                autoComplete="off"
              />
            )}
          </div>
        </div>

        <Accordion 
          type="single" 
          collapsible 
          value={accordionValue}
          onValueChange={(val) => {
            if (isDangerZoneUnlocked) setAccordionValue(val)
          }}
        >
          <AccordionItem value="danger-zone" className="border-none">
            <AccordionTrigger className={cn(
              "px-4 py-3 hover:no-underline transition-opacity",
              !isDangerZoneUnlocked && "opacity-30 cursor-not-allowed pointer-events-none"
            )}>
              <span className="text-sm font-medium normal-case tracking-normal">System Reset Options</span>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                <div className="space-y-1">
                  <h4 className="font-medium text-destructive">Global System Reset</h4>
                  <p className="text-sm text-muted-foreground">
                    Delete all Agents, Tags, Credentials, Memories, and non-Admin users. 
                    Admin accounts will be preserved.
                  </p>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">Reset System</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="border-destructive/50">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        CRITICAL ACTION
                      </AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-4 pt-2">
                          <p className="text-sm text-muted-foreground">
                            This will permanently delete ALL system data except for Admin users. 
                            This action cannot be undone.
                          </p>
                          <div className="space-y-2 text-foreground">
                            <Label htmlFor="reset-confirm">
                              To confirm, type <span className="font-bold select-none uppercase text-destructive">RESET</span> below:
                            </Label>
                            <Input 
                              id="reset-confirm"
                              placeholder="Type RESET here"
                              value={resetConfirmation}
                              onChange={(e) => setResetConfirmation(e.target.value.toUpperCase())}
                              className="border-destructive focus-visible:ring-destructive"
                              autoComplete="off"
                              data-lpignore="true"
                              data-form-type="other"
                              name="reset-system-confirmation"
                            />
                          </div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setResetConfirmation("")}>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleReset}
                        disabled={resetConfirmation !== "RESET" || isResetting}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {isResetting ? "Resetting..." : "Wipe All Data"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
