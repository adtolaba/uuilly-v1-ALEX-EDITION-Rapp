/*
 * Copyright (c) 2026 Gustavo Alejandro Medde.
 * Licensed under the Apache License, Version 2.0.
 * See LICENSE.md in the project root for more information.
 */

import React, { useState, useEffect } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { useNavigate, useLocation } from "react-router-dom"
import useAuthStore from '../store/authStore'
import useUI from "../hooks/useUI"
import { Chrome, LogIn, ChevronDown, ChevronUp } from "lucide-react"
import brazoSvg from "../assets/branding/brazo.svg"
import miscSvg from "../assets/branding/misc.svg"
import logoSvg from "../assets/branding/avatar_logo.svg"
import googleGSvg from "../assets/branding/google_g.svg"

export function LoginPage() {
  const ui = useUI()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showGuestForm, setShowGuestForm] = useState(false)
  
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithPassword, isLoading, error, clearError } = useAuthStore()

  // Handle errors from store or URL
  useEffect(() => {
    if (error) {
      ui.toast.error(error)
      clearError()
    }
    
    // Check for errors in URL (e.g. from Google callback failure)
    const params = new URLSearchParams(location.search)
    const errorParam = params.get('error')
    if (errorParam) {
      ui.toast.error(errorParam)
    }
  }, [error, location.search, ui.toast, clearError])

  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    const success = await loginWithPassword(email, password)
    if (success) {
      ui.toast.success("Inicio de sesión exitoso")
      navigate('/')
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google/login"
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background p-4 font-sans relative overflow-hidden">
      {/* Background Branding Elements */}
      <img 
        src={miscSvg} 
        alt="" 
        className="absolute top-10 left-10 w-[120px] md:w-[180px] pointer-events-none select-none z-0"
        data-testid="branding-bg-misc"
      />
      <img 
        src={brazoSvg} 
        alt="" 
        className="absolute bottom-4 right-4 w-[250px] md:w-[400px] pointer-events-none select-none z-0"
        data-testid="branding-bg-brazo"
      />

      <div className="flex flex-col items-center z-10 w-full max-w-sm 3xl:max-w-md">
        {/* Client Logo above the card */}
        <div className="mb-10 animate-in fade-in zoom-in duration-700">
          <img 
            src={logoSvg} 
            alt="Client Logo" 
            className="h-48 md:h-64 w-auto drop-shadow-2xl"
          />
        </div>

        <Card className="w-full shadow-lg border-muted/40 backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center space-y-1">
            <CardDescription className="text-balance text-2xl font-bold text-foreground">
              Bienvenido a Alex
            </CardDescription>
          </CardHeader>
        <CardContent className="grid gap-6">
          {/* Primary Action: Google */}
          <Button 
            variant="outline" 
            className="w-full h-12 text-base font-medium flex items-center justify-center gap-3 transition-all hover:bg-muted/50"
            onClick={handleGoogleLogin}
          >
            <img src={googleGSvg} alt="Google" className="w-5 h-5" />
            Continuar con Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O bien
              </span>
            </div>
          </div>

          {/* Secondary Action: Toggle Guest Form */}
          {!showGuestForm ? (
            <Button 
              variant="ghost" 
              className="text-muted-foreground hover:text-primary transition-colors"
              onClick={() => setShowGuestForm(true)}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Acceso Invitado / Interno
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <form onSubmit={handlePasswordLogin} className="grid gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid gap-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
              
              <Button 
                variant="link" 
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowGuestForm(false)}
                type="button"
              >
                Ocultar formulario
                <ChevronUp className="w-4 h-4 ml-1" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
