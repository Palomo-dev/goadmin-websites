/**
 * Lee el impuesto de cada producto de la organización y lo resuelve con
 * `resolverTarifas`. Si la lectura falla, devuelve null: el pedido sigue con
 * la tarifa predeterminada, que es lo que cobraba antes.
 */

import { resolverTarifas, type FilaImpuesto, type TarifaResuelta } from './impuestoProducto'

interface ClienteTabla {
  from: (tabla: string) => {
    select: (cols: string) => any
  }
}

export interface TarifasLeidas {
  porProducto: Map<number, TarifaResuelta>
  predeterminado: TarifaResuelta
}

function idsEnteros(ids: number[]): number[] {
  return [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
}

function filaImpuesto(row: {
  id: string
  name?: string | null
  rate?: number | string | null
  tax_included?: boolean | null
  is_default?: boolean | null
  is_active?: boolean | null
  kind?: string | null
}): FilaImpuesto {
  return {
    id: String(row.id),
    name: String(row.name ?? 'IVA'),
    rate: Number(row.rate) || 0,
    taxIncluded: row.tax_included === true,
    isDefault: row.is_default === true,
    isActive: row.is_active !== false,
    kind: row.kind ?? 'tax',
  }
}

export async function leerTarifasProductos(
  supabase: ClienteTabla,
  organizationId: number,
  productIds: number[],
): Promise<TarifasLeidas | null> {
  const ids = idsEnteros(productIds)
  const { data: impuestos, error: errorImpuestos } = await supabase
    .from('organization_taxes')
    .select('id, name, rate, tax_included, is_default, is_active, kind')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
  if (errorImpuestos || !impuestos) {
    console.warn('[Impuestos] No se pudieron leer los impuestos de la organización', { organizationId })
    return null
  }

  let productos: { id: number; parent_product_id: number | null }[] = []
  let relaciones: { product_id: number; tax_id: string }[] = []
  if (ids.length > 0) {
    const { data: filas, error: errorProductos } = await supabase
      .from('products')
      .select('id, parent_product_id')
      .eq('organization_id', organizationId)
      .in('id', ids)
    if (errorProductos || !filas) {
      console.warn('[Impuestos] No se pudieron leer los productos del pedido', { organizationId })
      return null
    }
    productos = filas
    const padres = [...new Set(
      productos
        .map((p) => p.parent_product_id)
        .filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0 && !ids.includes(id)),
    )]
    let padresValidos: number[] = []
    if (padres.length > 0) {
      const { data: filasPadre, error: errorPadres } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', padres)
      if (errorPadres) {
        console.warn('[Impuestos] No se pudo leer el producto padre', { organizationId })
        return null
      }
      padresValidos = (filasPadre ?? []).map((p: { id: number }) => p.id)
    }
    const paraRelacion = [...ids.filter((id) => productos.some((p) => p.id === id)), ...padresValidos]
    if (paraRelacion.length > 0) {
      const { data: filasRel, error: errorRel } = await supabase
        .from('product_tax_relations')
        .select('product_id, tax_id')
        .in('product_id', paraRelacion)
      if (errorRel) {
        console.warn('[Impuestos] No se pudieron leer las relaciones de impuesto', { organizationId })
        return null
      }
      relaciones = filasRel ?? []
    }
  }

  const propios = new Set(productos.map((p) => p.id))
  const padreDe = new Map(productos.map((p) => [p.id, p.parent_product_id]))
  const resuelto = resolverTarifas({
    productos: ids.filter((id) => propios.has(id)).map((id) => ({
      id,
      parentId: padreDe.get(id) ?? null,
    })),
    relaciones: relaciones.map((r) => ({ productId: r.product_id, taxId: r.tax_id })),
    impuestos: (impuestos as FilaImpuesto[]).map((row) => filaImpuesto(row as never)),
  })
  return {
    porProducto: new Map(resuelto.porProducto.map((p) => [p.productId, p.tarifa])),
    predeterminado: resuelto.predeterminado,
  }
}
