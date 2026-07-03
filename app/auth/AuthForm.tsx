'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail, Lock, User, Phone, Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface AuthFormProps {
  organizationId: number
  organizationName: string
  logoUrl?: string | null
  primaryColor: string
}

export function AuthForm({ organizationId, organizationName, logoUrl, primaryColor }: AuthFormProps) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login'

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(initialTab)
  const [forgotEmail, setForgotEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      // Auth via API route (server-side persiste cookies automáticamente)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, email: loginData.email, password: loginData.password })
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      // Sincronizar sesión en el browser client (las cookies ya fueron seteadas por el server)
      if (data.session?.access_token && data.session?.refresh_token) {
        const supabase = createClient()
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
      }

      setSuccess('¡Bienvenido de vuelta!')
      window.location.href = '/mi-cuenta'
    } catch {
      setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    if (registerData.password !== registerData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setSubmitting(false)
      return
    }
    if (registerData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          firstName: registerData.firstName,
          lastName: registerData.lastName,
          email: registerData.email,
          phone: registerData.phone,
          password: registerData.password
        })
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        // Sincronizar sesión en browser client si hay tokens
        if (data.session?.access_token && data.session?.refresh_token) {
          const supabase = createClient()
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
          })
        }
        setSuccess(data.message || '¡Cuenta creada exitosamente!')
        // Redirigir a /mi-cuenta (cookies ya seteadas por el server)
        window.location.href = '/mi-cuenta'
      }
    } catch {
      setError('Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="dark:bg-gray-900 dark:border-gray-700">
        <CardHeader className="text-center">
          {logoUrl ? (
            <img src={logoUrl} alt={organizationName} className="h-16 w-auto mx-auto mb-4" />
          ) : (
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {organizationName.charAt(0)}
            </div>
          )}
          <CardTitle>
            {activeTab === 'login' ? 'Iniciar Sesión' : activeTab === 'register' ? 'Crear Cuenta' : 'Recuperar Contraseña'}
          </CardTitle>
          <CardDescription>
            {activeTab === 'login'
              ? `Accede a tu cuenta en ${organizationName}`
              : activeTab === 'register'
              ? `Regístrate en ${organizationName}`
              : 'Te enviaremos un enlace para restablecer tu contraseña'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Tabs */}
          {activeTab !== 'forgot' && (
            <div className="flex mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'login' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Iniciar Sesión
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); setSuccess('') }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'register' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Registrarse
              </button>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-lg text-sm">{success}</div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" required className="pl-10" placeholder="tu@email.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type={showPassword ? 'text' : 'password'} required className="pl-10 pr-10" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 mr-2" />
                  Recordarme
                </label>
                <button type="button" onClick={() => { setActiveTab('forgot'); setError(''); setSuccess(''); setForgotEmail(loginData.email) }} className="hover:underline" style={{ color: primaryColor }}>¿Olvidaste tu contraseña?</button>
              </div>
              <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={submitting}>
                {submitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input required className="pl-10" placeholder="Juan" value={registerData.firstName} onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
                  <Input required placeholder="Pérez" value={registerData.lastName} onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" required className="pl-10" placeholder="tu@email.com" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="tel" required className="pl-10" placeholder="+57 300 123 4567" value={registerData.phone} onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type={showPassword ? 'text' : 'password'} required className="pl-10 pr-10" placeholder="Mínimo 6 caracteres" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type={showPassword ? 'text' : 'password'} required className="pl-10" placeholder="Repite tu contraseña" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} />
                </div>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <label className="flex items-start">
                  <input type="checkbox" required className="rounded border-gray-300 mr-2 mt-0.5" />
                  <span>
                    Acepto los <a href="#" className="hover:underline" style={{ color: primaryColor }}>términos y condiciones</a> y la <a href="#" className="hover:underline" style={{ color: primaryColor }}>política de privacidad</a>
                  </span>
                </label>
              </div>
              <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={submitting}>
                {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
              </Button>
            </form>
          )}

          {activeTab === 'forgot' && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              setSubmitting(true)
              setError('')
              try {
                const res = await fetch('/api/auth/forgot-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: forgotEmail })
                })
                const data = await res.json()
                if (data.error) {
                  setError(data.error)
                } else {
                  setSuccess(data.message)
                }
              } catch {
                setError('Error al enviar el enlace. Intenta de nuevo.')
              } finally {
                setSubmitting(false)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input type="email" required className="pl-10" placeholder="tu@email.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => { setActiveTab('login'); setError(''); setSuccess('') }} className="text-sm hover:underline" style={{ color: primaryColor }}>
                  Volver al inicio de sesión
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
