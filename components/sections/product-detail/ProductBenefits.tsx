'use client'

import type React from 'react'
import {
  BadgePercent, Clock, CreditCard, Lock, MapPin, Package, PackageCheck, Phone, RefreshCw, Shield, ShieldCheck, Star, Truck, Wrench,
} from 'lucide-react'
import { buildCardStyle } from '@/lib/sectionStyle'
import {
  MEDIDAS_ICONO,
  TONOS_MULTICOLOR,
  leerItemsBeneficios,
  leerOpcionesBeneficios,
  type BeneficioFichaItem,
  type OpcionesBeneficios,
} from '@/lib/website/v2/seccionesFicha'
import { textoSobreAcento } from '@/lib/website/v2/textoSobreAcento'

export const CONTENT_KEYS = ['items'] as const

/** Los 4 de siempre + el set de 12 del editor (Figma 2985:72976). */
const ICON_MAP: Record<string, any> = {
  Truck,
  Shield,
  Package,
  Star,
  ShieldCheck,
  Wrench,
  RefreshCw,
  CreditCard,
  Lock,
  Clock,
  MapPin,
  PackageCheck,
  BadgePercent,
  Phone,
}

const DEFAULT_BENEFITS = [
  { icon: 'Truck', title: 'Envío rápido', description: '24-48 horas' },
  { icon: 'Shield', title: 'Garantía', description: '30 días' },
  { icon: 'Package', title: 'Empaque seguro', description: 'Protección total' },
  { icon: 'Star', title: 'Calidad', description: '100% original' },
]

/**
 * Tonos de los íconos, en orden. Clases literales (no `bg-${color}-100`): Tailwind solo genera
 * las clases que ve escritas en el código.
 */
const TONOS = [
  { fondo: 'bg-green-100 dark:bg-green-900/30', icono: 'text-green-600 dark:text-green-400' },
  { fondo: 'bg-blue-100 dark:bg-blue-900/30', icono: 'text-blue-600 dark:text-blue-400' },
  { fondo: 'bg-purple-100 dark:bg-purple-900/30', icono: 'text-purple-600 dark:text-purple-400' },
  { fondo: 'bg-yellow-100 dark:bg-yellow-900/30', icono: 'text-yellow-600 dark:text-yellow-400' },
]

interface ProductBenefitsProps {
  content: {
    items?: Array<{ icon?: string; title?: string; description?: string; color?: string }>
    columns?: number
    gap?: number
    [clave: string]: unknown
  }
  primaryColor?: string
  data?: { restaurante?: unknown }
}

/**
 * Beneficios de la ficha (envío, garantía…). Sin opciones pinta exactamente la franja de siempre:
 * rejilla de 2 columnas con separador superior. `columns`, `gap` e `items` la ajustan; el estilo
 * de tarjeta (`card_*`) solo se aplica si el contenido trae alguna clave `card_`.
 *
 * Con alguna clave nueva (`lib/website/v2/seccionesFicha.ts`, Figma 2984:72581) se pinta con
 * opciones: estilo (Lista, Tarjetas, Franja, Insignias), color, fondo, forma y tamaño del ícono,
 * columnas en celular, alineación, líneas entre ítems y descripción.
 */
