'use client'

import { Truck, RotateCcw, Clock, MapPin } from 'lucide-react'
import { buildCardStyle } from '@/lib/sectionStyle'
import type { ResumenEnvioFicha } from './anclasFicha'
import { pedirPestanaFicha } from './eventosPestanas'
import { filasEnvioFicha, type ClaveFilaEnvio } from './filasEnvio'
import { CLAVES_TEXTOS_ENVIO } from '@/lib/website/v2/seccionesFicha'

export const CONTENT_KEYS = ['title', 'show_delivery_time', 'show_shipping_cost', 'show_return_policy', 'custom_message', ...CLAVES_TEXTOS_ENVIO] as const

interface ProductShippingProps {
  content: Record<string, any>
  data?: Record<string, any>
  primaryColor?: string
}

/** Título e ícono de cada línea. El texto sale de `filasEnvioFicha` (dato real o el del editor). */
const LINEAS: Record<ClaveFilaEnvio, { icono: typeof Clock; titulo: string; tituloPestana: string }> = {
  entrega: { icono: Clock, titulo: 'Tiempo de entrega', tituloPestana: 'Tiempo de entrega' },
  costo: { icono: Truck, titulo: 'Costo de envío', tituloPestana: 'Costo de envío' },
  devoluciones: { icono: RotateCcw, titulo: 'Devoluciones', tituloPestana: 'Cambios y devoluciones' },
  cobertura: { icono: MapPin, titulo: 'Cobertura', tituloPestana: 'Cobertura' },
}

/**
 * «Envío y devoluciones» de la ficha.
 *
 * - Sin pestañas: el bloque de siempre (título y tarjetas).
 * - Con pestañas de la ficha (Figma «Ficha — pestañas reales» 3255-99475): junto al botón queda
 *   una línea corta con los datos reales de la tienda (`data.envioFicha === 'resumen'`, sin datos
 *   no sale nada) y el detalle completo —con el mensaje propio— va en la pestaña
 *   «Envío y devoluciones» (`data.enPestanaFicha`). Los interruptores del bloque valen igual.
 */
export function ProductShipping({ content, data }: ProductShippingProps) {
  const resumen = (data?.resumenEnvio ?? null) as ResumenEnvioFicha | null
  if (data?.envioFicha === 'resumen') return <ResumenEnvio resumen={resumen} />
  if (data?.enPestanaFicha === true) return <DetalleEnvio content={content} resumen={resumen} />

  const title = content.title || 'Envío y devoluciones'
  const filas = filasEnvioFicha(content, resumen)
  const customMessage = content.custom_message || ''
  const columns = Number(content.columns ?? 2)
  const gap = content.gap ?? 16

  const smGridColsClass = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-4',
  }[columns] || 'sm:grid-cols-2'

  const { className: cardClassName, style: cardStyle } = buildCardStyle(content)

  return (
    <div className="space-y-4">
      <h2 className="titulo-legado text-xl font-bold text-gray-900 dark:text-white">{title}</h2>

      <div className={`grid grid-cols-1 ${smGridColsClass}`} style={{ gap: `${gap}px` }}>
        {filas.map(({ clave, texto }) => {
          const { icono: Icono, titulo } = LINEAS[clave]
          return (
            <div key={clave} className={`flex items-start gap-3 p-4 border rounded-lg dark:border-gray-700 ${cardClassName}`} style={cardStyle}>
              <Icono className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{titulo}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{texto}</p>
              </div>
            </div>
          )
        })}
      </div>

      {customMessage && (
        <p className="text-sm text-gray-600 dark:text-gray-300">{customMessage}</p>
      )}
    </div>
  )
}

/**
 * Línea corta junto al botón: «Envío gratis desde $ 150.000 · Llega en 2 a 4 días» y «Ver
 * detalles de envío y devoluciones», que abre esa pestaña y baja suave hasta la barra. Sin
 * JavaScript es un enlace `#envio` al bloque (apilado).
 */
function ResumenEnvio({ resumen }: { resumen: ResumenEnvioFicha | null }) {
  const partes = [resumen?.envioGratis, resumen?.llega].filter((t): t is string => Boolean(t))
  if (partes.length === 0) return null
  return (
    <div
      data-resumen-envio=""
      className="flex items-start gap-3 rounded-[var(--radio-sitio,0.75rem)] px-4 py-3 text-sm"
      style={{ backgroundColor: 'color-mix(in srgb, var(--text-color, #111827) 5%, var(--background-color, #ffffff))' }}
    >
      <Truck className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      <p className="min-w-0">
        <span className="font-medium text-gray-900 dark:text-white">{partes.join(' · ')}</span>
        <br />
        <a
          href="#envio"
          onClick={(e) => {
            if (pedirPestanaFicha('product_shipping')) e.preventDefault()
          }}
          className="text-gray-600 underline underline-offset-2 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          Ver detalles de envío y devoluciones
        </a>
      </p>
    </div>
  )
}

/** Detalle completo en la pestaña «Envío y devoluciones» (lista con ícono, mensaje propio al final). */
function DetalleEnvio({ content, resumen }: { content: Record<string, any>; resumen: ResumenEnvioFicha | null }) {
  const filas = filasEnvioFicha(content, resumen).map(({ clave, texto }) => ({ icono: LINEAS[clave].icono, titulo: LINEAS[clave].tituloPestana, texto }))
  const mensaje = typeof content.custom_message === 'string' ? content.custom_message.trim() : ''
  return (
    <div className="space-y-4" data-envio-pestana="">
      <ul className="space-y-4">
        {filas.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="flex items-start gap-3">
            <Icono className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
            <span>
              <span className="block text-sm font-medium text-gray-900 dark:text-white">{titulo}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-300">{texto}</span>
            </span>
          </li>
        ))}
      </ul>
      {mensaje && (
        <p
          className="inline-block rounded-[var(--radio-sitio,0.5rem)] px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
          style={{ backgroundColor: 'color-mix(in srgb, var(--text-color, #111827) 5%, var(--background-color, #ffffff))' }}
        >
          {mensaje}
        </p>
      )}
    </div>
  )
}
