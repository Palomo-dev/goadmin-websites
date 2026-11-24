import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit } from '@/lib/rateLimit'
import { cifrasCuenta, getCuentaCliente, pedidoEnCursoAvatar } from '@/lib/cuenta/cuentaCliente'
import { facturaCompleta, identidadCuenta, vendeConPedidos } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

const SIN_CACHE = { 'Cache-Control': 'private, no-store' }

/**
 * GET /api/cuenta/menu — datos del avatar de la cabecera y de su menú (Figma «16 Sitio web»
 * 3044:78726, pantallas 4–6).
 *
 * - `?parte=avatar` (liviana): nombre de la ficha `customers` de la organización (no solo de la
 *   sesión), iniciales y el pedido en curso (punto verde). La pide el navegador SOLO si hay sesión,
 *   una vez y la guarda unos minutos en `sessionStorage` (components/site/cuenta/avatar/datosAvatar.ts):
 *   los visitantes anónimos nunca la llaman.
 * - `?parte=menu`: además las cifras (pedidos, favoritos, direcciones, cupones, facturas) y si
 *   faltan los datos de factura. Se pide al abrir el menú.
 *
 * Organización del HOST (nunca del body ni de la query); usuario de la cookie de sesión. Las
 * consultas son de service role y cada una filtra por la organización (lib/cuenta/cuentaCliente.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ sesion: false }, { status: 404, headers: SIN_CACHE })

    const cuenta = await getCuentaCliente(orgId)
    if (!cuenta) return NextResponse.json({ sesion: false }, { headers: SIN_CACHE })
    if (!checkRateLimit(`cuenta-menu:${orgId}:${cuenta.userId}`, 60, 5 * 60 * 1000).allowed) {
      return NextResponse.json({ error: 'Espera un momento.' }, { status: 429, headers: SIN_CACHE })
    }

    const sb = createAdminClient() as any
    const { data: org } = sb ? await sb.from('organizations').select('type_id').eq('id', orgId).maybeSingle() : { data: null }
    const tipo = typeof org?.type_id === 'number' ? org.type_id : 0
    const conPedidos = vendeConPedidos(tipo)
    const parte = request.nextUrl.searchParams.get('parte') === 'menu' ? 'menu' : 'avatar'
    const ficha = cuenta.cliente

    const [enCurso, cifras] = await Promise.all([
      conPedidos ? pedidoEnCursoAvatar(orgId, cuenta, tipo === 1) : Promise.resolve(null),
      parte === 'menu' ? cifrasCuenta(orgId, cuenta, conPedidos) : Promise.resolve(null),
    ])

    return NextResponse.json(
      {
        sesion: true,
        usuario: cuenta.userId,
        tipo,
        identidad: identidadCuenta(ficha, cuenta.correo),
        enCurso,
        ...(parte === 'menu'
          ? { cifras, facturaCompleta: facturaCompleta(ficha), telefono: ficha?.phone ?? null }
          : {}),
      },
      { headers: SIN_CACHE },
    )
  } catch (error) {
    console.error('[cuenta/menu] Error', error)
    return NextResponse.json({ error: 'No pudimos leer tu cuenta.' }, { status: 500, headers: SIN_CACHE })
  }
}
