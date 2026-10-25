import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { SectionRenderer } from '../SectionRenderer'
import { visibilidadDesdeDocumento } from '@/lib/website/v2/estiloSeccion'
import type { OrganizationWithDetails, WebsitePageSection } from '@/types/database'

/** Las secciones opt-in del documento también se componen alrededor del carrito y checkout. */
export async function UrgenciasUbicacion({ organization, ubicacion, primaryColor, branchId, prefijoSede }: {
  organization: OrganizationWithDetails
  ubicacion: 'carrito' | 'checkout'
  primaryColor: string
  branchId?: number | null
  prefijoSede?: string
}) {
  const sitio = await getSitioPublicoV2(organization.id, branchId)
  const secciones = sitio?.documento.paginas.filter((pagina) => pagina.publicada || pagina.tipo === 'product_detail' || pagina.tipo === 'category_detail').flatMap((pagina) => pagina.secciones)
    .filter((s) => s.tipo === 'urgency' && Array.isArray(s.contenido.locations) && s.contenido.locations.includes(ubicacion)) ?? []
  return <>{secciones.map((s, i) => <SectionRenderer key={s.id} organization={organization} primaryColor={primaryColor} data={{ ubicacion, branchId, prefijoSede }} section={{
    id: s.id, page_id: '__urgencia__', organization_id: organization.id, section_type: 'urgency', section_variant: 'default', content: s.contenido, settings: { ...(s.diseno ?? {}), visibilidad: visibilidadDesdeDocumento(s.visibilidad) }, sort_order: i, is_visible: true, created_at: '', updated_at: '',
  } as WebsitePageSection} />)}</>
}
