import { Metadata } from 'next'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { EnlaceSitio } from '@/components/site/EnlaceSitio'
import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient } from '@/lib/supabase/server'
import { enlaceResenaValido } from '@/lib/resenas/firmaResena'
import { cargarAjustesResenas } from '@/lib/resenas/ajustesResenas'
import { nombrePila, productosDelCorreo, type LineaPedido } from '@/lib/resenas/pedirResena'
import { ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { FormularioDesdeCorreo, type ProductoOpinable } from '@/components/site/reviews/FormularioDesdeCorreo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: '¿Qué te pareció?', robots: { index: false, follow: false } }

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `/opinar/<pedido>?t=<firma>&p=<producto>&r=<estrellas>` — formulario desde el correo «¿Qué te
 * pareció tu compra?» (Figma 3B). Sin iniciar sesión: el enlace firmado (30 días) demuestra que la
 * persona recibió el correo de ESE pedido. Organización del host; el pedido debe ser de ella y
 * estar entregado. Los productos que ya tienen opinión de este pedido salen como «Ya opinaste».
 */
export default async function OpinarPage({
  params,
  searchParams,
}: {
  params: Promise<{ pedido: string }>
  searchParams: Promise<{ t?: string | string[]; p?: string | string[]; r?: string | string[] }>
}) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, branchId } = ctx
  const { pedido } = await params
  const q = await searchParams
  const t = typeof q.t === 'string' ? q.t : ''
  const p = Number(typeof q.p === 'string' ? q.p : NaN)
  const r = Number(typeof q.r === 'string' ? q.r : NaN)

  const envolver = (hijo: React.ReactNode) => (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason} branchId={branchId}>
      <div className="container mx-auto max-w-xl px-4 py-8">{hijo}</div>
    </OrganizationLayout>
  )
  const aviso = (titulo: string, texto: string) =>
    envolver(
      <div className="rounded-2xl border border-gray-200 p-6 text-center dark:border-gray-700">
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{titulo}</p>
        <p className="mt-2 text-sm text-gray-500">{texto}</p>
        <EnlaceSitio href="/productos" className="mt-4 inline-block text-sm font-semibold underline" style={{ color: primaryColor }}>Ir a la tienda</EnlaceSitio>
      </div>,
    )

  const org = organization.id
  if (!PATRON_UUID.test(pedido) || !enlaceResenaValido(org, pedido, t)) {
    return aviso('Este enlace ya no sirve', 'Venció o está incompleto. Puedes opinar desde la página del producto.')
  }
  const sb = createAdminClient() as any
  if (!sb) return aviso('No pudimos abrir el formulario', 'Intenta de nuevo en unos minutos.')

  const [{ data: orden }, { data: orgFila }, ajustes] = await Promise.all([
    sb
      .from('web_orders')
      .select('id, order_number, status, customer_name, delivered_at, web_order_items ( product_id, product_name )')
      .eq('organization_id', org)
      .eq('id', pedido)
      .maybeSingle(),
    sb.from('organizations').select('timezone').eq('id', org).maybeSingle(),
    cargarAjustesResenas(sb, org),
  ])
  if (!orden) return aviso('No encontramos tu pedido', 'Revisa el enlace del correo.')
  if (orden.status !== 'delivered') return aviso('Tu pedido aún no se entrega', 'Podrás opinar cuando llegue.')

  const items = (orden.web_order_items ?? []) as { product_id: number | null; product_name: string | null }[]
  const ids = Array.from(new Set(items.map((i) => Number(i.product_id)).filter((x) => Number.isInteger(x) && x > 0)))
  const padres = new Map<number, number | null>()
  if (ids.length > 0) {
    const { data } = await sb.from('products').select('id, parent_product_id').eq('organization_id', org).in('id', ids)
    for (const f of (data ?? []) as { id: number; parent_product_id: number | null }[]) padres.set(f.id, f.parent_product_id ?? null)
  }
  const lineas: LineaPedido[] = items.map((i) => {
    const id = Number(i.product_id) || null
    return { productId: id, fichaId: id ? padres.get(id) ?? id : null, nombre: String(i.product_name || '') }
  })
  const fichas = productosDelCorreo(lineas)
  const { data: opiniones } = await sb.from('product_reviews').select('product_id').eq('organization_id', org).eq('order_id', pedido)
  const opinados = new Set(((opiniones ?? []) as { product_id: number }[]).map((o) => o.product_id))
  const productos: ProductoOpinable[] = fichas.map((f) => ({ id: f.fichaId, nombre: f.nombre, yaOpino: opinados.has(f.fichaId) }))

  let entregado = ''
  if (orden.delivered_at) {
    const d = new Date(orden.delivered_at)
    if (!Number.isNaN(d.getTime())) {
      try {
        entregado = `entregado el ${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: orgFila?.timezone || ZONA_POR_DEFECTO }).format(d)}`
      } catch {
        entregado = ''
      }
    }
  }
  const completo = typeof orden.customer_name === 'string' ? orden.customer_name.trim().split(/\s+/) : []
  const nombre = completo.length > 1 ? `${nombrePila(orden.customer_name)} ${completo[completo.length - 1].charAt(0).toUpperCase()}.` : nombrePila(orden.customer_name)

  return envolver(
    <FormularioDesdeCorreo
      primaryColor={primaryColor}
      orderId={pedido}
      token={t}
      numeroPedido={String(orden.order_number ?? '')}
      entregado={entregado}
      nombre={nombre}
      productos={productos}
      productoInicial={Number.isInteger(p) ? p : null}
      ratingInicial={Number.isInteger(r) && r >= 1 && r <= 5 ? r : 0}
      fotosPermitidas={ajustes?.fotos ?? true}
      moderar={ajustes?.moderar ?? true}
    />,
  )
}
