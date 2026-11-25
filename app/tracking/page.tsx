import { redirect } from 'next/navigation'

/**
 * /tracking pasó a /rastrear y /rastrear a «Consultar pedido» (/consultar-pedido, Figma «16 Sitio
 * web» › Consultar pedido v2): la misma búsqueda por guía de transportadora, junto a «Número de
 * pedido + correo o teléfono». Los enlaces viejos (`/tracking?q=<guía>`, en correos ya enviados)
 * siguen funcionando: llevan directo a la pestaña «Guía», sin pasar por /rastrear.
 */
export const dynamic = 'force-dynamic'

export default async function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  redirect(q ? `/consultar-pedido?guia=${encodeURIComponent(q)}` : '/consultar-pedido?modo=guia')
}
