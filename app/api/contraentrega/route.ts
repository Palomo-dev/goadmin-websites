import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getAuthCustomer } from '@/lib/get-auth-customer'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { cotizarDomicilioWeb } from '@/lib/shipping/cotizarZonas'
import { usaZonas } from '@/lib/shipping/domicilioZonas'
import { evaluarContraentregaServidor, leerCondicionesContraentrega } from '@/lib/contraentrega/contraentregaServidor'
import { productoAplica, type TipoEntregaPedido } from '@/lib/contraentrega/reglaContraentrega'
import { nombrePasarela } from '@/lib/contraentrega/textosContraentrega'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'no-store' }
const COMO_HOY = { conCondiciones: false }

/**
 * POST /api/contraentrega — «Pago contra entrega» en el checkout (Figma 3019:76125 › 08–10c).
 *
 * Body: { branchId?, tipoEntrega: 'delivery_own'|'delivery_third_party'|'pickup'|'dine_in',
 *         items: [{ productId, cantidad }], subtotalProductos, envio, total,
 *         direccion?: { ciudad, pais, departamento, barrio, codigoPostal } }
 * Respuesta: { conCondiciones: false } (la tienda o la sede no tienen condiciones: como hoy) o
 *   { conCondiciones: true, disponible, motivos, anticipo, alRecibir, medios, texto, pasarelas,
 *     excluidos: [{ productId, nombre }] }.
 *
 * Informativo: lo que muestra el checkout. /api/orders vuelve a evaluar con SUS montos y decide
 * el anticipo; el navegador nunca fija el monto. Organización del host, sede validada contra ella,
 * cliente de la sesión (el historial nunca sale de un correo escrito) y límite por IP.
 */
export async function POST(request: NextRequest) {
  try {
    if (!checkRateLimit(`contraentrega:ip:${getClientIP(request)}`, 120, 10 * 60 * 1000).allowed) {
      return NextResponse.json(COMO_HOY, { status: 429, headers: SIN_CACHE })
    }
    const orgId = await getOrgIdDelHost()
    const supabase = createAdminClient() as any
    if (orgId === null || !supabase) return NextResponse.json(COMO_HOY, { headers: SIN_CACHE })

    const body = await request.json().catch(() => ({}))
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

    const condiciones = await leerCondicionesContraentrega(supabase, orgId, branchId)
    if (!condiciones) return NextResponse.json(COMO_HOY, { headers: SIN_CACHE })

    const tipos: TipoEntregaPedido[] = ['delivery_own', 'delivery_third_party', 'pickup', 'dine_in']
    const tipoEntrega: TipoEntregaPedido = tipos.includes(body?.tipoEntrega) ? body.tipoEntrega : 'pickup'
    const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0)
    const items = (Array.isArray(body?.items) ? body.items : [])
      .slice(0, 200)
      .map((i: any) => ({ productId: Number(i?.productId), cantidad: Number(i?.cantidad) || 1 }))
      .filter((i: { productId: number }) => Number.isInteger(i.productId) && i.productId > 0)

    // La zona solo importa si las condiciones la piden y es domicilio propio: misma cotización que
    // /api/shipping/quote y /api/orders.
    let zonaId: string | null = null
    if (tipoEntrega === 'delivery_own' && condiciones.zonas.modo === 'algunas') {
      const d = body?.direccion ?? {}
      const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
      const cotizacion = await cotizarDomicilioWeb(supabase, {
        organizationId: orgId,
        branchId,
        subtotal: num(body?.subtotalProductos),
        metodoPago: 'cash',
        items: items.map((i: { productId: number; cantidad: number }) => ({ product_id: i.productId, cantidad: i.cantidad })),
        direccion: {
          ciudad: texto(d.ciudad),
          pais: texto(d.pais, 3),
          departamento: texto(d.departamento, 10),
          barrio: texto(d.barrio),
          codigoPostal: texto(d.codigoPostal, 12),
        },
      })
      zonaId = usaZonas(cotizacion) && cotizacion?.zona?.id ? String(cotizacion.zona.id) : null
    } else {
      // Sin restricción de zonas o no es domicilio propio: no se cotiza.
    }

    const cliente = await getAuthCustomer(orgId).catch(() => null)
    const { resultado, lineas } = await evaluarContraentregaServidor(supabase, {
      organizationId: orgId,
      branchId,
      tipoEntrega,
      subtotalProductos: num(body?.subtotalProductos),
      envio: num(body?.envio),
      total: num(body?.total),
      zonaId,
      items: items.map((i: { productId: number }) => ({ productId: i.productId })),
      customerId: cliente?.id ?? null,
      condicionesLeidas: condiciones,
    })
    const excluidos = lineas
      .filter((l) => !productoAplica(condiciones, l))
      .map((l) => ({ productId: l.productoId, nombre: l.nombre ?? null }))
    return NextResponse.json(
      {
        conCondiciones: resultado.conCondiciones,
        disponible: resultado.disponible,
        motivos: resultado.motivos,
        anticipo: resultado.anticipo,
        alRecibir: resultado.alRecibir,
        medios: resultado.medios,
        texto: resultado.texto,
        pasarelas: (resultado.anticipo?.pasarelas ?? []).map((codigo) => ({ codigo, nombre: nombrePasarela(codigo) })),
        excluidos,
      },
      { headers: SIN_CACHE },
    )
  } catch (error) {
    console.error('[Contraentrega] Error evaluando', error)
    return NextResponse.json(COMO_HOY, { status: 500, headers: SIN_CACHE })
  }
}
