import type { ReactNode } from 'react'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

/** Trazo de Lucide: el relleno no apaga el borde, si no el icono desaparece. */
export function propsTrazoIcono(relleno: boolean): { fill: 'currentColor' | 'none'; strokeWidth: number } {
  return relleno ? { fill: 'currentColor', strokeWidth: 1.25 } : { fill: 'none', strokeWidth: 2 }
}

/** Círculo del color de la marca. Sin círculo, el icono se pinta igual que antes. */
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
      style={{ backgroundColor: primaryColor, color: textoSobreAcentoSiHex(primaryColor) || '#FFFFFF' }}
    >
      {children}
    </span>
  )
}
