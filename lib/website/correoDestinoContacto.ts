/**
 * CONTAC-03: «Email de destino» (`email_to`) de una sección `contact_form`, leído en el SERVIDOR.
 * Nunca se confía en un correo que mande el navegador: el body solo trae el id de la sección y aquí
 * se busca esa sección en el sitio publicado de la organización del host (V2 o legacy).
 */
import { getSitioPublicoV2 } from './v2/lectorPublico'
import { destinatariosDe } from '@/lib/email/send-contact-notice'

type Documento = { paginas?: { secciones?: { id?: unknown; tipo?: unknown; contenido?: Record<string, unknown> }[] }[] }

export function emailToEnDocumento(documento: unknown, sectionId: string): string[] {
  const paginas = (documento as Documento | null)?.paginas ?? []
  for (const p of paginas) {
    for (const s of p.secciones ?? []) {
      if (s.id === sectionId && s.tipo === 'contact_form') return destinatariosDe(s.contenido?.email_to)
    }
  }
  return []
}

export async function correoDestinoContacto(
  supabase: any,
  organizationId: number,
  sectionId: unknown,
  branchId: number | null
): Promise<string[]> {
  if (typeof sectionId !== 'string' && typeof sectionId !== 'number') return []
  const id = String(sectionId).slice(0, 80)
  if (!id) return []
  try {
    const sitio = await getSitioPublicoV2(organizationId, branchId)
    if (sitio) {
      const enV2 = emailToEnDocumento(sitio.documento, id)
      if (enV2.length > 0) return enV2
      if (sitio.principal?.documento) {
        const enPrincipal = emailToEnDocumento(sitio.principal.documento, id)
        if (enPrincipal.length > 0) return enPrincipal
      }
    }
    // Sitio legacy: la fila de la sección, siempre filtrada por la organización del host.
    if (!/^[0-9a-f-]{1,64}$/i.test(id)) return []
    const { data } = await supabase
      .from('website_page_sections')
      .select('section_type, content')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (data?.section_type !== 'contact_form') return []
    return destinatariosDe((data.content as Record<string, unknown> | null)?.email_to)
  } catch (error) {
    console.error('[contact] no se pudo leer email_to:', error instanceof Error ? error.message : String(error))
    return []
  }
}
