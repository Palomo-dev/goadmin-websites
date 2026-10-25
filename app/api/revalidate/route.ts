import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { catalogTag, CATALOG_TAG_ALL, estructuraSitioTag } from '@/lib/supabase/cache'
import { getSitioPublicoV2, tagEstadosV2Org, tagSitioV2 } from '@/lib/website/v2/lectorPublico'

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

  let body: { organization_id?: unknown; all?: unknown; publicacion?: unknown; estructura?: unknown } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Se esperaba un objeto JSON' }, { status: 400 })
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
  if (body.estructura === true) {
    revalidateTag(estructuraSitioTag(organizationId))
    revalidateTag(tag)
    return NextResponse.json({ ok: true, estructura: true, organizationId })
  }
  if (body.publicacion !== undefined) {
    const p = body.publicacion as { sitioId?: unknown; revisionId?: unknown; branchId?: unknown } | null
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!p || typeof p.sitioId !== 'string' || !uuid.test(p.sitioId) || typeof p.revisionId !== 'string' || !uuid.test(p.revisionId)
      || (p.branchId !== null && (typeof p.branchId !== 'number' || !Number.isInteger(p.branchId) || p.branchId <= 0))) {
      return NextResponse.json({ error: 'Publicación inválida' }, { status: 400 })
    }
    // Invalida el puntero a la revisión, no solo el catálogo. El cron sigue como respaldo.
    revalidateTag(tagEstadosV2Org(organizationId))
    revalidateTag(tagSitioV2(p.sitioId))
    revalidateTag(estructuraSitioTag(organizationId))
    revalidateTag(tag)
    const sitio = await getSitioPublicoV2(organizationId, p.branchId as number | null)
    if (!sitio || sitio.siteStateId !== p.sitioId || sitio.revisionId !== p.revisionId) {
      return NextResponse.json({ error: 'La revisión aún no está disponible en el lector público' }, { status: 503 })
    }
    return NextResponse.json({ ok: true, sitioId: sitio.siteStateId, revisionId: sitio.revisionId })
  }
  revalidateTag(tag)
  return NextResponse.json({ ok: true, tag })
}
