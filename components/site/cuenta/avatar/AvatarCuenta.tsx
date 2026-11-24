/**
 * Avatar de cuenta (Figma «16 Sitio web» componente 3044:78791): iniciales en el color de la
 * tienda; si el color es muy claro, iniciales en #0F172A (el mismo cálculo de contraste del botón
 * principal, `textoSobreAcentoSiHex`). Punto verde con borde blanco si hay un pedido en curso y
 * aro blanco translúcido de 2 px mientras su menú está abierto. Sin foto (no hay dónde guardarla).
 *
 * Sirve en servidor y navegador (sin estado).
 */
import type { CSSProperties } from 'react'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

export function colorIniciales(fondo: string | null | undefined): string {
  return textoSobreAcentoSiHex(fondo) === '#111111' ? '#0F172A' : '#FFFFFF'
}

export interface AvatarCuentaProps {
  iniciales: string
  /** Color de la tienda; sin él, `var(--primary-color)` con iniciales blancas. */
  primaryColor?: string | null
  /** Lado en px (32 en la cabecera, 40 en el menú, 56 en Mi cuenta). */
  tam?: number
  /** Punto verde: hay un pedido en curso. */
  enCurso?: boolean
  /** Aro translúcido: el menú está abierto. */
  abierto?: boolean
  className?: string
}

export function AvatarCuenta({ iniciales, primaryColor, tam = 32, enCurso = false, abierto = false, className = '' }: AvatarCuentaProps) {
  const fondo = primaryColor || 'var(--primary-color)'
  const estilo: CSSProperties = {
    width: tam,
    height: tam,
    backgroundColor: fondo,
    color: primaryColor ? colorIniciales(primaryColor) : '#FFFFFF',
    fontSize: Math.round(tam * (iniciales.length > 1 ? 0.36 : 0.42)),
    ...(abierto ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.6)' } : {}),
  }
  const punto = Math.max(8, Math.round(tam * 0.3))
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} data-avatar-cuenta="" aria-hidden="true">
      <span className="flex items-center justify-center rounded-full font-semibold leading-none" style={estilo}>
        {iniciales}
      </span>
      {enCurso && (
        <span
          className="absolute rounded-full border-2 border-white"
          style={{ width: punto, height: punto, top: -1, right: -1, backgroundColor: '#22C55E' }}
          data-avatar-en-curso=""
        />
      )}
    </span>
  )
}
