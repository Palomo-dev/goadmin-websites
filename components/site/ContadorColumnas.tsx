'use client'

import { CountdownBanner } from './CountdownBanner'
import { useAjustesVivosPreview } from './useAjustesVivosPreview'
import { contadorEn, type ColumnaUbicacionContador } from '@/lib/website/contadorColumnas'

/**
 * Contador clásico (columnas `countdown_*`) en una ubicación. Fuera del lienzo del editor es la
 * misma condición de siempre (activo + ubicación marcada); en el lienzo (`?preview=1`) aplica lo
 * que se está editando sin guardar.
 */
export function ContadorColumnas({
  settings,
  columna,
  primaryColor,
  variant = 'inline',
  envoltorio,
}: {
  settings: Record<string, unknown> | null | undefined
  columna: ColumnaUbicacionContador
  primaryColor: string
  variant?: 'banner' | 'inline' | 'full'
  /** Clase de un `<div>` alrededor (el pago lo envuelve en `mb-6`, como antes). */
  envoltorio?: string
}) {
  const vivos = useAjustesVivosPreview()
  const efectivos = vivos ? { ...(settings ?? {}), ...vivos.ajustes } : settings
  if (!contadorEn(efectivos, columna)) return null
  const banner = <CountdownBanner config={efectivos as never} primaryColor={primaryColor} variant={variant} />
  return envoltorio ? <div className={envoltorio}>{banner}</div> : banner
}
