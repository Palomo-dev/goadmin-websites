import { redirect } from 'next/navigation'

/**
 * /tracking pasó a /rastrear (Figma «16 Sitio web» 2975:72068): la misma búsqueda por guía de
 * transportadora, junto a «Número de pedido + correo o teléfono». Los enlaces viejos
 * (`/tracking?q=<guía>`, en correos ya enviados) siguen funcionando: llevan a la pestaña «Guía».
 */
export const dynamic = 'force-dynamic'

export default async function TrackingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  redirect(q ? `/rastrear?guia=${encodeURIComponent(q)}` : '/rastrear?modo=guia')
}
