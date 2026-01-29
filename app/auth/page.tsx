'use client'

import { useState, useEffect, Suspense } from 'react'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail, Lock, User, Phone, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function AuthContent() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'register' ? 'register' : 'login'
  
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [loginData, setLoginData] = useState({ email: '', password: '' })
  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  
  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        const res = await fetch(`/api/organization?subdomain=${subdomain}`)
        const data = await res.json()
        if (data.data) {
          setOrganization(data.data)
        }
      } catch (error) {
        console.error('Error loading organization:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadOrganization()
  }, [])
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organization.id,
          email: loginData.email,
          password: loginData.password
        })
      })
      
      const data = await res.json()
      
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess('¡Bienvenido de vuelta!')
        // Redirigir después del login
        setTimeout(() => {
          window.location.href = '/'
        }, 1500)
      }
    } catch (err) {
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
          organizationId: organization.id,
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
        setSuccess('¡Cuenta creada exitosamente! Revisa tu correo para verificar tu cuenta.')
        setActiveTab('login')
        setLoginData({ email: registerData.email, password: '' })
      }
    } catch (err) {
      setError('Error al crear la cuenta. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }
  
  const primaryColor = organization?.website_settings?.primary_color || organization?.primary_color || '#3B82F6'
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }
  
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Organización no encontrada</p>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader organization={organization} primaryColor={primaryColor} />
      
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </Link>
        </div>
        
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              {organization.logo_url ? (
                <img 
                  src={organization.logo_url} 
                  alt={organization.name}
                  className="h-16 w-auto mx-auto mb-4"
                />
              ) : (
                <div 
                  className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {organization.name.charAt(0)}
                </div>
              )}
              <CardTitle>
                {activeTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </CardTitle>
              <CardDescription>
                {activeTab === 'login' 
                  ? `Accede a tu cuenta en ${organization.name}` 
                  : `Regístrate en ${organization.name}`}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {/* Tabs */}
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => { setActiveTab('login'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'login' 
                      ? 'bg-white shadow text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Iniciar Sesión
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('register'); setError(''); setSuccess(''); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'register' 
                      ? 'bg-white shadow text-gray-900' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Registrarse
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
                  {success}
                </div>
              )}
              
              {activeTab === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        required
                        className="pl-10"
                        placeholder="tu@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="pl-10 pr-10"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center">
                      <input type="checkbox" className="rounded border-gray-300 mr-2" />
                      Recordarme
                    </label>
                    <a href="#" className="hover:underline" style={{ color: primaryColor }}>
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    style={{ backgroundColor: primaryColor }}
                    disabled={submitting}
                  >
                    {submitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          required
                          className="pl-10"
                          placeholder="Juan"
                          value={registerData.firstName}
                          onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apellido
                      </label>
                      <Input
                        required
                        placeholder="Pérez"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="email"
                        required
                        className="pl-10"
                        placeholder="tu@email.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="tel"
                        required
                        className="pl-10"
                        placeholder="+57 300 123 4567"
                        value={registerData.phone}
                        onChange={(e) => setRegisterData({ ...registerData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="pl-10 pr-10"
                        placeholder="Mínimo 6 caracteres"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirmar contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="pl-10"
                        placeholder="Repite tu contraseña"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <label className="flex items-start">
                      <input type="checkbox" required className="rounded border-gray-300 mr-2 mt-0.5" />
                      <span>
                        Acepto los{' '}
                        <a href="#" className="hover:underline" style={{ color: primaryColor }}>
                          términos y condiciones
                        </a>{' '}
                        y la{' '}
                        <a href="#" className="hover:underline" style={{ color: primaryColor }}>
                          política de privacidad
                        </a>
                      </span>
                    </label>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    style={{ backgroundColor: primaryColor }}
                    disabled={submitting}
                  >
                    {submitting ? 'Creando cuenta...' : 'Crear Cuenta'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      <SiteFooter 
        organization={organization} 
        settings={organization.website_settings} 
        primaryColor={primaryColor} 
      />
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  )
}
