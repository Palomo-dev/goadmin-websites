/**
 * Etiquetas de un producto: CUÁNDO sale cada una, su TEXTO y su COLOR. Una sola regla para la
 * tarjeta (`ProductCard` › BadgeRenderer) y la ficha (`components/site/etiquetas/EtiquetasFicha`,
 * Figma «16 Sitio web» 3036:78040): si la tarjeta muestra «Agotado» a un producto, la ficha
 * también; si «Estilo de tarjeta › Etiquetas» apaga una, tampoco sale en la ficha.
 *
 * Código puro: sin React ni alias (imports relativos), para que `verify-etiquetas-ficha.mjs` lo
 * cargue con `--experimental-strip-types`.
 */
import {
  etiquetaPermitidaEnTarjeta,
  normalizarTarjeta,
  pintarEtiquetaTarjeta,
  textoContraste,
  type EstiloTarjetaProducto,
  type EtiquetaPropiaTarjeta,
} from './tarjetaProducto'
import type { EsquinaEtiquetaFicha, OpcionesEtiquetasFicha, TipoEtiquetaFicha } from './v2/seccionesFicha'

// ── Regla común (tarjeta y ficha) ────────────────────────────────────────────────────────────────

/** Lo que la regla necesita saber del producto (ya calculado por quien pinta). */
export interface DatosEtiquetaProducto {
  /** % de descuento por precio anterior (`compare_price`), o null. */
  discount: number | null
  outOfStock: boolean
  isParent: boolean
  /** Padre sin variantes que comprar: «Agotado» aunque no lleve stock. */
  padreSinVariantes: boolean
  variantCount: number
  salesCount: number
  createdAt?: string | null
  /** Stock total (low_stock). */
  stock?: number | null
  ratingAvg?: number | null
  ratingCount?: number | null
  categoryName?: string | null
}

/**
 * ¿Sale la etiqueta `tipo` y con qué `{value}`? Es el `switch` de siempre de la tarjeta, sin
 * cambios. `condicion` = `condition_value` de la etiqueta (días de «Nuevo», tope de «Pocas
 * unidades»). Tipos desconocidos: no salen.
 */
export function valorEtiqueta(
  tipo: string | null | undefined,
  d: DatosEtiquetaProducto,
  condicion?: number | null,
  ahora: number = Date.now(),
): { mostrar: boolean; valor: number | string | null } {
  switch (tipo) {
    case 'discount':
      return { mostrar: d.discount !== null && d.discount > 0, valor: d.discount }
    case 'out_of_stock':
      // Padre sin variantes que comprar: también «Agotado» (no hay talla que elegir).
      return { mostrar: d.padreSinVariantes || (d.outOfStock && !d.isParent && (d.discount === null || d.discount <= 0)), valor: null }
    case 'variants':
      return { mostrar: d.variantCount > 0, valor: d.variantCount }
    case 'sales_count':
    case 'bestseller':
      return { mostrar: d.salesCount > 0, valor: d.salesCount }
    case 'new': {
      // condition_value = días máximos desde created_at (default 30)
      const maxDays = condicion ?? 30
      const created = d.createdAt ? new Date(d.createdAt) : null
      if (!created) return { mostrar: true, valor: null }
      const daysSince = (ahora - created.getTime()) / 86400000
      return { mostrar: daysSince <= maxDays, valor: null }
    }
    case 'low_stock': {
      // Muestra si el stock total es > 0 pero <= condition_value (default 5)
      const threshold = condicion ?? 5
      const totalStock = d.stock ?? 0
      return { mostrar: !d.outOfStock && totalStock > 0 && totalStock <= threshold, valor: null }
    }
    case 'free_shipping':
    case 'custom':
      return { mostrar: true, valor: null }
    case 'rating': {
      const ratingAvg = Number(d.ratingAvg) || 0
      const ratingCount = d.ratingCount || 0
      return { mostrar: ratingAvg > 0 && ratingCount > 0, valor: ratingAvg.toFixed(1) }
    }
    case 'category': {
      // Muestra el nombre de la categoría del producto
      const catName = d.categoryName || ''
      return { mostrar: catName.length > 0, valor: catName }
    }
    default:
      return { mostrar: false, valor: null }
  }
}

