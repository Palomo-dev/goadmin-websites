'use client'

import { buildCardStyle } from '@/lib/sectionStyle'
import { textoDimensiones, textoGarantia, textoPeso } from '@/lib/website/v2/contrato/seccionesTienda'
import { ETIQUETAS_FILA_FICHA, leerFilasPropias, normalizarEspecificacionesFicha, type FilaFicha } from '@/lib/website/v2/seccionesFicha'

export const CONTENT_KEYS = ['title', 'layout', 'show_empty', 'group_by_category', 'spec_rows'] as const

interface ProductSpecsProps {
  content: Record<string, any>
  data?: Record<string, any>
  primaryColor?: string
}

/** Grupo de la tabla: columnas del producto y filas propias que escribió el comercio. */
const GRUPO_GENERAL = 'General'
const GRUPO_PROPIAS = 'Del producto'

function textoColumna(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, 120) : null
}

function valorColumna(f: FilaFicha, product: any, categoria: string | null): string | null {
  switch (f) {
    case 'marca': return textoColumna(product?.brand)
    case 'referencia': return textoColumna(product?.reference)
    case 'medidas': return textoDimensiones(product?.length_cm, product?.width_cm, product?.height_cm)
    case 'peso': return textoPeso(product?.weight_kg)
    case 'garantia': return textoGarantia(product?.warranty_months)
    case 'categoria': return textoColumna(categoria)
    default: return null
  }
}

/**
 * Filas de «Especificaciones · Por defecto» (Figma «16 Sitio web», bloque 5): la misma ficha
 * técnica de la Descripción (columnas de Inventario › producto + filas propias), con las filas y
 * el orden del editor (`spec_rows`). Sin dato: la fila no sale, o «—» con «Mostrar filas vacías».
 * Exportada para el verify.
 */
export function filasEspecificaciones(content: Record<string, unknown>, product: any, categoria: string | null, showEmpty: boolean) {
  const e = normalizarEspecificacionesFicha(content)
  const columnas = e.filas
    .map((f) => ({ name: ETIQUETAS_FILA_FICHA[f], value: valorColumna(f, product, categoria) ?? '', category: GRUPO_GENERAL }))
    .filter((a) => showEmpty || a.value)
    .map((a) => ({ ...a, value: a.value || '—' }))
  const propias = e.filasPropias
    ? leerFilasPropias(product?.specifications).map((f) => ({ name: f.nombre, value: f.valor, category: GRUPO_PROPIAS }))
    : []
  // Las propias van donde las puso el editor (contando solo columnas que salen).
  const antes = e.filas.slice(0, e.posicionPropias).filter((f) => columnas.some((c) => c.name === ETIQUETAS_FILA_FICHA[f])).length
  return [...columnas.slice(0, antes), ...propias, ...columnas.slice(antes)]
}

export function ProductSpecs({ content, data }: ProductSpecsProps) {
  const product = data?.product
  if (!product) return null

  const title = content.title || 'Especificaciones técnicas'
  const layout = content.layout || 'table'
  const showEmpty = content.show_empty === true || content.show_empty === 'true'
  const groupByCategory = content.group_by_category ?? true
  const columns = Number(content.columns ?? 3)
  const gap = content.gap ?? 16
  const radius = typeof content.radius === 'number' ? content.radius : 0
  const borderWidth = typeof content.border_width === 'number' ? content.border_width : 0

  const mdGridColsClass = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  }[columns] || 'md:grid-cols-3'

  const { className: cardClassName, style: cardStyle } = buildCardStyle(content)

  // Antes leía `product_attributes`, que no existe en la base: el bloque nunca pintaba nada.
  const filtered = filasEspecificaciones(content, product, data?.categoriaFicha?.name ?? null, showEmpty)

  if (filtered.length === 0) return null

  // Agrupar: «General» (columnas del producto) y «Del producto» (filas propias).
  const grouped = groupByCategory
    ? filtered.reduce((acc, attr) => {
        const cat = attr.category || GRUPO_GENERAL
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(attr)
        return acc
      }, {} as Record<string, typeof filtered>)
    : { [GRUPO_GENERAL]: filtered }

  return (
    <div className="space-y-6">
      <h2 className="titulo-legado text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {Object.entries(grouped).map(([category, attrs]) => (
        <div key={category}>
          {groupByCategory && Object.keys(grouped).length > 1 && (
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">{category}</h3>
          )}
          {layout === 'table' && (
            <table
              className="w-full text-sm"
              style={{
                borderRadius: radius > 0 ? `${radius}px` : undefined,
                borderWidth: borderWidth > 0 ? `${borderWidth}px` : undefined,
                borderCollapse: borderWidth > 0 ? 'separate' : undefined,
                borderStyle: borderWidth > 0 ? 'solid' : undefined,
                borderColor: content.border_color || undefined,
                overflow: 'hidden',
              }}
            >
              <tbody>
                {attrs.map((attr, i) => (
                  <tr key={i} className="border-b dark:border-gray-700">
                    <td className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-300 w-1/3">{attr.name}</td>
                    <td className="py-2 text-gray-900 dark:text-white">{attr.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {layout === 'grid' && (
            <div className={`grid grid-cols-2 ${mdGridColsClass}`} style={{ gap: `${gap}px` }}>
              {attrs.map((attr, i) => (
                <div key={i} className={`border rounded-lg p-3 dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{attr.name}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{attr.value}</p>
                </div>
              ))}
            </div>
          )}
          {layout === 'list' && (
            <ul className="space-y-2">
              {attrs.map((attr, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">{attr.name}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{attr.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
