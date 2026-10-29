import { redirect } from 'next/navigation'
import { getOrgContext } from '@/lib/get-org-context'

export const dynamic = 'force-dynamic'

/**
 * `/buscar` (nombre en español que la gente escribe a mano) → `/search` con los mismos
 * parámetros y el prefijo de sede si lo hay. Antes caía en «página no encontrada».
 */
export default async function BuscarRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getOrgContext()
  const params = new URLSearchParams()
  for (const [clave, valor] of Object.entries(await searchParams)) {
    if (typeof valor === 'string') params.set(clave, valor)
    else if (Array.isArray(valor) && valor[0] !== undefined) params.set(clave, valor[0])
  }
  const qs = params.toString()
  redirect(`${ctx?.prefijoSede ?? ''}/search${qs ? `?${qs}` : ''}`)
}
