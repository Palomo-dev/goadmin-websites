import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { ubicacionDesdeCabeceras } from '@/lib/geo/ubicacionVisita'
import type { Database } from '@/types/database'

/** Fila a insertar, contra las columnas DECLARADAS (compila solo si existen). */
type FilaVisita = Database['public']['Tables']['website_visits']['Insert']
/**
 * El cliente de `createPublicClient` no está parametrizado con `Database`
 * (su `insert` se infiere como `never[]`): se tipa solo esta llamada.
 */
type TablaVisitas = { insert(fila: FilaVisita): PromiseLike<{ error: unknown }> }

/**
 * Registra una visita (page view) en la tabla website_visits.
 * Recibe: sessionId, pagePath, referrer (y `organizationId`, que solo se contrasta).
 *
 * - La organización sale del HOST (`getOrgIdDelHost`, las mismas cabeceras que
 *   `getOrgContext`), nunca del body. Si el body trae otra: 403 y se registra.
 *   Sin organización resoluble para el host: 400 y no se guarda nada.
 * - Ubicación aproximada (país, región, ciudad) desde las cabeceras de Vercel
 *   (`lib/geo/ubicacionVisita.ts`). Nunca la IP en claro ni coordenadas: de la
 *   IP solo se guarda un hash truncado, como antes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, pagePath, referrer } = body

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const organizationId = await getOrgIdDelHost()
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization not resolved' }, { status: 400 })
    }
    if (body.organizationId != null && Number(body.organizationId) !== organizationId) {
      console.warn('[track-visit] organización del body distinta a la del host', {
        host: organizationId,
        body: String(body.organizationId).slice(0, 20),
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = createPublicClient()

    // Detectar tipo de dispositivo desde User-Agent
    const userAgent = request.headers.get('user-agent') || ''
    const deviceType = /Mobile|Android|iPhone/i.test(userAgent)
      ? 'mobile'
      : /iPad|Tablet/i.test(userAgent)
        ? 'tablet'
        : 'desktop'

    // Hash del IP para privacidad (no guardamos el IP real, solo un hash SHA-256 truncado)
    // Esto permite identificar visitantes únicos sin almacenar PII.
    const forwarded = request.headers.get('x-forwarded-for')
    const ipHash = forwarded
      ? Array.from(
          new Uint8Array(
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode(forwarded.split(',')[0].trim())),
          ),
        ).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
      : null

    // País, región y ciudad aproximados (nunca IP ni coordenadas).
    const ubicacion = ubicacionDesdeCabeceras(request.headers)

    // Verificar si es visitante nuevo (session_id no existe en las últimas 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existingSession } = await supabase
      .from('website_visits')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('session_id', sessionId)
      .gt('created_at', yesterday)
      .limit(1)

    const isNewVisitor = !existingSession || existingSession.length === 0

    const fila: FilaVisita = {
      organization_id: organizationId,
      session_id: String(sessionId).slice(0, 100),
      page_path: pagePath || '/',
      referrer: referrer || null,
      user_agent: userAgent.substring(0, 500),
      device_type: deviceType,
      is_new_visitor: isNewVisitor,
      country: ubicacion.country,
      region: ubicacion.region,
      city: ubicacion.city,
      ip_hash: ipHash,
    }
    const { error } = await (supabase.from('website_visits') as unknown as TablaVisitas).insert(fila)

    if (error) {
      console.error('Error tracking visit:', error)
      return NextResponse.json({ error: 'Failed to track visit' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Track visit error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
