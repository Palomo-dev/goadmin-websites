import { NextRequest, NextResponse } from 'next/server'
import { contextoFavoritos, fichasDeProductos, sugerenciasFavoritos } from '@/lib/favoritos/servidor'
import { idsDeConsulta } from '@/lib/favoritos/logica'
import { FUENTES_SUGERENCIAS_FAVORITOS, type FuenteSugerenciasFavoritos } from '@/lib/website/v2/cabeceraTienda'

export const dynamic = 'force-dynamic'

/**
 * GET /api/favorites/productos?ids=1,2,3[&sede=5][&sugerencias=categorias]
 *
 * Fichas de los productos de la lista (precio vigente, foto, stock, variantes, categoría) para el
 * panel y la página /favoritos, y opcionalmente «También te puede gustar». Es catálogo público:
 * la organización sale del host y solo se devuelven productos activos de ella (la consulta de
 * siempre, `getProductsByIds`). `sede` solo restringe a las categorías de esa sede de la misma
 * organización; una sede ajena no devuelve nada.
 */
export async function GET(request: NextRequest) {
  const ctx = await contextoFavoritos()
  if (!ctx) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
  const { searchParams } = new URL(request.url)
  const ids = idsDeConsulta(searchParams.get('ids'))
  const sedeCruda = Number(searchParams.get('sede'))
  const sede = Number.isInteger(sedeCruda) && sedeCruda > 0 ? sedeCruda : null
  const fuente = searchParams.get('sugerencias')
  try {
    const fichas = await fichasDeProductos(ctx.organizationId, ids, sede)
    const sugerencias =
      fuente && (FUENTES_SUGERENCIAS_FAVORITOS as readonly string[]).includes(fuente)
        ? await sugerenciasFavoritos(ctx.organizationId, sede, fichas, fuente as FuenteSugerenciasFavoritos)
        : []
    return NextResponse.json({ fichas, sugerencias })
  } catch (error) {
    console.error('[favoritos] productos', { organizationId: ctx.organizationId, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ fichas: [], sugerencias: [] }, { status: 500 })
  }
}
