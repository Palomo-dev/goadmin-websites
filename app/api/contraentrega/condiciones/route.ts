import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'
import { sedeDePedidoWeb } from '@/lib/orders/pedidoWeb'
import { metodoPermitidoEnSede } from '@/lib/payments/metodosPorSucursal'
import { lineasConCategoria } from '@/lib/contraentrega/contraentregaServidor'
import { condicionesDeSede, productoAplica } from '@/lib/contraentrega/reglaContraentrega'
import type { CondicionesPublicasContraentrega, RespuestaCondicionesContraentrega } from '@/lib/contraentrega/textosContraentrega'

export const dynamic = 'force-dynamic'

/**
 * Público y poco cambiante (lo cambia el ERP en «Condiciones»): el navegador lo guarda un minuto y
 * el CDN cinco, por host + URL. Una consulta por carrito o ficha, nunca por tarjeta (incidente de la
 * home del 2026-09-14 en CLAUDE.md).
 */
const CACHE_PUBLICA = { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' }
const SIN_CACHE = { 'Cache-Control': 'no-store' }
const COMO_HOY: RespuestaCondicionesContraentrega = { conCondiciones: false }
const MAX_PRODUCTOS = 100

/**
 * GET /api/contraentrega/condiciones?branchId=<sede>&productos=<id,id,…>
 *
 * Lectura liviana para los avisos del carrito lateral y de la ficha (Figma 3019:76125 › 14–15b).
 * `organization_payment_methods` no admite lectura anónima: por eso pasa por aquí.
 *
 * Respuesta: `{ conCondiciones: false }` (la sede no tiene condiciones, la tienda no ofrece
 * efectivo en esa sede o la contraentrega está apagada: no se pinta nada) o
 * `CondicionesPublicasContraentrega` (mínimo, máximo, productos, anticipo, medios, nombres de las
 * zonas). Con `productos=` y condiciones por producto, además `excluidos: [{ productId, nombre }]`.
 *
 * Organización SIEMPRE del host, sede validada contra ella (sin sede o ajena: la del pedido web
 * por defecto, como el checkout) y límite por IP. Nada del cliente ni de la sesión.
 */
export async function GET(request: NextRequest) {
  try {
    if (!checkRateLimit(`contraentrega-condiciones:ip:${getClientIP(request)}`, 300, 10 * 60 * 1000).allowed) {
      return NextResponse.json(COMO_HOY, { status: 429, headers: SIN_CACHE })
    }
    const orgId = await getOrgIdDelHost()
    const supabase = createAdminClient() as any
    if (orgId === null || !supabase) return NextResponse.json(COMO_HOY, { headers: SIN_CACHE })

    const params = request.nextUrl.searchParams
    const pedida = Number(params.get('branchId'))
    let branchId: number | null = Number.isInteger(pedida) && pedida > 0 ? pedida : null
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

    // Una sola lectura: la fila `cash`. Si el efectivo no se ofrece en el sitio o en esa sede, el
    // checkout no lo muestra y el aviso tampoco.
    const { data: fila, error } = await supabase
      .from('organization_payment_methods')
      .select('settings, is_active, show_on_website, branch_ids')
      .eq('organization_id', orgId)
      .eq('payment_method_code', 'cash')
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[Contraentrega] No se pudieron leer las condiciones para el aviso', { orgId, code: error.code })
      return NextResponse.json(COMO_HOY, { headers: SIN_CACHE })
    }
    const ofreceEfectivo = !!fila && fila.is_active === true && fila.show_on_website === true && metodoPermitidoEnSede(fila.branch_ids, branchId)
    const condiciones = ofreceEfectivo ? condicionesDeSede(fila.settings, branchId) : null
    if (!condiciones || !condiciones.ofrecer) return NextResponse.json(COMO_HOY, { headers: CACHE_PUBLICA })

    const idsZonas = condiciones.zonas.modo === 'algunas' ? condiciones.zonas.ids : []
    const idsProductos = condiciones.productos.modo === 'todos'
      ? []
      : Array.from(new Set((params.get('productos') || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, MAX_PRODUCTOS)

    const [zonas, lineas] = await Promise.all([
      idsZonas.length > 0
        ? supabase
            .from('shipping_zones')
            .select('id, name')
            .eq('organization_id', orgId)
            .eq('is_active', true)
            .in('id', idsZonas)
            .then((r: any) => (Array.isArray(r.data) ? r.data.map((z: any) => String(z.name)) : []) as string[])
        : Promise.resolve([] as string[]),
      idsProductos.length > 0
        ? lineasConCategoria(supabase, orgId, idsProductos.map((productId) => ({ productId })))
        : Promise.resolve([]),
    ])

    const respuesta: CondicionesPublicasContraentrega = {
      conCondiciones: true,
      montoMinimo: condiciones.montoMinimo,
      montoMaximo: condiciones.montoMaximo,
      transportadora: condiciones.transportadora,
      productos: condiciones.productos,
      medios: condiciones.medios,
      anticipo: {
        tipo: condiciones.anticipo.tipo,
        porcentaje: condiciones.anticipo.porcentaje,
        valorFijo: condiciones.anticipo.valorFijo,
        siEnvioGratis: condiciones.anticipo.siEnvioGratis,
        valorEnvioGratis: condiciones.anticipo.valorEnvioGratis,
      },
      zonas: condiciones.zonas.modo === 'algunas' ? zonas : null,
      texto: condiciones.texto,
    }
    if (params.has('productos')) {
      respuesta.excluidos = lineas
        .filter((l) => !productoAplica(condiciones, l))
        .map((l) => ({ productId: l.productoId, nombre: l.nombre ?? null }))
    } else {
      // La ficha no manda productos: decide con `productoAplica` y los datos del producto que ya tiene.
    }
    return NextResponse.json(respuesta, { headers: CACHE_PUBLICA })
  } catch (error) {
    console.error('[Contraentrega] Error leyendo las condiciones para el aviso', error)
    return NextResponse.json(COMO_HOY, { status: 500, headers: SIN_CACHE })
  }
}
