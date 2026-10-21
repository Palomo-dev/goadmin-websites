import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { cronAutorizado } from '@/lib/orders/cronAutorizado'
import { tagEstadosV2Org, tagSitioV2 } from '@/lib/website/v2/lectorPublico'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Procesa `website_publication_outbox` (sitios V2): cada publicación o cambio de adopción del ERP
 * encola una fila; aquí se invalida la caché del sitio y se marca la fila.
 *
 *   pending|error (attempts < MAX_INTENTOS) → revalidateTag → done | error (+attempts, last_error)
 *
 * Etiquetas que invalida por fila: `sitio-v2-<site_state_id>` (revisiones del sitio) y
 * `sitio-v2-org-<organization_id>` (estados: adopción y revisión publicada). Sin este proceso
 * el sitio igual ve la publicación a los 60 s (TTL de los estados); esto la adelanta.
 *
 * Autenticación (falla cerrado): `CRON_SECRET` del despliegue, por
 * `x-webhook-secret` o `Authorization: Bearer`, o el secreto del vault
 * con el que llama la base. Sin ninguno de los dos, 401.
 *
 * Columnas verificadas por MCP el 2026-10-05: id (bigint), organization_id, site_state_id,
 * revision_id, status ('pending'|'done'|'error'), attempts, last_error, created_at,
 * processed_at. La tabla no admite anon ni authenticated: solo service role.
 *
 * El correo de compra pendiente no corre aquí. Lo dispara pg_cron contra
 * `/api/cron/carritos-abandonados` en el proyecto que puede enviarlo.
 */
const MAX_INTENTOS = 5
const LOTE = 50

interface FilaOutbox {
  id: number
  organization_id: number
  site_state_id: string
  status: 'pending' | 'done' | 'error'
  attempts: number
}

async function procesar(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await cronAutorizado(request, supabase))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (!supabase) {
    console.error('[outbox-sitios-v2] Sin SUPABASE_SERVICE_ROLE_KEY')
    return NextResponse.json({ error: 'Servicio no configurado' }, { status: 500 })
  }

  const { data, error } = await (supabase as any)
    .from('website_publication_outbox')
    .select('id, organization_id, site_state_id, status, attempts')
    .in('status', ['pending', 'error'])
    .lt('attempts', MAX_INTENTOS)
    .order('created_at', { ascending: true })
    .limit(LOTE)
  if (error) {
    console.error('[outbox-sitios-v2] No se pudo leer el outbox:', error.message || error)
    return NextResponse.json({ error: 'No se pudo leer el outbox' }, { status: 500 })
  }

  const resultado = { procesadas: 0, hechas: 0, errores: 0, omitidas: 0 }
  for (const fila of (data || []) as FilaOutbox[]) {
    resultado.procesadas += 1
    // Reclamar la fila: solo gana quien la ve con el mismo estado e intentos (dos ejecuciones
    // simultáneas no la procesan dos veces).
    const { data: reclamada, error: errorReclamo } = await (supabase as any)
      .from('website_publication_outbox')
      .update({ attempts: fila.attempts + 1 })
      .eq('id', fila.id)
      .eq('status', fila.status)
      .eq('attempts', fila.attempts)
      .select('id')
    if (errorReclamo || !reclamada || reclamada.length === 0) {
      resultado.omitidas += 1
      continue
    }

    try {
      revalidateTag(tagSitioV2(fila.site_state_id))
      revalidateTag(tagEstadosV2Org(fila.organization_id))
      const { error: errorFin } = await (supabase as any)
        .from('website_publication_outbox')
        .update({ status: 'done', processed_at: new Date().toISOString(), last_error: null })
        .eq('id', fila.id)
      if (errorFin) throw new Error(`marcar done: ${errorFin.message || errorFin.code}`)
      resultado.hechas += 1
    } catch (e) {
      const mensaje = (e instanceof Error ? e.message : String(e)).slice(0, 500)
      console.error('[outbox-sitios-v2] Error procesando la fila', { id: fila.id, error: mensaje })
      const { error: errorMarca } = await (supabase as any)
        .from('website_publication_outbox')
        .update({ status: 'error', last_error: mensaje })
        .eq('id', fila.id)
      if (errorMarca) console.error('[outbox-sitios-v2] No se pudo marcar el error', { id: fila.id, error: errorMarca.message })
      resultado.errores += 1
    }
  }

  return NextResponse.json({ ok: true, ...resultado })
}

export async function POST(request: NextRequest) {
  return procesar(request)
}

/** Vercel Cron invoca con GET. */
export async function GET(request: NextRequest) {
  return procesar(request)
}
