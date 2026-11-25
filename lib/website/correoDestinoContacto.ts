/**
 * CONTAC-03: «Email de destino» (`email_to`) de una sección `contact_form`, leído en el SERVIDOR.
 * Nunca se confía en un correo que mande el navegador: el body solo trae el id de la sección y aquí
 * se busca esa sección en el sitio publicado de la organización del host (V2 o legacy).
 *
 * Contacto v2: la misma lectura devuelve también el contenido y la variante de la sección, para que
 * /api/contact valide los campos obligatorios con la regla del formulario que vio el cliente. El
 * formulario de la página Contacto armada por la tienda (sin página por secciones) llega con
 * `ID_FORMULARIO_RESPALDO`: su copia va al correo de contacto del sitio (antes no avisaba a nadie).
 */
import { getSitioPublicoV2 } from './v2/lectorPublico'
import { destinatariosDe } from '@/lib/email/send-contact-notice'
import { ID_FORMULARIO_RESPALDO, VARIANTE_FORMULARIO_TARJETA } from './v2/contrato/paginaContacto'

type SeccionV2 = { id?: unknown; tipo?: unknown; variante?: unknown; contenido?: Record<string, unknown> }
type Documento = { paginas?: { secciones?: SeccionV2[] }[] }

/** Sección `contact_form` del sitio: su contenido y su variante. */
export interface SeccionContacto {
  contenido: Record<string, unknown>
  variante: string | null
  /** El formulario de respaldo de la tienda (no es una sección guardada). */
  respaldo: boolean
}

function seccionEnDocumento(documento: unknown, sectionId: string): SeccionContacto | null {
  const paginas = (documento as Documento | null)?.paginas ?? []
  for (const p of paginas) {
    for (const s of p.secciones ?? []) {
      if (s.id === sectionId && s.tipo === 'contact_form') {
        return { contenido: s.contenido ?? {}, variante: typeof s.variante === 'string' ? s.variante : null, respaldo: false }
      }
    }
  }
  return null
}

export function emailToEnDocumento(documento: unknown, sectionId: string): string[] {
  return destinatariosDe(seccionEnDocumento(documento, sectionId)?.contenido.email_to)
}

/**
 * La sección `contact_form` con ese id en el sitio de la organización del host (V2: la sede y, si
 * no está, el principal; legacy: la fila, siempre filtrada por la organización). `null` si no hay.
 */
export async function seccionContacto(
  supabase: any,
  organizationId: number,
  sectionId: unknown,
  branchId: number | null
): Promise<SeccionContacto | null> {
  if (typeof sectionId !== 'string' && typeof sectionId !== 'number') return null
  const id = String(sectionId).slice(0, 80)
  if (!id) return null
  if (id === ID_FORMULARIO_RESPALDO) return { contenido: {}, variante: VARIANTE_FORMULARIO_TARJETA, respaldo: true }
  try {
    const sitio = await getSitioPublicoV2(organizationId, branchId)
    if (sitio) {
      const enV2 = seccionEnDocumento(sitio.documento, id)
      if (enV2) return enV2
      if (sitio.principal?.documento) {
        const enPrincipal = seccionEnDocumento(sitio.principal.documento, id)
        if (enPrincipal) return enPrincipal
      }
    }
    if (!/^[0-9a-f-]{1,64}$/i.test(id)) return null
    const { data } = await supabase
      .from('website_page_sections')
      .select('section_type, section_variant, content')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (data?.section_type !== 'contact_form') return null
    return {
      contenido: (data.content as Record<string, unknown> | null) ?? {},
      variante: typeof data.section_variant === 'string' ? data.section_variant : null,
      respaldo: false,
    }
  } catch (error) {
    console.error('[contact] no se pudo leer la sección:', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Destinatarios de la copia: el `email_to` de la sección o, en el formulario de respaldo, el correo
 * de contacto del sitio (`website_settings.contact_email`, si no el de la organización).
 */
export function destinoDeSeccion(
  seccion: SeccionContacto | null,
  correosSitio: { contact_email?: unknown; email?: unknown }
): string[] {
  if (!seccion) return []
  if (seccion.respaldo) {
    const delSitio = destinatariosDe(correosSitio.contact_email)
    return delSitio.length > 0 ? delSitio : destinatariosDe(correosSitio.email)
  }
  return destinatariosDe(seccion.contenido.email_to)
}

export async function correoDestinoContacto(
  supabase: any,
  organizationId: number,
  sectionId: unknown,
  branchId: number | null,
  correosSitio: { contact_email?: unknown; email?: unknown } = {}
): Promise<string[]> {
  return destinoDeSeccion(await seccionContacto(supabase, organizationId, sectionId, branchId), correosSitio)
}
