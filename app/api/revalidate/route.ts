import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { catalogTag, CATALOG_TAG_ALL } from '@/lib/supabase/cache'
import { tagEstadosV2Org, tagSitioV2 } from '@/lib/website/v2/lectorPublico'

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
 *
 * Con `sitio: true` también invalida el documento publicado del sitio V2
 * (`sitio-v2-org-<org>` y, si viene, `sitio-v2-<site_state_id>`). Un cambio
 * de catálogo no lo pide: no hace falta regenerar el diseño.
 */
const UUID_SITIO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  const received = request.headers.get('x-webhook-secret')
  if (!expected || received !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { organization_id?: unknown; all?: unknown; sitio?: unknown; site_state_id?: unknown } = {}
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
  const etiquetas = [tag]
  if (body.sitio === true) {
    const estados = tagEstadosV2Org(organizationId)
    revalidateTag(estados)
    etiquetas.push(estados)
    if (typeof body.site_state_id === 'string' && UUID_SITIO.test(body.site_state_id)) {
      const sitio = tagSitioV2(body.site_state_id)
      revalidateTag(sitio)
      etiquetas.push(sitio)
    }
  }
  return NextResponse.json({ ok: true, tag, sitio: body.sitio === true, etiquetas })
}
