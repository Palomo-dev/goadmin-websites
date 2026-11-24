'use client'

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { TelefonoPais } from '@/components/site/TelefonoPais'
import { useAcceso } from '@/components/site/cuenta/useAcceso'
import { PasoCodigo, PasoCorreo } from '@/components/site/cuenta/IngresoCodigo'
import { destinoInterno } from '@/lib/cuenta/reglasCuenta'

interface AuthFormProps {
  organizationId: number
  organizationName: string
  logoUrl?: string | null
  primaryColor: string
  /** «Continuar con Google» (`header_cuenta.google`; apagado mientras la tienda no lo active). */
  google?: boolean
}

/**
 * Página /auth: ingresar, registrarse y recuperar la contraseña. Desde el 2026-11-24 (Figma
 * 2975:71911) ingresar es primero con el código de 6 dígitos al correo; «Ingresar con contraseña»
 * abre el formulario de siempre. La lógica de sesión es la misma del panel, la ventana, el diálogo
 * y la hoja (useAcceso). `?siguiente=/ruta` vuelve a esa ruta del sitio después de entrar.
 */
export function AuthForm({ organizationId, organizationName, logoUrl, primaryColor, google = false }: AuthFormProps) {
  const searchParams = useSearchParams()
  const pestana = searchParams.get('tab')
  const initialTab = pestana === 'register' ? 'register' : pestana === 'forgot' ? 'forgot' : 'login'

  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(initialTab)
  // Ingresar: primero el código; `?modo=contrasena` (enlaces viejos o quien la prefiere) abre la contraseña.
  const [modoIngreso, setModoIngreso] = useState<'correo' | 'codigo' | 'contrasena'>(searchParams.get('modo') === 'contrasena' ? 'contrasena' : 'correo')
  const [correoCodigo, setCorreoCodigo] = useState('')
  const [enviadoEn, setEnviadoEn] = useState<number | null>(null)
  const siguiente = destinoInterno(searchParams.get('siguiente'))
  const errorGoogle = searchParams.get('error') === 'google'
  const [forgotEmail, setForgotEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const irACuenta = useCallback(() => {
    window.location.href = siguiente
  }, [siguiente])
  const { enviando: submitting, error, exito: success, setError, setExito: setSuccess, ingresar, registrar, recuperar, pedirCodigo, entrarConCodigo } = useAcceso({
    organizationId,
    pagina: true,
    alEntrar: irACuenta,
  })

  const [loginData, setLoginData] = useState({ email: '', password: '' })
  // Marcada por defecto: la sesión larga de siempre; quien la desmarca, solo hasta cerrar el navegador.
  const [recordarme, setRecordarme] = useState(true)
  const [registerData, setRegisterData] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    await ingresar({ ...loginData, recordarme })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    await registrar(registerData)
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

          {errorGoogle && !error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">No pudimos entrar con Google. Intenta con el código al correo.</div>
          )}
          {error && !(activeTab === 'login' && modoIngreso !== 'contrasena') && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-lg text-sm">{success}</div>
          )}

          {activeTab === 'login' && modoIngreso === 'correo' ? (
            <div style={{ ['--primary-color' as string]: primaryColor }}>
              <PasoCorreo
                correo={correoCodigo}
                onCorreo={setCorreoCodigo}
                enviando={submitting}
                error={error}
                google={google}
                siguiente={siguiente}
                onEnviar={async () => {
                  if (await pedirCodigo(correoCodigo)) {
                    setEnviadoEn(Date.now())
                    setModoIngreso('codigo')
                  }
                }}
                onContrasena={() => {
                  setError('')
                  setLoginData((d) => ({ ...d, email: d.email || correoCodigo }))
                  setModoIngreso('contrasena')
                }}
              />
            </div>
          ) : activeTab === 'login' && modoIngreso === 'codigo' ? (
            <div style={{ ['--primary-color' as string]: primaryColor }}>
              <PasoCodigo
                correo={correoCodigo}
                enviando={submitting}
                error={error}
                enviadoEn={enviadoEn}
                onCambiarCorreo={() => {
                  setError('')
                  setModoIngreso('correo')
                }}
                onReenviar={async () => {
                  if (await pedirCodigo(correoCodigo)) setEnviadoEn(Date.now())
                }}
                onEntrar={(codigo, recordarmeCodigo) => {
                  void entrarConCodigo({ email: correoCodigo, codigo, recordarme: recordarmeCodigo })
                }}
              />
            </div>
          ) : activeTab === 'login' ? (
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
                  <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600 mr-2" checked={recordarme} onChange={(e) => setRecordarme(e.target.checked)} />
                  Recordarme
                </label>
                <button type="button" onClick={() => { setActiveTab('forgot'); setError(''); setSuccess(''); setForgotEmail(loginData.email) }} className="hover:underline" style={{ color: primaryColor }}>¿Olvidaste tu contraseña?</button>
              </div>
              <Button type="submit" className="w-full" style={{ backgroundColor: primaryColor }} disabled={submitting}>
                {submitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => { setError(''); setModoIngreso('correo') }} className="text-sm hover:underline" style={{ color: primaryColor }}>
                  Prefiero recibir un código al correo
                </button>
              </div>
            </form>
          ) : activeTab === 'register' ? (
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
                <TelefonoPais required className="rounded-md border border-input bg-background text-sm [&_input]:h-9" value={registerData.phone} onChange={(v) => setRegisterData({ ...registerData, phone: v })} aria-label="Teléfono" />
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
          ) : null}

          {activeTab === 'forgot' && (
            <form onSubmit={async (e) => {
              e.preventDefault()
              await recuperar(forgotEmail)
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
