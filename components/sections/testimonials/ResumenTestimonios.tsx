/**
 * Resumen de reseñas de la sección de testimonios (`show_summary` + `summary_source`, PLANO §2
 * ítem 28): estrellas y «4,9 de 1.280 reseñas» con el agregado REAL.
 *
 * - `summary_source: 'testimonials'` (default) = testimonios activos; `'product_reviews'` =
 *   reseñas de productos aprobadas.
 * - Sin `show_summary`, sin datos o con 0 reseñas: no pinta nada (la sección queda como hoy).
 *
 * Datos: `data.resumenResenas[fuente]`, que precarga `lib/queries/tienda/portada.ts` SOLO cuando
 * alguna sección de testimonios tiene `show_summary: true`.
 *
 * Sin 'use client' y sin estado: lo pintan las cuatro variantes de testimonios.
 */
import { Star } from 'lucide-react'
import { normalizarAjustesTestimonios } from '@/lib/website/v2/contrato/seccionesTienda'
import { partirResumen, textoResumenDe } from '@/lib/website/portadaTienda'

export function ResumenTestimonios({
  content,
  data,
  className = '',
}: {
  content: Record<string, unknown>
  data?: unknown
  className?: string
}) {
  const ajustes = normalizarAjustesTestimonios(content)
  if (!ajustes.showSummary) return null
  const texto = textoResumenDe(data, ajustes.summarySource)
  if (!texto) return null
  const { cifra, resto } = partirResumen(texto)
  // Estrellas llenas = el promedio real redondeado (4,4 → 4), nunca cinco fijas.
  const llenas = Math.round(Number(cifra.replace(',', '.'))) || 0
  return (
    <p className={`flex items-center gap-3 ${className}`} data-resumen-resenas="">
      <span className="sr-only">{texto}</span>
      <span className="text-4xl font-semibold leading-none tracking-tight" aria-hidden="true">{cifra}</span>
      <span className="flex flex-col gap-1" aria-hidden="true">
        <span className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={`h-3.5 w-3.5 ${i < llenas ? 'fill-current' : 'opacity-30'}`} />
          ))}
        </span>
        <span className="text-xs opacity-70">{resto}</span>
      </span>
    </p>
  )
}
