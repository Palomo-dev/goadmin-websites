/**
 * Abre la sesión del comprador en la tienda SIN que Supabase envíe ningún correo.
 *
 * Se llama solo después de que el código propio de la tienda acertó (lib/cuenta/codigoTienda.ts):
 * quien lo escribió es el dueño del correo.
 *
 * 1. Busca el usuario de Auth por correo (`fn_tienda_usuario_auth_por_correo`, solo service_role).
 * 2. Sin usuario: `auth.admin.createUser({ email, email_confirm: true })` (no envía correo).
 *    Con usuario: confirma el correo si no lo estaba (`admin.updateUserById`, no envía correo) y,
 *    si se pide, fija la contraseña escrita (registro o «Olvidé mi contraseña»). Si el correo no
 *    estaba confirmado y no hay contraseña nueva, `descartarClaveSinVerificar` cambia la que tenía
 *    por una al azar: la puso alguien que nunca probó ser dueño del correo.
 * 3. `auth.admin.generateLink({ type: 'magiclink' })` — genera el enlace SIN enviarlo (docs de
 *    Supabase: «Generates email links and OTPs to be sent via a custom email provider»).
 * 4. `verifyOtp({ type: 'magiclink', token_hash })` con el cliente de servidor que escribe las
 *    cookies de la tienda (createAuthClient): la sesión queda puesta, como en /api/auth/login.
 *
 * Las plantillas de Supabase Auth quedan solo para los usuarios del ERP.
 */

import { randomBytes } from 'crypto'
import { createClient, type Session, type User } from '@supabase/supabase-js'

type ClienteVerificacion = {
  auth: {
    verifyOtp: (p: { type: 'magiclink'; token_hash: string }) => Promise<{
      data: { user: User | null; session: Session | null }
      error: { message?: string; status?: number } | null
    }>
  }
}

export interface EntradaSesion {
  correo: string
  /** Contraseña nueva (registro u «Olvidé mi contraseña»). Ya validada por quien llama. */
  password?: string | null
  /** Datos del registro para el usuario nuevo (`user_metadata`). */
  metadatos?: Record<string, string | null> | null
  /** Entrar con código: una contraseña puesta sin confirmar el correo deja de servir. */
  descartarClaveSinVerificar?: boolean
  /**
   * Registro: la contraseña escrita solo se pone si la cuenta es nueva o no tenía el correo
   * confirmado. Una cuenta confirmada (p. ej. un usuario del ERP que se registra en una tienda con
   * su mismo correo) conserva su contraseña: entra con el código y la cambia, si quiere, en Mis datos.
   */
  soloClaveSiNueva?: boolean
}

export type ResultadoSesion = { ok: true; user: User; session: Session } | { ok: false; motivo: string }

function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !clave) return null
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function buscarUsuario(admin: NonNullable<ReturnType<typeof clienteAdmin>>, correo: string) {
  const { data, error } = await admin.rpc('fn_tienda_usuario_auth_por_correo', { p_email: correo })
  if (error) return { error: error.message, fila: null as null | { id: string; email_confirmed_at: string | null } }
  const fila = Array.isArray(data) ? data[0] : data
  return { error: null, fila: fila?.id ? { id: String(fila.id), email_confirmed_at: fila.email_confirmed_at ?? null } : null }
}

export async function abrirSesionSinCorreo(auth: ClienteVerificacion, entrada: EntradaSesion): Promise<ResultadoSesion> {
  const admin = clienteAdmin()
  if (!admin) return { ok: false, motivo: 'sin service role' }
  const correo = entrada.correo.trim().toLowerCase()
  const password = entrada.password || null

  let { error: errBusqueda, fila } = await buscarUsuario(admin, correo)
  if (errBusqueda) return { ok: false, motivo: `búsqueda: ${errBusqueda}` }

  if (!fila) {
    const { data, error } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      ...(password ? { password } : {}),
      ...(entrada.metadatos ? { user_metadata: entrada.metadatos } : {}),
    })
    if (error || !data?.user) {
      // Carrera (dos pestañas): otra petición lo creó entre la búsqueda y el alta.
      const otra = await buscarUsuario(admin, correo)
      if (!otra.fila) return { ok: false, motivo: `alta: ${error?.message ?? 'sin usuario'}` }
      fila = otra.fila
    } else {
      fila = null
    }
  }

  if (fila) {
    const cambios: { email_confirm?: boolean; password?: string } = {}
    if (!fila.email_confirmed_at) cambios.email_confirm = true
    if (password && (!entrada.soloClaveSiNueva || !fila.email_confirmed_at)) cambios.password = password
    else if (password) {
      // Registro sobre una cuenta ya confirmada: se conserva su contraseña.
    } else if (!fila.email_confirmed_at && entrada.descartarClaveSinVerificar) cambios.password = randomBytes(32).toString('base64url')
    if (Object.keys(cambios).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(fila.id, cambios)
      if (error) return { ok: false, motivo: `actualización: ${error.message}` }
    }
  }

  // Genera el enlace de un solo uso SIN enviarlo y lo canjea aquí mismo por la sesión.
  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: correo })
  const tokenHash = enlace?.properties?.hashed_token
  if (errEnlace || !tokenHash) return { ok: false, motivo: `enlace: ${errEnlace?.message ?? 'sin token'}` }

  const { data, error } = await auth.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (error || !data?.user || !data.session) return { ok: false, motivo: `sesión: ${error?.message ?? 'sin sesión'}` }
  return { ok: true, user: data.user, session: data.session }
}

/**
 * Cambia la contraseña de un usuario con sesión (Mis datos › Seguridad) por la API de admin:
 * `updateUser` del propio usuario puede pedir reautenticación (correo con un código de Supabase)
 * o disparar el aviso «Password changed» de Supabase. Esta no envía nada.
 */
export async function cambiarClaveSinCorreo(userId: string, password: string): Promise<{ ok: boolean; mensaje?: string }> {
  const admin = clienteAdmin()
  if (!admin) return { ok: false, mensaje: 'sin service role' }
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  return error ? { ok: false, mensaje: error.message } : { ok: true }
}
