import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { catalogTag, CATALOG_TAG_ALL } from '@/lib/supabase/cache'

export const dynamic = 'force-dynamic'

/**
 * Invalida la caché del catálogo de una organización.
 *
 * Lo llama el ERP (fire-and-forget) cuando el comerciante edita productos,
 * precios o stock, para que el cambio se vea en la tienda sin esperar el TTL
 * de `cacheCatalog` (lib/supabase/cache.ts). Sin esta llamada el catálogo se
 * refresca solo a los 30 s, así que un fallo aquí nunca deja datos viejos
 * indefinidamente.
 *
 * Autenticación: cabecera `x-webhook-secret` con el valor de CRON_SECRET, el
 * mismo secreto compartido que ya usan las llamadas en sentido contrario
 * (lib/erp-release-stock.ts). Fail-closed: sin CRON_SECRET configurado, 401.
 *
 * Body: `{ organization_id: number }`, o `{ all: true }` para invalidar el
 * catálogo de todas las organizaciones (uso manual, p. ej. tras un despliegue
 * que cambie la forma de los datos).
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const received = request.headers.get('x-webhook-secret')
  if (!expected || received !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { organization_id?: unknown; all?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (body.all === true) {
    revalidateTag(CATALOG_TAG_ALL)
    return NextResponse.json({ ok: true, tag: CATALOG_TAG_ALL })
  }

  const organizationId = Number(body.organization_id)
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return NextResponse.json({ error: 'organization_id inválido' }, { status: 400 })
  }

  const tag = catalogTag(organizationId)
  revalidateTag(tag)
  return NextResponse.json({ ok: true, tag })
}
