import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient } from '@/lib/supabase/server'

/**
 * Registra una visita (page view) en la tabla website_visits.
 * Recibe: organizationId, sessionId, pagePath, referrer, userAgent.
 * Es un endpoint público (sin auth) — el RLS permite INSERT a cualquiera.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, sessionId, pagePath, referrer } = body

    if (!organizationId || !sessionId) {
      return NextResponse.json(
        { error: 'organizationId and sessionId are required' },
        { status: 400 },
      )
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

    // Verificar si es visitante nuevo (session_id no existe en las últimas 24h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existingSession } = await supabase
      .from('website_visits')
      .select('id')
      .eq('session_id', sessionId)
      .gt('created_at', yesterday)
      .limit(1)

    const isNewVisitor = !existingSession || existingSession.length === 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('website_visits')
      .insert({
        organization_id: Number(organizationId),
        session_id: sessionId,
        page_path: pagePath || '/',
        referrer: referrer || null,
        user_agent: userAgent.substring(0, 500),
        device_type: deviceType,
        is_new_visitor: isNewVisitor,
        country: null,
        ip_hash: ipHash,
      })

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
