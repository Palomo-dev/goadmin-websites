import type { ReactNode } from 'react'
import { iconoSobreFondo } from '@/lib/website/colorCirculoIconos'

/** Trazo de Lucide: el relleno no apaga el borde, si no el icono desaparece. */
export function propsTrazoIcono(relleno: boolean): { fill: 'currentColor' | 'none'; strokeWidth: number } {
  return relleno ? { fill: 'currentColor', strokeWidth: 1.25 } : { fill: 'none', strokeWidth: 2 }
}

/**
 * Círculo del color de la marca. Sin círculo, el icono se pinta igual que antes.
 * Fondo y color del ícono salen de `--hdr-circle-bg` / `--hdr-circle-fg` (los pone
 * `variablesEncabezado` solo si el sitio los guardó); sin ellos, la marca y su contraste.
 */
export function IconoConCirculo({
  circulo,
  primaryColor,
  tamano = 'md',
  children,
}: {
  circulo: boolean
  primaryColor: string
  tamano?: 'sm' | 'md'
  children: ReactNode
}) {
  if (!circulo) return <>{children}</>
  const caja = tamano === 'sm' ? 'h-7 w-7' : 'h-9 w-9'
  return (
    <span
      className={`inline-flex ${caja} items-center justify-center rounded-full`}
      style={{ backgroundColor: `var(--hdr-circle-bg, ${primaryColor})`, color: `var(--hdr-circle-fg, ${iconoSobreFondo(primaryColor)})` }}
    >
      {children}
    </span>
  )
}
