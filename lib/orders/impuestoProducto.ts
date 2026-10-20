/**
 * Impuesto de cada producto de un pedido web.
 *
 * El impuesto del producto no es `products.tax_id` (entero, legado, sin filas): es
 * `product_tax_relations.tax_id`, el uuid de `organization_taxes`. La misma prioridad
 * que el resolver del ERP (`taxResolverCore`):
 *   1. relaciones activas de venta del producto (aunque la tasa sea 0: exento a propósito);
 *   2. si no tiene, las de su producto padre;
 *   3. si tampoco, la tarifa predeterminada de la organización;
 *   4. si no hay, 0.
 * Las retenciones (`kind = 'withholding'`) no se suman al precio.
 *
 * Puro: lo usan el servidor y la compuerta `verify:orders`. La lectura de la base está
 * en `leerTarifasProducto.ts`.
 */

import { calcularImpuestoPedido } from './impuestoPedido'

export interface FilaImpuesto {
  id: string
  name: string
  rate: number
  taxIncluded: boolean
  isDefault: boolean
  isActive: boolean
  /** `tax` o `withholding`. Ausente se trata como impuesto de venta. */
  kind?: string | null
}

export interface RelacionImpuesto {
  productId: number
  taxId: string
}

export interface ProductoConPadre {
  id: number
  parentId: number | null
}

export interface ComponenteTarifa {
  tasa: number
  incluido: boolean
  nombre: string
}

export interface TarifaResuelta {
  tasa: number
  incluido: boolean
  nombre: string
  componentes: ComponenteTarifa[]
  /** Salió de una relación del producto o de su padre. */
  delProducto: boolean
}

const redondear2 = (n: number): number => Math.round(n * 100) / 100

function esVenta(imp: FilaImpuesto): boolean {
  return imp.isActive !== false && imp.kind !== 'withholding'
}

function tarifaDeFilas(filas: FilaImpuesto[], delProducto: boolean): TarifaResuelta {
  const componentes = filas.map((f) => ({
    tasa: Number(f.rate) || 0,
    incluido: f.taxIncluded === true,
    nombre: f.name.trim() || 'IVA',
  }))
  const nombres = [...new Set(componentes.map((c) => c.nombre))]
  return {
    tasa: redondear2(componentes.reduce((s, c) => s + c.tasa, 0)),
    incluido: componentes.length > 0 && componentes.every((c) => c.incluido),
    nombre: nombres.length === 1 ? nombres[0] : 'Impuestos',
    componentes,
    delProducto,
  }
}

const SIN_IMPUESTO: TarifaResuelta = {
  tasa: 0,
  incluido: false,
  nombre: 'IVA',
  componentes: [{ tasa: 0, incluido: false, nombre: 'IVA' }],
  delProducto: false,
}

export function tarifaPredeterminada(impuestos: FilaImpuesto[]): TarifaResuelta {
  const def = impuestos.find((i) => esVenta(i) && i.isDefault)
  if (!def) return SIN_IMPUESTO
  return tarifaDeFilas([def], false)
}

function filasDe(taxIds: string[], porId: Map<string, FilaImpuesto>): FilaImpuesto[] {
  const vistas = new Set<string>()
  const out: FilaImpuesto[] = []
  for (const id of taxIds) {
    if (vistas.has(id)) continue
    vistas.add(id)
    const imp = porId.get(id)
    if (imp && esVenta(imp)) out.push(imp)
  }
  return out
}

/**
 * Una tarifa por producto, en el mismo orden. El padre solo se usa cuando el
 * producto no tiene ningún impuesto de venta propio.
 */
