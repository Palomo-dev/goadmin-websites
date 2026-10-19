/**
 * Lee la marca con la que sale el correo de un pedido pagado.
 *
 * Organización del pedido (nunca del body). El documento V2 es el publicado;
 * el borrador no se lee. Si una consulta falla, se arma la marca con lo que
 * sí llegó: un correo sin logo sigue siendo mejor que no avisar el pago.
 */

import { ensamblarMarca, type DominioRemitente, type MarcaCorreoPedido } from '@/lib/email/marcaCorreoPedido'

type Cliente = { from: (tabla: string) => any }

function campoDocumento(doc: unknown, cual: 'logo' | 'color'): unknown {
  if (!doc || typeof doc !== 'object') return null
  const d = doc as { identidad?: { logoUrl?: unknown }; tema?: { colores?: { primario?: unknown } } }
  return cual === 'logo' ? d.identidad?.logoUrl ?? null : d.tema?.colores?.primario ?? null
}

export async function cargarMarcaPedido(
  sb: Cliente,
  organizationId: number,
  branchId: number | null,
): Promise<MarcaCorreoPedido> {
  const vacia: MarcaCorreoPedido = { nombre: '', correo: null, logoUrl: null, color: null, dominios: [] }
  try {
    const [org, sede, ajustes, dominios, estados] = await Promise.all([
      sb.from('organizations').select('name, email, logo_url, primary_color').eq('id', organizationId).maybeSingle(),
      branchId
        ? sb.from('branches').select('email, website_logo_url').eq('id', branchId).eq('organization_id', organizationId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      sb.from('website_settings').select('branch_id, primary_color').eq('organization_id', organizationId),
      sb.from('email_domains').select('domain, from_email, is_default, status').eq('organization_id', organizationId).eq('status', 'verified'),
      sb.from('website_site_states').select('branch_id, v2_adopted, published_revision_id').eq('organization_id', organizationId),
    ])
    for (const [etiqueta, res] of [
      ['organización', org],
      ['sede', sede],
      ['ajustes', ajustes],
      ['dominios', dominios],
      ['sitio', estados],
    ] as const) {
      if (res.error) console.error('[CorreoPedido] No se pudo leer la marca', { organizationId, etiqueta, error: res.error.message })
    }

    const filasEstado: { branch_id: number | null; v2_adopted: boolean; published_revision_id: string | null }[] =
      Array.isArray(estados.data) ? estados.data : []
    const principal = filasEstado.find((f) => f.branch_id == null) ?? null
    const deSede = branchId != null ? filasEstado.find((f) => f.branch_id === branchId) ?? null : null
    const v2Principal = !!(principal?.v2_adopted && principal.published_revision_id)
    const v2Sede = !!(deSede?.v2_adopted && deSede.published_revision_id)
    const ids = [v2Principal ? principal?.published_revision_id : null, v2Sede ? deSede?.published_revision_id : null].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    )
    const documentos = new Map<string, unknown>()
    if (ids.length > 0) {
      const revs = await sb
        .from('website_site_revisions')
        .select('id, document')
        .eq('organization_id', organizationId)
        .in('id', ids)
      if (revs.error) console.error('[CorreoPedido] No se pudo leer la revisión publicada', { organizationId, error: revs.error.message })
      for (const fila of revs.data || []) {
        if (fila?.id) documentos.set(String(fila.id), fila.document)
      }
    }

    const filasAjustes: { branch_id: number | null; primary_color: string | null }[] = Array.isArray(ajustes.data) ? ajustes.data : []
    const global = filasAjustes.find((f) => f.branch_id == null) ?? null
    const propia = branchId != null ? filasAjustes.find((f) => f.branch_id === branchId) ?? null : null
    const lista: DominioRemitente[] = (Array.isArray(dominios.data) ? dominios.data : []).map((d: { domain?: string; from_email?: string; is_default?: boolean }) => ({
      domain: String(d.domain || ''),
      fromEmail: String(d.from_email || ''),
      isDefault: d.is_default === true,
    }))
    const docPrincipal = v2Principal && principal?.published_revision_id ? documentos.get(principal.published_revision_id) : null
    const docSede = v2Sede && deSede?.published_revision_id ? documentos.get(deSede.published_revision_id) : null

    return ensamblarMarca({
      nombre: org.data?.name,
      correoOrganizacion: org.data?.email,
      correoSede: sede.data?.email,
      logoOrganizacion: org.data?.logo_url,
      logoSede: sede.data?.website_logo_url,
      colorOrganizacion: org.data?.primary_color,
      colorAjustes: global?.primary_color,
      colorAjustesSede: propia?.primary_color,
      logoV2Principal: campoDocumento(docPrincipal, 'logo'),
      colorV2Principal: campoDocumento(docPrincipal, 'color'),
      logoV2Sede: campoDocumento(docSede, 'logo'),
      colorV2Sede: campoDocumento(docSede, 'color'),
      v2Principal,
      v2Sede,
      dominios: lista,
    })
  } catch (err) {
    console.error('[CorreoPedido] No se pudo armar la marca', { organizationId, err: err instanceof Error ? err.message : err })
    return vacia
  }
}
