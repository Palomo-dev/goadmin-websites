import { redirect } from 'next/navigation'

/**
 * /rastrear dejó de ser una página aparte (decisión del dueño, 2026-11-24): «Consultar pedido»
 * (/consultar-pedido) lo incluye todo. Los enlaces viejos (correos ya enviados, `?guia=`,
 * `?modo=guia`) siguen funcionando: se redirige conservando la búsqueda tal cual.
 */
export const dynamic = 'force-dynamic'

export default async function RastrearPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    if (typeof valor === 'string') query.append(clave, valor)
    else if (Array.isArray(valor)) valor.forEach((v) => query.append(clave, v))
  }
  const q = query.toString()
  redirect(q ? `/consultar-pedido?${q}` : '/consultar-pedido')
}
