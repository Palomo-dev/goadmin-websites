/**
 * «Recordarme» del acceso a la cuenta (página /auth y panel, diálogo y hoja de la cabecera).
 *
 * La sesión del cliente son las cookies de Supabase (`sb-<proyecto>-auth-token`, en trozos) que
 * escriben @supabase/ssr y sus `setAll`: /api/auth/login al ingresar, el middleware al refrescar el
 * token en cada petición, el cliente del navegador (setSession y el refresco automático) y los
 * clientes de servidor. La librería les pone `maxAge` de 400 días y no deja cambiarlo por opción.
 *
 * - Marcada (o sin el campo): la sesión larga de siempre, nada cambia.
 * - Sin marcar: /api/auth/login deja la marca `gs_sesion_corta=1` (cookie de sesión) y cada `setAll`
 *   escribe las cookies de Supabase SIN `maxAge` ni `expires`: cookies de sesión que el navegador
 *   borra al cerrarse. Mismo `path`, `sameSite` y `httpOnly` de hoy; solo cambia la duración.
 *
 * La marca no es secreta (solo dice «sesión corta») y la lee el cliente del navegador: no es
 * httpOnly. Al cerrar sesión (/api/auth/logout) o al ingresar con «Recordarme» se borra.
 *
 * Código puro, sin imports: lo usan el middleware, los clientes de Supabase y las pruebas.
 */

export const MARCA_SESION_CORTA = 'gs_sesion_corta'

interface OpcionesCookie {
  maxAge?: number
  expires?: Date
}

/** Un `setAll` que borra la cookie (valor vacío, `maxAge` 0 o vencida) no se toca. */
function esBorrado(valor: string, opciones: OpcionesCookie): boolean {
  if (!valor) return true
  if (typeof opciones.maxAge === 'number' && opciones.maxAge <= 0) return true
  return opciones.expires instanceof Date && opciones.expires.getTime() <= Date.now()
}

/**
 * Opciones con las que se escribe una cookie de sesión de Supabase. Con sesión corta, sin
 * vencimiento (cookie de sesión del navegador); si no, las mismas de siempre (el mismo objeto).
 */
export function opcionesCookieSesion<T extends OpcionesCookie>(valor: string, opciones: T, corta: boolean): T {
  if (!corta || esBorrado(valor, opciones)) return opciones
  const resto: T = { ...opciones }
  delete resto.maxAge
  delete resto.expires
  return resto
}

/** La cabecera `Cookie` (o `document.cookie`) trae la marca de sesión corta. */
export function hayMarcaSesionCorta(cabecera: string | null | undefined): boolean {
  return (cabecera ?? '').split(';').some((parte) => parte.trim() === `${MARCA_SESION_CORTA}=1`)
}

/** Opciones de la marca: cookie de sesión (sin vencimiento), legible por el navegador, `lax`. */
export function opcionesMarcaSesionCorta(https: boolean): { path: string; sameSite: 'lax'; httpOnly: false; secure: boolean } {
  return { path: '/', sameSite: 'lax', httpOnly: false, secure: https }
}