export function resolverTarifas(entrada: {
  productos: ProductoConPadre[]
  relaciones: RelacionImpuesto[]
  impuestos: FilaImpuesto[]
}): { porProducto: { productId: number; tarifa: TarifaResuelta }[]; predeterminado: TarifaResuelta } {
  const porId = new Map(entrada.impuestos.map((i) => [i.id, i]))
  const relPorProducto = new Map<number, string[]>()
  for (const r of entrada.relaciones) {
    const lista = relPorProducto.get(r.productId) ?? []
    lista.push(r.taxId)
    relPorProducto.set(r.productId, lista)
  }
  const predeterminado = tarifaPredeterminada(entrada.impuestos)
  const porProducto = entrada.productos.map((p) => {
    const propias = filasDe(relPorProducto.get(p.id) ?? [], porId)
    if (propias.length > 0) {
      return { productId: p.id, tarifa: tarifaDeFilas(propias, true) }
    }
    const delPadre = p.parentId != null ? filasDe(relPorProducto.get(p.parentId) ?? [], porId) : []
    if (delPadre.length > 0) {
      return { productId: p.id, tarifa: tarifaDeFilas(delPadre, true) }
    }
    return { productId: p.id, tarifa: { ...predeterminado, componentes: predeterminado.componentes.map((c) => ({ ...c })) } }
  })
  return { porProducto, predeterminado }
}

export interface ResumenImpuesto {
  suma: number
  incluido: number
  nombre: string
  /** null cuando las líneas no comparten una sola tarifa. */
  tasa: number | null
}

/**
 * Impuesto que ve el cliente. Sin `tarifas`, todas las líneas usan la tarifa
 * predeterminada (lo que el checkout hacía antes de mirar el producto).
 */
export function impuestoParaLineas(args: {
  brutos: number[]
  descuento: number
  predeterminado: { tasa: number; incluido: boolean; nombre: string }
  tarifas: Array<TarifaResuelta | null> | null
}): { porLinea: number[]; total: number; sumaAlTotal: number; resumen: ResumenImpuesto } {
  const pedido = args.tarifas
    ? calcularImpuestoPedido({
        brutos: args.brutos,
        descuento: args.descuento,
        tasa: args.predeterminado.tasa,
        incluido: args.predeterminado.incluido,
        lineas: args.tarifas,
      })
    : calcularImpuestoPedido({
        brutos: args.brutos,
        descuento: args.descuento,
        tasa: args.predeterminado.tasa,
        incluido: args.predeterminado.incluido,
      })
  return { ...pedido, resumen: resumirImpuesto(pedido, args.tarifas, args.predeterminado) }
}

function resumirImpuesto(
  pedido: { total: number; sumaAlTotal: number },
  tarifas: Array<TarifaResuelta | null> | null,
  fallback: { tasa: number; incluido: boolean; nombre: string },
): ResumenImpuesto {
  const suma = pedido.sumaAlTotal
  const incluido = Math.max(0, redondear2(pedido.total - pedido.sumaAlTotal))
  if (!tarifas || tarifas.length === 0) {
    return { suma, incluido, nombre: fallback.nombre, tasa: fallback.tasa }
  }
  const efectivas = tarifas.map((t) => t ?? {
    tasa: fallback.tasa,
    incluido: fallback.incluido,
    nombre: fallback.nombre,
    componentes: [{ tasa: fallback.tasa, incluido: fallback.incluido, nombre: fallback.nombre }],
    delProducto: false,
  })
  const primera = efectivas[0]
  const unica = efectivas.every((t) => t.tasa === primera.tasa && t.nombre === primera.nombre && t.incluido === primera.incluido)
  if (unica) return { suma, incluido, nombre: primera.nombre, tasa: primera.tasa }
  return { suma, incluido, nombre: 'Impuestos', tasa: null }
}

/** Id de catálogo de una línea del carrito. Un id compuesto (`123_4-5`) no cuenta. */
export function idProductoCarrito(item: { id?: number | string | null; productId?: number | null }): number | null {
  const bruto = item.productId ?? item.id
  const n = typeof bruto === 'number' ? bruto : Number(bruto)
  return Number.isInteger(n) && n > 0 ? n : null
}
