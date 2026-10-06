import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CatchAllPage from '@/app/[[...slug]]/page'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { createAdminClient } from '@/lib/supabase/server'
import { urlEditorSegura, verificarTokenVistaPrevia } from '@/lib/website/v2/enlaceVistaPrevia'
import { getSitioBorradorV2 } from '@/lib/website/v2/lectorPublico'
import { fijarSitioVistaPrevia } from '@/lib/website/v2/vistaPreviaBorrador'
import { BarraVistaPrevia, type SitioSelector } from '@/components/site/BarraVistaPrevia'

/**
 * Vista previa privada del borrador V2 (Figma «05 Editor»: 1895:920555 computador,
 * 1895:920686 celular, componente «BarraVistaPrevia» 1886:919747).
 *
 * `/vista-previa/<token>/<ruta>`: el ERP firma el token (HMAC, caduca en 24 h). Con firma
 * válida, sin caducar y SOLO si la organización del token es la del host, se pinta el
 * borrador (`website_site_drafts`) en lugar de la revisión publicada. Cualquier otra cosa: 404.
 *
 * Dos capas: la página exterior es la barra (sede, computador/tableta/celular, copiar enlace,
 * volver al editor, publicar) con un iframe; el iframe (`?marco=1`) es el sitio armado con el
 * borrador, que reutiliza la página pública tal cual (`app/[[...slug]]/page.tsx`).
 *
 * Nunca se cachea (dinámica, sin revalidate) ni se indexa (`noindex` aquí y `X-Robots-Tag` +
 * `Cache-Control: private, no-store` en el middleware para `/vista-previa/*`).
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export const metadata: Metadata = {
  title: 'Vista previa del borrador',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

type Params = { token: string; slug?: string[] }
type Busqueda = Record<string, string | string[] | undefined>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Sede {
  id: number
  name: string
  slug: string | null
  is_web_published: boolean | null
}

async function sedesDe(organizationId: number, ids: number[]): Promise<Map<number, Sede>> {
  if (ids.length === 0) return new Map()
  const supabase = createAdminClient()
  if (!supabase) return new Map()
  const { data, error } = await (supabase as any)
    .from('branches')
    .select('id, name, slug, is_web_published')
    .eq('organization_id', organizationId)
    .in('id', ids)
  if (error) return new Map()
  return new Map(((data || []) as Sede[]).map((b) => [b.id, b]))
}

export default async function VistaPreviaBorradorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<Busqueda>
}) {
  const { token, slug } = await params
  const busqueda = await searchParams
  const verificacion = verificarTokenVistaPrevia(decodeURIComponent(token))
  if (!verificacion.ok) notFound()
  const { carga } = verificacion

  // La organización sale del host; el token solo la confirma. Otro host → 404.
  const orgDelHost = await getOrgIdDelHost()
  if (!orgDelHost || orgDelHost !== carga.o) notFound()

  const pedido = typeof busqueda.sitio === 'string' && UUID.test(busqueda.sitio) ? busqueda.sitio : carga.s
  const borrador = await getSitioBorradorV2(carga.o, pedido)
  if (!borrador) notFound()

  const sedes = await sedesDe(
    carga.o,
    borrador.sitios.map((s) => s.branchId).filter((b): b is number => typeof b === 'number'),
  )
  const ruta = (slug ?? []).filter(Boolean)

  // ── Capa interior: el sitio armado con el borrador ──
  if (busqueda.marco === '1') {
    fijarSitioVistaPrevia(carga.o, borrador.sitio)
    // Sitio de una sede: su prefijo de ruta, para que productos, stock y carta salgan de esa sede.
    const sede = borrador.sitio.branchId !== null ? sedes.get(borrador.sitio.branchId) : undefined
    const conSede = sede?.slug && sede.is_web_published ? [sede.slug, ...ruta] : ruta
    return CatchAllPage({ params: Promise.resolve({ slug: conSede }), searchParams: Promise.resolve({}) })
  }

  // ── Capa exterior: barra + iframe ──
  const sitios: SitioSelector[] = borrador.sitios
    .map((s) => ({
      id: s.id,
      nombre: s.branchId === null ? 'Principal' : sedes.get(s.branchId)?.name ?? `Sede ${s.branchId}`,
    }))
    .sort((a, b) => (a.nombre === 'Principal' ? -1 : b.nombre === 'Principal' ? 1 : a.nombre.localeCompare(b.nombre, 'es')))
  const editor = urlEditorSegura(carga.r)
  const rutaMarco = `/vista-previa/${encodeURIComponent(token)}${ruta.length ? `/${ruta.map(encodeURIComponent).join('/')}` : ''}`

  return (
    <BarraVistaPrevia
      rutaMarco={rutaMarco}
      sitioActual={borrador.sitio.siteStateId}
      sitios={sitios}
      caducaEn={carga.e}
      urlEditor={editor}
    />
  )
}
