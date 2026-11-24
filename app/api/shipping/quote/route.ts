import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { cotizarDomicilioWeb } from '@/lib/shipping/cotizarZonas'
import { cotizacionPublica, usaZonas } from '@/lib/shipping/domicilioZonas'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }

/**
 * POST /api/shipping/quote — «Domicilio» por zona en el checkout (logística Fase 1).
 *
 * Body: { branchId?, subtotal, subtotalEnvioGratis?, direccion: { ciudad, pais, departamento, barrio,
 *         codigoPostal }, items?: [{ product_id, cantidad }] }
 * Respuesta: { usaZonas, cotizacion } — `usaZonas: false` si la tienda no tiene zonas: el checkout
 * sigue con la tarifa plana o las tarifas de Transporte, como siempre.
 *
 * - Organización del HOST, nunca del body; la sede se valida contra esa organización.
 * - Lo que muestra es informativo: /api/orders vuelve a cotizar y cobra lo suyo.
 * - Solo sale `cotizacionPublica` (precio, zona por su nombre, promesa, envío gratis, mínimo y
 *   motivo): ni ids de zona o regla, ni cómo coincidió la dirección, corte ni días de reparto.
 * - Límite por IP (se llama mientras la persona escribe la dirección): lib/rateLimit.ts, en
 *   memoria por instancia (no hay Upstash ni KV en este repositorio).
 */
export async function POST(request: NextRequest) {
  try {
    const limite = checkRateLimit(`shipping-quote:ip:${getClientIP(request)}`, 120, 10 * 60 * 1000)
    if (!limite.allowed) return NextResponse.json({ usaZonas: false, cotizacion: null }, { status: 429, headers: SIN_CACHE })

    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ usaZonas: false, cotizacion: null }, { headers: SIN_CACHE })
    const supabase = createAdminClient() as any
    if (!supabase) return NextResponse.json({ usaZonas: false, cotizacion: null }, { headers: SIN_CACHE })

    const body = await request.json().catch(() => ({}))
    const d = body?.direccion ?? {}
    const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

    let branchId: number | null = Number.isInteger(body?.branchId) ? Number(body.branchId) : null
    if (branchId !== null) {
      const { data } = await supabase.from('branches').select('id').eq('id', branchId).eq('organization_id', orgId).maybeSingle()
      if (!data) branchId = null
    }
    if (branchId === null) {
      const { data: sedes } = await supabase
        .from('branches')
        .select('id, is_main, is_web_stock_source')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('id', { ascending: true })
      branchId = sedeDePedidoWeb<{ id: number; is_main: boolean | null; is_web_stock_source: boolean | null }>(sedes)
    }

    const cotizacion = await cotizarDomicilioWeb(supabase, {
      organizationId: orgId,
      branchId,
      subtotal: Number(body?.subtotal) || 0,
      // Envío gratis después de promociones y cupón (lib/shipping/envioGratisDescontado.ts). Sin el
      // campo (checkout viejo en caché): como antes. Informativo: /api/orders lo calcula él mismo.
      subtotalEnvioGratis: typeof body?.subtotalEnvioGratis === 'number' && Number.isFinite(body.subtotalEnvioGratis) ? body.subtotalEnvioGratis : null,
      metodoPago: texto(body?.metodoPago, 40),
      // Solo ids y cantidades del carrito: la base suma el peso (reglas de despacho por peso).
      items: Array.isArray(body?.items) ? body.items : [],
      direccion: {
        ciudad: texto(d.ciudad),
        pais: texto(d.pais, 3),
        departamento: texto(d.departamento, 10),
        barrio: texto(d.barrio),
        codigoPostal: texto(d.codigoPostal, 12),
      },
    })
    const conZonas = usaZonas(cotizacion)
    return NextResponse.json({ usaZonas: conZonas, cotizacion: conZonas ? cotizacionPublica(cotizacion) : null }, { headers: SIN_CACHE })
  } catch (error) {
    console.error('[Shipping] Quote error:', error)
    return NextResponse.json({ usaZonas: false, cotizacion: null }, { status: 500, headers: SIN_CACHE })
  }
}