/** Color de fondo de cada etiqueta cuando nadie configuró uno (fondo + texto blanco). */
export function colorBaseEtiqueta(tipo: string | null | undefined, primaryColor: string): string {
  switch (tipo) {
    case 'variants': return primaryColor
    case 'discount': return '#EF4444'
    case 'promotion': return '#EF4444'
    case 'out_of_stock': return '#1F2937'
    case 'sales_count': return 'rgba(0,0,0,0.6)'
    case 'new': return '#10B981'        // verde
    case 'bestseller': return '#F59E0B'  // ámbar
    case 'low_stock': return '#F97316'   // naranja
    case 'free_shipping': return '#3B82F6' // azul
    case 'rating': return '#F59E0B'      // ámbar
    case 'category': return primaryColor // color de marca
    case 'custom': return primaryColor   // color de marca
    default: return primaryColor         // fallback genérico
  }
}

/**
 * Texto de la etiqueta con su plantilla (`{value}`). Un texto vacío no es «sin etiqueta»: sin
 * texto, el descuento usa «-{value}%» (el mismo default del editor).
 */
export function textoEtiqueta(tipo: string | null | undefined, plantilla: string | null | undefined, valor: number | string | null): string {
  const p = tipo === 'discount' ? (plantilla?.trim() || '-{value}%') : (plantilla ?? '')
  return p.replace('{value}', valor !== null ? String(valor) : '')
}

// ── Ficha ────────────────────────────────────────────────────────────────────────────────────────

type ClaveTarjeta = 'label_new' | 'label_shipping' | 'label_discount' | 'label_sold_out' | 'label_promotion'

/** Etiqueta de la ficha → su clave en «Estilo de tarjeta › Etiquetas» y su tipo de la tarjeta. */
const DE_TARJETA: Partial<Record<TipoEtiquetaFicha, { clave: ClaveTarjeta; tipo: string }>> = {
  free_shipping: { clave: 'label_shipping', tipo: 'free_shipping' },
  discount: { clave: 'label_discount', tipo: 'discount' },
  promotion: { clave: 'label_promotion', tipo: 'promotion' },
  new: { clave: 'label_new', tipo: 'new' },
  sold_out: { clave: 'label_sold_out', tipo: 'out_of_stock' },
}

export type IconoEtiqueta = 'truck' | 'layers' | 'trending' | 'check' | 'shield' | 'star' | 'zap'

export interface EtiquetaFichaPintada {
  /** Única en la ficha (React key). */
  clave: string
  tipo: TipoEtiquetaFicha
  texto: string
  icono?: IconoEtiqueta
  /** Esquina en A. */
  esquina: EsquinaEtiquetaFicha
  forma: 'pill' | 'rounded' | 'semi' | 'square'
  bg_color?: string
  text_color?: string
  extra_style?: Record<string, string>
  /** B: se toca para explicarse («2 X 1») o para bajar a la tabla («Precio por volumen»). */
  accion?: 'promocion' | 'volumen'
}

export interface DatosEtiquetasFicha extends DatosEtiquetaProducto {
  /** Texto de la promoción real («2 X 1»), o null. */
  promoTexto?: string | null
  /** Resumen del precio por volumen («Desde 3: −10 %»), o null. */
  volumenTexto?: string | null
}

/** Colores por defecto de cada etiqueta de la ficha (Figma 3036:78121). */
function colorFicha(tipo: TipoEtiquetaFicha, primaryColor: string): { bg: string; text: string } {
  if (tipo === 'volume') return { bg: primaryColor, text: textoContraste(primaryColor) }
  if (tipo === 'sales_count') return { bg: '#4B5563', text: '#FFFFFF' }
  if (tipo === 'sold_out') return { bg: '#1F2937', text: '#FFFFFF' }
  return { bg: colorBaseEtiqueta(tipo, primaryColor), text: '#FFFFFF' }
}

/** Etiquetas propias de la ficha: su lista (aunque esté vacía) o, sin lista, las del sitio. */
export function propiasDeFicha(opciones: Pick<OpcionesEtiquetasFicha, 'propias'>, estiloSitio: unknown): EtiquetaPropiaTarjeta[] {
  if (Array.isArray(opciones.propias)) return normalizarTarjeta({ labels_custom: opciones.propias })?.labels_custom ?? []
  return normalizarTarjeta(estiloSitio)?.labels_custom ?? []
}

/**
 * Etiquetas que pinta la ficha, en el orden elegido. `donde`: `foto` (A, «Desde 3: −10 %») o
 * `titulo` (B, «Precio por volumen» y sin el descuento, que va en rojo junto al precio).
 * `estiloTarjeta` = el estilo de tarjeta del sitio ya resuelto (o null = la tarjeta de hoy);
 * `estiloSitio` = el crudo (para sus etiquetas propias).
 */
