'use client'

/**
 * Lógica de sesión de la tienda en UN solo lugar: código de 6 dígitos al correo (lo principal desde
 * el 2026-11-24, Figma 2975:71911), ingresar con contraseña, crear cuenta y recuperar la
 * contraseña. La usan la página /auth (AuthForm) y el panel, la ventana, el diálogo y la hoja del
 * celular (FormularioAcceso, Figma «16 Sitio web» 2834:68670). Mismos endpoints de siempre
 * (/api/auth/login, /api/auth/register, /api/auth/forgot-password) y mismas validaciones.
 *
 * El código: /api/auth/codigo lo envía y /api/auth/codigo/verificar entra (y crea o vincula la
 * ficha de la tienda). Las API fijan las cookies de sesión; aquí se sincroniza la sesión en el cliente del navegador
 * para que la cabecera (onAuthStateChange) se entere sin recargar.
 */
import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ERROR_INGRESO_GENERICO } from '@/lib/website/v2/cabeceraTienda'
import { errorContrasena } from '@/lib/cuenta/reglasCuenta'

export interface DatosIngreso {
  email: string
  password: string
  /**
   * «Recordarme». `false` = la sesión dura hasta cerrar el navegador; `true` o sin el campo = la
   * sesión larga de siempre (lib/auth/sesionCorta.ts).
   */
  recordarme?: boolean
}

export interface DatosRegistro {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

export type TipoEntrada = 'ingreso' | 'registro'

export interface DatosCodigo {
  email: string
  codigo: string
  /** «Recordarme en este celular»: `false` = sesión hasta cerrar el navegador. */
  recordarme?: boolean
}

interface OpcionesAcceso {
  organizationId: number
  /**
   * `true` en la página /auth: conserva sus mensajes de hoy y, tras registrarse, siempre va a
   * Mi cuenta. Los demás modos (panel, ventana, diálogo y hoja) dan un error de ingreso que no
   * dice si falló el correo o la contraseña, y solo siguen si el registro deja sesión.
   */
  pagina?: boolean
  /** Tras ingresar o registrarse con sesión: la página redirige; los demás modos deciden. */
  alEntrar: (tipo: TipoEntrada) => void | Promise<void>
}

/** Valida el registro como siempre. `null` = sin error. */
export function errorRegistro(datos: Pick<DatosRegistro, 'password' | 'confirmPassword'>): string | null {
  // La misma regla de «Crear contraseña» en Mis datos (lib/cuenta/reglasCuenta.ts).
  return errorContrasena(datos)
}

async function sincronizarSesion(session: { access_token?: string; refresh_token?: string } | null | undefined) {
  if (!session?.access_token || !session?.refresh_token) return false
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  return true
}

export function useAcceso({ organizationId, pagina = false, alEntrar }: OpcionesAcceso) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  const limpiar = useCallback(() => {
    setError('')
    setExito('')
  }, [])

  /** Ingresar. `true` si entró. */
  const ingresar = useCallback(
    async (datos: DatosIngreso): Promise<boolean> => {
      setEnviando(true)
      setError('')
      try {
        // Auth vía API (el servidor persiste las cookies).
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, email: datos.email, password: datos.password, recordarme: datos.recordarme !== false }),
        })
        const data = await res.json()
        if (data.error) {
          setError(pagina ? data.error : ERROR_INGRESO_GENERICO)
          return false
        }
        await sincronizarSesion(data.session)
        setExito('¡Bienvenido de vuelta!')
        await alEntrar('ingreso')
        return true
      } catch {
        setError('Error al iniciar sesión. Intenta de nuevo.')
        return false
      } finally {
        setEnviando(false)
      }
    },
    [organizationId, pagina, alEntrar],
  )

  /** Crear cuenta. `true` si quedó creada (con o sin sesión, según la confirmación de correo). */
  const registrar = useCallback(
    async (datos: DatosRegistro): Promise<boolean> => {
      setEnviando(true)
      setError('')
      const invalido = errorRegistro(datos)
      if (invalido) {
        setError(invalido)
        setEnviando(false)
        return false
      }
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            firstName: datos.firstName,
            lastName: datos.lastName,
            email: datos.email,
            phone: datos.phone,
            password: datos.password,
          }),
        })
        const data = await res.json()
        if (data.error) {
          setError(data.error)
          return false
        }
        const conSesion = await sincronizarSesion(data.session)
        setExito(data.message || '¡Cuenta creada exitosamente!')
        // Sin sesión (confirmación por correo pendiente) no hay a dónde llevarlo: queda el aviso.
        if (conSesion || pagina) await alEntrar('registro')
        return true
      } catch {
        setError('Error al crear la cuenta. Intenta de nuevo.')
        return false
      } finally {
        setEnviando(false)
      }
    },
    [organizationId, pagina, alEntrar],
  )

  /** Enviar el enlace de recuperación. `true` si la API respondió (exista o no la cuenta). */
  const recuperar = useCallback(async (email: string): Promise<boolean> => {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return false
      }
      setExito(data.message)
      return true
    } catch {
      setError('Error al enviar el enlace. Intenta de nuevo.')
      return false
    } finally {
      setEnviando(false)
    }
  }, [])

  /** Pide el código de 6 dígitos. `true` si se envió. */
  const pedirCodigo = useCallback(async (email: string): Promise<boolean> => {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/auth/codigo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setError(data.error || 'No pudimos enviar el código. Intenta de nuevo.')
        return false
      }
      return true
    } catch {
      setError('No pudimos enviar el código. Revisa tu conexión.')
      return false
    } finally {
      setEnviando(false)
    }
  }, [])

  /** Entra con el código. `true` si entró (la ficha de la tienda queda creada o vinculada). */
  const entrarConCodigo = useCallback(
    async (datos: DatosCodigo): Promise<boolean> => {
      setEnviando(true)
      setError('')
      try {
        const res = await fetch('/api/auth/codigo/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: datos.email, codigo: datos.codigo, recordarme: datos.recordarme !== false }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data.error) {
          setError(data.error || 'El código no coincide. Revísalo o pide uno nuevo.')
          return false
        }
        await sincronizarSesion(data.session)
        setExito('¡Bienvenido!')
        await alEntrar('ingreso')
        return true
      } catch {
        setError('No pudimos verificar el código. Revisa tu conexión.')
        return false
      } finally {
        setEnviando(false)
      }
    },
    [alEntrar],
  )

  return { enviando, error, exito, setError, setExito, limpiar, ingresar, registrar, recuperar, pedirCodigo, entrarConCodigo }
}

/** Cerrar sesión: el servidor borra las cookies y el cliente del navegador la suelta. */
export async function cerrarSesionTienda(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // Sin red: igual se suelta en el navegador.
  }
  try {
    await createClient().auth.signOut()
  } catch {
    // Nada más que hacer.
  }
}
