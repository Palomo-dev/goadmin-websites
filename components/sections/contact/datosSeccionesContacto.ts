/**
 * Datos que pintan «Canales de contacto» y «Redes sociales» (Contacto v2), leídos una sola vez con
 * las reglas del contrato (`lib/website/v2/contrato/paginaContacto.ts`).
 *
 * Los usan las dos secciones y SectionRenderer: una sección sin datos no pinta nada en la tienda y
 * tampoco debe dejar su relleno (antes «Síguenos en redes» sin cuentas dejaba un hueco en blanco
 * encima del pie). Código puro: sin React.
 */
import {
  TIPO_CANALES_CONTACTO,
  TIPO_REDES_SOCIALES,
  canalesConDato,
  datosContactoDe,
  leerCanales,
  redesDeSeccion,
  type CanalConDato,
  type RedSocialSitio,
} from '@/lib/website/v2/contrato/paginaContacto'

type Organizacion = { phone?: unknown; email?: unknown; address?: unknown; city?: unknown; website_settings?: unknown } | null | undefined

function ajustesDe(organizacion: Organizacion): Record<string, unknown> | null {
  const a = organizacion?.website_settings
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as Record<string, unknown>) : null
}

/** Canales que salen en la tienda (WhatsApp con el respaldo del celular, sin repetir el teléfono). */
export function canalesDeSeccion(content: Record<string, unknown>, organizacion: Organizacion): CanalConDato[] {
  return canalesConDato(leerCanales(content.channels), datosContactoDe(organizacion, ajustesDe(organizacion)))
}

/** Redes que muestra la sección (las del sitio con enlace, filtradas por `networks`). */
export function redesDeLaSeccion(content: Record<string, unknown>, organizacion: Organizacion): RedSocialSitio[] {
  return redesDeSeccion(ajustesDe(organizacion)?.social_links, content.networks)
}

/** ¿La sección de Contacto v2 no tiene nada que pintar? Solo para canales y redes. */
export function seccionContactoVacia(tipo: string, content: Record<string, unknown>, organizacion: Organizacion): boolean {
  if (tipo === TIPO_CANALES_CONTACTO) return canalesDeSeccion(content, organizacion).length === 0
  if (tipo === TIPO_REDES_SOCIALES) return redesDeLaSeccion(content, organizacion).length === 0
  return false
}