export function ProductBenefits({ content, primaryColor = '#3B82F6', data }: ProductBenefitsProps) {
  // Restaurante sin beneficios propios: los de e-commerce («Envío rápido 24-48 horas»,
  // «Garantía 30 días») no aplican a un plato. Con ítems configurados, se pintan.
  if (data?.restaurante && !content.items?.length) return null
  const opciones = leerOpcionesBeneficios(content)
  if (opciones.conOpciones) {
    const items = content.items?.length ? leerItemsBeneficios(content) : DEFAULT_BENEFITS.map((b) => ({ ...b, color: null }))
    return <BeneficiosConOpciones items={items} opciones={opciones} primaryColor={primaryColor} />
  } else {
    // Sin opciones nuevas: lo de siempre.
  }
  const items = content.items?.length ? content.items : DEFAULT_BENEFITS
  const columns = content.columns ?? 2

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[columns] || 'grid-cols-2'

  const conEstiloTarjeta = Object.keys(content).some((clave) => clave.startsWith('card_'))
  const { className: cardClassName, style: cardStyle } = conEstiloTarjeta
    ? buildCardStyle(content)
    : { className: '', style: undefined }
  const claseItem = ['flex items-center gap-3', cardClassName].filter(Boolean).join(' ')
  const gapPropio = typeof content.gap === 'number'

  return (
    <div
      className={`grid ${gridColsClass} ${gapPropio ? '' : 'gap-4 '}pt-6 border-t dark:border-gray-700`}
      style={gapPropio ? { gap: `${content.gap}px` } : undefined}
    >
      {items.map((item, i) => {
        const Icon = ICON_MAP[item.icon || ''] || Star
        const tono = TONOS[i % TONOS.length]
        return (
          <div key={i} className={claseItem} style={cardStyle}>
            <div className={`w-10 h-10 rounded-full ${tono.fondo} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${tono.icono}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Con opciones (Figma 2984:72581 / 2984:72912) ─────────────────────────────────────────

const COLS_ESCRITORIO: Record<number, string> = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }
const COLS_BASE: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }
const VAR_MARCA = { primario: 'var(--primary-color)', secundario: 'var(--secondary-color)', acento: 'var(--accent-color)' } as const

/** Color del ícono de un ítem (hex o variable CSS de la marca). */
function colorDeItem(item: BeneficioFichaItem, i: number, o: OpcionesBeneficios, primaryColor: string): { color: string; hex: string | null } {
  if (o.modoColor === 'propio') return { color: o.colorPropio, hex: o.colorPropio }
  if (o.modoColor === 'marca') {
    if (o.colorMarca === 'primario') return { color: `var(--primary-color, ${primaryColor})`, hex: primaryColor }
    return { color: VAR_MARCA[o.colorMarca], hex: null }
  }
  const tono = item.color ?? TONOS_MULTICOLOR[i % TONOS_MULTICOLOR.length]
  return { color: tono, hex: tono }
}

/** Cuadro del ícono: forma × fondo × tamaño; sobre fondo sólido, el ícono pasa a blanco o negro. */
function IconoBeneficio({ item, i, o, primaryColor }: { item: BeneficioFichaItem; i: number; o: OpcionesBeneficios; primaryColor: string }) {
  const Icon = ICON_MAP[item.icon] || Star
  const { color, hex } = colorDeItem(item, i, o, primaryColor)
  const medida = MEDIDAS_ICONO[o.tamano]
  const forma = o.forma === 'circulo' ? 'rounded-full' : 'rounded-lg'
  const estilo: React.CSSProperties = { width: medida.caja, height: medida.caja }
  let colorIcono = color
  if (o.fondo === 'suave') estilo.backgroundColor = `color-mix(in srgb, ${color} 14%, transparent)`
  else if (o.fondo === 'solido') {
    estilo.backgroundColor = color
    colorIcono = hex ? textoSobreAcento(hex) : '#FFFFFF'
  } else {
    // Sin fondo: solo el ícono, sin caja.
  }
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center ${forma}`} style={estilo}>
      <Icon style={{ width: medida.icono, height: medida.icono, color: colorIcono }} strokeWidth={1.75} />
    </span>
  )
}

function BeneficiosConOpciones({ items, opciones: o, primaryColor }: { items: BeneficioFichaItem[]; opciones: OpcionesBeneficios; primaryColor: string }) {
  const centro = o.alineacion === 'centro'
  const gap = o.gap ?? 16
  const textos = (item: BeneficioFichaItem) => (
    <span className={`min-w-0 ${centro ? 'text-center' : ''}`}>
      <span className="block text-sm font-medium text-gray-900 dark:text-white">{item.title}</span>
      {o.mostrarDescripcion && item.description && (
        <span className="block text-xs text-gray-500 dark:text-gray-400">{item.description}</span>
      )}
    </span>
  )

  // Insignias compactas: pastillas que se acomodan solas.
  if (o.estilo === 'insignias') {
    return (
      <ul className={`flex flex-wrap pt-6 border-t dark:border-gray-700 ${centro ? 'justify-center' : ''}`} style={{ gap: Math.min(gap, 12) }} data-beneficios="insignias">
        {items.map((item, i) => (
          <li
            key={i}
            className={`inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 ${o.borde === 'linea' ? 'border border-gray-200 dark:border-gray-700' : ''} ${o.borde === 'sombra' ? 'shadow-sm' : ''}`}
            style={{ backgroundColor: o.fondoItem ?? undefined }}
          >
            <IconoBeneficio item={item} i={i} o={{ ...o, tamano: 'sm' }} primaryColor={primaryColor} />
            <span className="text-[13px] font-medium text-gray-900 dark:text-white">{item.title}</span>
          </li>
        ))}
      </ul>
    )
  }

  const colsCelular = COLS_BASE[o.columnasCelular ?? o.columnas] ?? 'grid-cols-2'
  const colsEscritorio = COLS_ESCRITORIO[o.columnas] ?? 'md:grid-cols-2'

  // Tarjetas: un recuadro por beneficio, ícono arriba.
  if (o.estilo === 'tarjetas') {
    return (
      <ul className={`grid ${colsCelular} ${colsEscritorio} pt-6`} style={{ gap }} data-beneficios="tarjetas">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex flex-col gap-3 rounded-xl p-5 ${centro ? 'items-center' : ''} ${o.borde === 'linea' ? 'border border-gray-200 dark:border-gray-700' : ''} ${o.borde === 'sombra' ? 'shadow-md' : ''}`}
            style={{ backgroundColor: o.fondoItem ?? undefined }}
          >
            <IconoBeneficio item={item} i={i} o={o} primaryColor={primaryColor} />
            {textos(item)}
          </li>
        ))}
      </ul>
    )
  }

  // Franja horizontal: una fila con fondo suave y separadores verticales opcionales; en el celular
  // se desliza de lado (Figma 2984:72912).
  if (o.estilo === 'franja') {
    return (
      <ul
        className="flex snap-x snap-mandatory overflow-x-auto md:items-center md:overflow-visible rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-4"
        style={{ gap }}
        data-beneficios="franja"
      >
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex min-w-[75%] shrink-0 snap-start items-center gap-3 md:min-w-0 md:flex-1 md:shrink ${centro ? 'justify-center' : ''} ${o.lineas && i > 0 ? 'md:border-l md:border-gray-200 md:pl-4 dark:md:border-gray-700' : ''}`}
          >
            <IconoBeneficio item={item} i={i} o={o} primaryColor={primaryColor} />
            {textos(item)}
          </li>
        ))}
      </ul>
    )
  }

  // Lista (por defecto): la rejilla de hoy con sus opciones; con líneas, cada fila con separador.
  return (
    <ul
      className={`grid ${colsCelular} ${colsEscritorio} pt-6 border-t dark:border-gray-700`}
      style={{ columnGap: gap, rowGap: o.lineas ? 0 : gap }}
      data-beneficios="lista"
    >
      {items.map((item, i) => (
        <li
          key={i}
          className={`flex items-center gap-3 ${centro ? 'flex-col text-center' : ''} ${o.lineas ? 'border-b border-gray-200 py-3 last:border-b-0 dark:border-gray-700' : ''}`}
        >
          <IconoBeneficio item={item} i={i} o={o} primaryColor={primaryColor} />
          {textos(item)}
        </li>
      ))}
    </ul>
  )
}
