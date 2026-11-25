'use client'

/**
 * Botón ← cuadrado de la tienda (Figma 2983:72604, «Tienda/Botón atrás»): 36 px en escritorio,
 * con el color de la tienda (fondo tenue y flecha del color principal, legible sobre la página
 * clara u oscura). Vuelve a donde venía el cliente o a la página «madre» (useDestinoVolver).
 * `aria-label` con el destino real: «Volver a Neveras».
 */
import Link from '@/components/site/Enlace'
import { ChevronLeft } from 'lucide-react'
import type { CSSProperties } from 'react'
import { coloresBotonVolver } from '@/lib/navegacion/coloresVolver'
import { textoVolver } from '@/lib/navegacion/volver'
import { useDestinoVolver, type OpcionesVolver } from './useDestinoVolver'

export interface BotonVolverProps extends OpcionesVolver {
  primaryColor?: string | null
  /** Con texto «Volver a …» al lado (páginas sin título, p. ej. el pago con Bold). */
  conTexto?: boolean
  /** 32 px en el celular y 36 px desde md (encabezado de la ficha en el celular). */
  compacto?: boolean
  /** Sobre una cabecera oscura (la del checkout): usa siempre la variante oscura del botón. */
  sobreFondoOscuro?: boolean
  className?: string
}

/** Variables y clases del botón con el color de la tienda; sin color válido, el «Neutro». */
export function estiloBotonVolver(primaryColor: string | null | undefined, sobreFondoOscuro = false): { clase: string; estilo?: CSSProperties } {
  // Sobre una cabecera oscura (la del checkout, el dueño 2026-11-25): sutil, con el mismo fondo de
  // la cabecera, un borde gris muy delgado y la flecha del color del texto de la cabecera.
  if (sobreFondoOscuro) {
    return { clase: 'border border-white/20 bg-transparent text-current hover:border-white/45' }
  }
  const c = coloresBotonVolver(primaryColor)
  if (!c) {
    return {
      clase: 'border border-slate-200 bg-white text-slate-900 hover:border-slate-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white',
    }
  }
  return {
    clase:
      'border border-transparent bg-[var(--volver-fondo)] text-[var(--volver-flecha)] hover:border-[var(--volver-borde)] dark:bg-[var(--volver-fondo-oscuro)] dark:text-[var(--volver-flecha-oscura)]',
    estilo: {
      ['--volver-fondo' as string]: c.fondo,
      ['--volver-flecha' as string]: c.flecha,
      ['--volver-fondo-oscuro' as string]: c.fondoOscuro,
      ['--volver-flecha-oscura' as string]: c.flechaOscura,
      ['--volver-borde' as string]: c.borde,
    },
  }
}

export function BotonVolver({ padre, preferirUltimaCategoria, primaryColor, conTexto = false, compacto = false, sobreFondoOscuro = false, className = '' }: BotonVolverProps) {
  const { href, etiqueta, alPulsar } = useDestinoVolver({ padre, preferirUltimaCategoria })
  const { clase, estilo } = estiloBotonVolver(primaryColor, sobreFondoOscuro)
  const texto = textoVolver(etiqueta)
  const boton = (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg transition-colors ${compacto ? 'h-8 w-8 md:h-9 md:w-9' : 'h-9 w-9'} ${clase}`}
      style={estilo}
      aria-hidden={conTexto ? true : undefined}
    >
      <ChevronLeft className={compacto ? 'h-4 w-4 md:h-5 md:w-5' : 'h-5 w-5'} strokeWidth={1.75} aria-hidden="true" />
    </span>
  )
  if (conTexto) {
    return (
      <Link href={href} onClick={alPulsar} className={`group inline-flex items-center gap-2.5 text-sm font-medium text-slate-700 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white ${className}`} data-boton-volver="">
        {boton}
        <span>{texto}</span>
      </Link>
    )
  }
  return (
    <Link href={href} onClick={alPulsar} aria-label={texto} title={texto} className={`inline-flex shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`} data-boton-volver="">
      {boton}
    </Link>
  )
}
