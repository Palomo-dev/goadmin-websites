/**
 * Ficha técnica de las plantillas de tienda: `product_specs · icon_grid` (Panorama, rejilla con
 * ícono) y `product_specs · panel` (Hogar y Roble, «Sobre esta pieza» en un panel).
 *
 * Datos reales, nunca inventados: cada fila sale de una columna de `products` (`brand`,
 * `length_cm`/`width_cm`/`height_cm`, `weight_kg`, `warranty_months`, `reference`) o de la
 * categoría del producto. Sin el dato, la fila no se pinta; sin ninguna fila, el bloque tampoco.
 *
 * Sin 'use client': en la ficha se pinta en el servidor. El ícono propio se resuelve por nombre
 * (como HeroButtons, que ya trae lucide completo al mapa de secciones). La variante `default`
 * (atributos) sigue en ProductSpecs.tsx, sin cambios.
 */

import * as LucideIcons from 'lucide-react'
import { Hash, LayoutGrid, Ruler, ShieldCheck, Tag, Weight, type LucideIcon } from 'lucide-react'
import {
  CLAVES_SECCION_TIENDA,
  normalizarFichaTecnica,
  textoDimensiones,
  textoGarantia,
  textoPeso,
  type FuenteFichaTecnica,
} from '@/lib/website/v2/contrato/seccionesTienda'

export const CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_specs.icon_grid']

const ICONO_POR_FUENTE: Record<FuenteFichaTecnica, LucideIcon> = {
  brand: Tag,
  dimensions: Ruler,
  weight: Weight,
  warranty: ShieldCheck,
  reference: Hash,
  category: LayoutGrid,
}

interface FilaPintada {
  icono: LucideIcon
  etiqueta: string
  valor: string
}

interface PropsFichaTecnica {
  content: Record<string, any>
  data?: {
    product?: Record<string, any> | null
    /** Categoría del producto (la resuelve la página desde las categorías del contexto). */
    categoriaFicha?: { name?: string | null } | null
  }
}

function textoColumna(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim().replace(/\s+/g, ' ')
  return t ? t.slice(0, 120) : null
}

function valorDeFuente(fuente: FuenteFichaTecnica, product: Record<string, any>, categoria: string | null): string | null {
  switch (fuente) {
    case 'brand':
      return textoColumna(product.brand)
    case 'dimensions':
      return textoDimensiones(product.length_cm, product.width_cm, product.height_cm)
    case 'weight':
      return textoPeso(product.weight_kg)
    case 'warranty':
      return textoGarantia(product.warranty_months)
    case 'reference':
      return textoColumna(product.reference)
    case 'category':
      return textoColumna(categoria)
    default:
      return null
  }
}

function iconoPorNombre(nombre: string): LucideIcon | null {
  if (!nombre) return null
  // Los íconos de lucide son componentes `forwardRef` (objeto con `$$typeof`); lo demás no sirve.
  const icono = (LucideIcons as unknown as Record<string, unknown>)[nombre]
  return icono && typeof icono === 'object' && '$$typeof' in icono ? (icono as LucideIcon) : null
}

/** Filas con dato real, en el orden del contenido. Exportada para el verify. */
export function filasFichaTecnica(content: Record<string, unknown> | null | undefined, product: Record<string, any> | null | undefined, categoria: string | null | undefined) {
  const ficha = normalizarFichaTecnica(content)
  if (!product) return { titulo: ficha.title, filas: [] as FilaPintada[] }
  const filas: FilaPintada[] = []
  for (const fila of ficha.rows) {
    const valor = valorDeFuente(fila.source, product, categoria ?? null)
    if (!valor) continue
    filas.push({ icono: iconoPorNombre(fila.icon) ?? ICONO_POR_FUENTE[fila.source], etiqueta: fila.label, valor })
  }
  return { titulo: ficha.title, filas }
}

/** `product_specs · icon_grid`: rejilla con ícono, valor y rótulo (Panorama). */
export function ProductSpecsIconos({ content, data }: PropsFichaTecnica) {
  const { titulo, filas } = filasFichaTecnica(content, data?.product, data?.categoriaFicha?.name)
  if (filas.length === 0) return null
  return (
    <div data-ficha-tecnica="icon_grid">
      <h2 className="sr-only">{titulo}</h2>
      <dl
        className="grid grid-cols-2 overflow-hidden rounded-[var(--radio-sitio,0.75rem)] border sm:grid-cols-4"
        style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }}
      >
        {filas.map(({ icono: Icono, etiqueta, valor }) => (
          <div
            key={etiqueta}
            className="flex items-start gap-2.5 p-3"
            style={{ boxShadow: '0 0 0 0.5px color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }}
          >
            <Icono className="mt-0.5 h-4 w-4 flex-shrink-0 opacity-70" aria-hidden="true" />
            <div className="min-w-0">
              <dd className="text-sm font-medium text-gray-900 dark:text-white">{valor}</dd>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{etiqueta}</dt>
            </div>
          </div>
        ))}
      </dl>
    </div>
  )
}
ProductSpecsIconos.CONTENT_KEYS = CONTENT_KEYS

/** `product_specs · panel`: panel «Sobre esta pieza» con filas rótulo / valor (Hogar, Roble). */
export function ProductSpecsPanel({ content, data }: PropsFichaTecnica) {
  const { titulo, filas } = filasFichaTecnica(content, data?.product, data?.categoriaFicha?.name)
  if (filas.length === 0) return null
  return (
    <div
      data-ficha-tecnica="panel"
      className="rounded-[var(--radio-sitio,0.75rem)] p-6 sm:p-8"
      style={{ backgroundColor: 'color-mix(in srgb, var(--text-color, #111827) 5%, var(--background-color, #ffffff))' }}
    >
      <h2 className="mb-4 text-sm font-medium text-gray-500 dark:text-gray-400">{titulo}</h2>
      <dl>
        {filas.map(({ etiqueta, valor }) => (
          <div
            key={etiqueta}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 border-t py-3 text-sm"
            style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 10%, transparent)' }}
          >
            <dt className="text-gray-500 dark:text-gray-400">{etiqueta}</dt>
            <dd className="text-gray-900 dark:text-white">{valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
ProductSpecsPanel.CONTENT_KEYS = CLAVES_SECCION_TIENDA['product_specs.panel']