export function etiquetasFicha(
  opciones: OpcionesEtiquetasFicha,
  estiloTarjeta: EstiloTarjetaProducto | null,
  estiloSitio: unknown,
  d: DatosEtiquetasFicha,
  primaryColor: string,
  donde: 'foto' | 'titulo',
): EtiquetaFichaPintada[] {
  if (!opciones.mostrar) return []
  const modo = opciones.relleno === 'tarjeta' ? estiloTarjeta?.label_style : opciones.relleno
  const formaTarjeta = estiloTarjeta?.label_shape
  const forma: EtiquetaFichaPintada['forma'] = opciones.forma !== 'tarjeta'
    ? opciones.forma
    : formaTarjeta === 'rounded' || formaTarjeta === 'semi' || formaTarjeta === 'square' ? formaTarjeta : 'pill'
  const salida: EtiquetaFichaPintada[] = []

  for (const item of opciones.items) {
    if (!item.visible) continue
    if (item.id === 'custom') {
      for (const e of propiasDeFicha(opciones, estiloSitio)) {
        if (e.show === false) continue
        const bg = e.bg || '#111827'
        salida.push({
          clave: `custom-${e.id}`,
          tipo: 'custom',
          texto: e.label,
          ...(e.icon ? { icono: e.icon } : {}),
          esquina: e.position ?? 'top_right',
          forma,
          ...pintarEtiquetaTarjeta(null, null, { bg, text: e.text || textoContraste(bg) }, modo),
        })
      }
      continue
    }
    if (donde === 'titulo' && item.id === 'discount') continue // B: en rojo junto al precio (PrecioFicha)
    const deTarjeta = DE_TARJETA[item.id]
    // La promoción en la tarjeta es opcional (apagada por defecto); en la ficha manda su interruptor.
    if (deTarjeta && item.id !== 'promotion' && !etiquetaPermitidaEnTarjeta(estiloTarjeta, deTarjeta.clave)) continue

    let texto: string | null = null
    let icono: IconoEtiqueta | undefined
    let accion: EtiquetaFichaPintada['accion']
    switch (item.id) {
      case 'free_shipping':
        texto = 'Envío gratis'
        icono = 'truck'
        break
      case 'discount': {
        const v = valorEtiqueta('discount', d)
        texto = v.mostrar ? `-${v.valor} %` : null
        break
      }
      case 'promotion':
        texto = d.promoTexto || null
        accion = 'promocion'
        break
      case 'volume':
        texto = d.volumenTexto ? (donde === 'foto' ? d.volumenTexto : 'Precio por volumen') : null
        icono = 'layers'
        accion = 'volumen'
        break
      case 'sales_count': {
        const v = valorEtiqueta('sales_count', d)
        texto = v.mostrar ? `${v.valor} vendidos` : null
        icono = 'trending'
        break
      }
      case 'new':
        texto = valorEtiqueta('new', d).mostrar ? 'Nuevo' : null
        break
      case 'sold_out':
        texto = valorEtiqueta('out_of_stock', d).mostrar ? 'Agotado' : null
        break
    }
    if (!texto) continue
    const base = colorFicha(item.id, primaryColor)
    // Colores: los propios de la ficha; si no, los de la tarjeta; si no, los de por defecto.
    const pintado = item.bg
      ? pintarEtiquetaTarjeta(null, null, { bg: item.bg, text: item.text || textoContraste(item.bg) }, modo)
      : pintarEtiquetaTarjeta(estiloTarjeta, deTarjeta?.clave ?? null, { bg: base.bg, text: item.text || base.text }, modo)
    salida.push({
      clave: item.id,
      tipo: item.id,
      texto,
      ...(icono ? { icono } : {}),
      esquina: item.esquina,
      forma,
      ...pintado,
      ...(accion && donde === 'titulo' ? { accion } : {}),
    })
  }
  return salida
}

/** Colores del descuento junto al precio en B (rojo, o los de la etiqueta). null = el verde de hoy. */
export function colorDescuentoFicha(
  opciones: OpcionesEtiquetasFicha,
  estiloTarjeta: EstiloTarjetaProducto | null,
): { bg: string; text: string } | null {
  if (!opciones.mostrar || (opciones.ubicacion !== 'titulo' && opciones.ubicacion !== 'ambas')) return null
  const item = opciones.items.find((i) => i.id === 'discount')
  if (!item?.visible || !etiquetaPermitidaEnTarjeta(estiloTarjeta, 'label_discount')) return null
  const bg = item.bg || estiloTarjeta?.label_discount?.bg || '#EF4444'
  return { bg, text: item.text || estiloTarjeta?.label_discount?.text || textoContraste(bg) }
}
