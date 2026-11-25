/**
 * Página Contacto de las tiendas que no la tienen por secciones (Contacto v2, nota 3104:84059).
 *
 * Antes, /contacto sin página caía en una versión escrita a mano: textos fijos, «Contáctanos» dos
 * veces, un mapa gris falso y un formulario sin «Email de destino». Ahora la tienda arma la página
 * con las MISMAS secciones por defecto que siembra el editor (contrato `paginaContacto.ts`), así se
 * ve igual que el diseño y el dueño la puede editar en cuanto cree la página. Nada se escribe en la
 * base: son secciones en memoria. El formulario lleva `ID_FORMULARIO_RESPALDO`, que el servidor
 * reconoce para mandar la copia al correo de contacto del sitio.
 *
 * La versión escrita a mano (`components/site/sections/ContactSection.tsx`) queda de respaldo:
 * `CONTACTO_ESCRITO_A_MANO=1` la vuelve a pintar sin desplegar código.
 */
import type { WebsitePageSection } from '@/types/database'
import { ID_FORMULARIO_RESPALDO, seccionesContactoPorDefecto } from './v2/contrato/paginaContacto'

export function contactoEscritoAMano(): boolean {
  return process.env.CONTACTO_ESCRITO_A_MANO === '1'
}

export function seccionesContactoRespaldo(organizationId: number): WebsitePageSection[] {
  const ahora = new Date(0).toISOString()
  return seccionesContactoPorDefecto().map((s, i) => ({
    id: s.section_type === 'contact_form' ? ID_FORMULARIO_RESPALDO : `contacto-respaldo-${i}`,
    page_id: 'contacto-respaldo',
    organization_id: organizationId,
    section_type: s.section_type,
    section_variant: s.section_variant,
    content: s.content as WebsitePageSection['content'],
    settings: {},
    sort_order: i,
    is_visible: true,
    created_at: ahora,
    updated_at: ahora,
  }))
}
