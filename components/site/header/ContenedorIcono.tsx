'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  colorDeToken,
  contenedorDe,
  radioForma,
  sombraCaja,
  type ContenedorIconos,
  type OBJETIVOS_ICONO,
} from '@/lib/website/constructorEncabezado'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

export type ColoresCaja = { primary: string; accent: string; secondary: string }
type ClaveIcono = (typeof OBJETIVOS_ICONO)[number]

/**
 * Caja del ícono. Solo se monta cuando `icon_container` trae una forma:
 * sin eso, moneda, carrito y cuenta siguen en `IconoConCirculo`.
 */
export function ContenedorIcono({
  base,
  clave,
  colores,
  children,
}: {
  base: ContenedorIconos
  clave: ClaveIcono
  colores: ColoresCaja
  children: ReactNode
}) {
  const c = contenedorDe(base, clave)
  const [estado, setEstado] = useState<'reposo' | 'hover' | 'activo'>('reposo')
  const fondo = fondoDe(c, colores)
  const hoverFondo = colorDeToken(c.hoverBackground, colores)
  const fondoVisible = estado !== 'reposo' && hoverFondo ? hoverFondo : fondo
  const icono = colorIcono(c, colores, fondoVisible)
  const hoverIcono = colorDeToken(c.hoverColor, colores)
  const activo = colorDeToken(c.activeColor, colores)
  const color = estado === 'activo' && activo ? activo : estado === 'hover' && hoverIcono ? hoverIcono : icono
  const sombra = sombraCaja(
    estado !== 'reposo' && c.hoverShadow ? c.hoverShadow : c.shadow,
    colorDeToken(c.shadowColor, colores),
  )
  const escala = estado !== 'reposo' && c.hoverScale ? c.hoverScale / 100 : 1
  const opacidad = c.opacity != null && c.opacity < 100 ? c.opacity / 100 : 1
  const conCapa = opacidad < 1 && !!fondoVisible && fondoVisible !== 'transparent'
  const caja = c.shape !== 'none'
  const medida = c.box ?? (caja ? (c.icon ?? 24) + (c.padding ?? 0) * 2 : undefined)
  const estilo: CSSProperties = {
    color,
    width: medida,
    height: medida,
    padding: caja && c.box == null ? c.padding : undefined,
    borderRadius: caja ? radioForma(c.shape, c.radius) : undefined,
    background: caja && !conCapa ? fondoVisible : undefined,
    border: caja && c.borderWidth ? `${c.borderWidth}px ${c.borderStyle || 'solid'} ${colorDeToken(c.borderColor, colores) || 'currentColor'}` : undefined,
    boxShadow: caja && sombra !== 'none' ? sombra : undefined,
    transform: escala !== 1 ? `scale(${escala})` : undefined,
    boxSizing: 'border-box',
  }
  return (
    <span
      className="relative inline-flex items-center justify-center transition-transform"
      style={estilo}
      data-contenedor-icono={c.shape}
      onMouseEnter={() => setEstado('hover')}
      onMouseLeave={() => setEstado('reposo')}
      onMouseDown={() => setEstado('activo')}
      onMouseUp={() => setEstado('hover')}
    >
      {conCapa && (
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ background: fondoVisible, opacity: opacidad, borderRadius: estilo.borderRadius }}
        />
      )}
      <span className="relative inline-flex">{children}</span>
    </span>
  )
}

export function trazoContenedor(base: ContenedorIconos, clave: ClaveIcono, relleno = false): CSSProperties {
  const c = contenedorDe(base, clave)
  const peso = c.weight ?? (relleno ? 'relleno' : 'contorno')
  const stroke = c.stroke ?? (peso === 'relleno' ? 1.25 : 2)
  return {
    width: c.icon ?? 24,
    height: c.icon ?? 24,
    strokeWidth: stroke,
    fill: peso === 'contorno' ? 'none' : 'currentColor',
    fillOpacity: peso === 'duotono' ? 0.28 : peso === 'relleno' ? 1 : undefined,
  }
}

function fondoDe(c: ContenedorIconos, colores: ColoresCaja): string | undefined {
  if (c.shape === 'none') return undefined
  if (c.gradient1 && c.gradient2) {
    return `linear-gradient(${c.angle ?? 135}deg, ${c.gradient1}, ${c.gradient2})`
  }
  return colorDeToken(c.background, colores)
}

function colorIcono(c: ContenedorIconos, colores: ColoresCaja, fondo: string | undefined): string | undefined {
  const propio = colorDeToken(c.iconColor, colores)
  if (propio && propio !== 'transparent') return propio
  if (!fondo || fondo === 'transparent' || fondo.startsWith('linear-gradient') || c.shape === 'none') {
    return c.gradient1 ? textoSobreAcentoSiHex(c.gradient1) || undefined : undefined
  }
  return textoSobreAcentoSiHex(fondo) || undefined
}
