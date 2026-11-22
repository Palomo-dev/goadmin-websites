'use client'

/**
 * Ícono de cabecera con los estilos nuevos (Figma «16 Sitio web» 2747:58381, aprobado 2026-11-22):
 * «Con texto» (debajo o al lado), «Píldora con borde» y «Botón relleno», con el contador del
 * carrito (número, punto u oculto). «Solo ícono» y «Círculo» siguen pintándose como hoy
 * (IconoConCirculo / ContenedorIcono): este componente solo se monta cuando el sitio eligió un
 * estilo nuevo (`header_iconos`, lib/website/v2/cabeceraTienda.ts).
 *
 * Solo presentación: el botón o enlace que lo envuelve lo pone quien lo usa.
 */
import type { CSSProperties, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import CO from 'country-flag-icons/react/3x2/CO'
import US from 'country-flag-icons/react/3x2/US'
import EU from 'country-flag-icons/react/3x2/EU'
import MX from 'country-flag-icons/react/3x2/MX'
import PE from 'country-flag-icons/react/3x2/PE'
import BR from 'country-flag-icons/react/3x2/BR'
import CL from 'country-flag-icons/react/3x2/CL'
import AR from 'country-flag-icons/react/3x2/AR'
import CA from 'country-flag-icons/react/3x2/CA'
import GB from 'country-flag-icons/react/3x2/GB'
import JP from 'country-flag-icons/react/3x2/JP'
import AU from 'country-flag-icons/react/3x2/AU'
import {
  ANCHO_TRAZO_ICONO,
  PX_TAMANO_ICONO,
  contadorCarrito,
  datosMoneda,
  posicionTextoIcono,
  type ContadorCarrito,
  type EstiloIconos,
  type OpcionesIconos,
} from '@/lib/website/v2/cabeceraTienda'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

/** Lo que necesita un ícono para pintarse con las opciones nuevas. */
export interface PresentacionIcono {
  estilo: EstiloIconos
  /** Texto visible (ya resuelto); `null` = sin texto. */
  texto: string | null
  /** Glifo en px; `null` = el de hoy. */
  px: number | null
  /** Grosor del trazo; `null` = el de hoy. */
  trazo: number | null
  contador: ContadorCarrito
}

/**
 * Presentación de un ícono en el computador o en el celular. En el celular solo «Con texto» lleva
 * texto (debajo, como el Figma 2752:59411); píldora, relleno y al lado quedan en solo ícono para
 * que la barra quepa en 390 px.
 */
export function presentacionIcono(op: OpcionesIconos, texto: string | null, movil: boolean, heredado: 'icono' | 'circulo'): PresentacionIcono {
  const estilo: EstiloIconos = movil && op.estilo !== 'texto' && op.estilo !== 'icono' && op.estilo !== 'circulo' ? heredado : op.estilo
  const conTexto = op.mostrarTexto && (estilo === 'texto' || estilo === 'texto_lado' || estilo === 'pildora' || estilo === 'relleno')
  return {
    estilo,
    texto: conTexto && texto ? texto : null,
    px: op.tamano ? PX_TAMANO_ICONO[op.tamano] : movil && estilo === 'texto' ? PX_TAMANO_ICONO.s : null,
    trazo: op.trazo ? ANCHO_TRAZO_ICONO[op.trazo] : null,
    contador: op.contador,
  }
}

/** `true` si el estilo lo pinta este componente (no el camino de hoy). */
export function estiloPropio(estilo: EstiloIconos): boolean {
  return estilo === 'texto' || estilo === 'texto_lado' || estilo === 'pildora' || estilo === 'relleno'
}

/** Medidas del glifo: el tamaño y el trazo elegidos pisan los de hoy (y los de la caja). */
export function estiloGlifo(p: Pick<PresentacionIcono, 'px' | 'trazo'>, base?: CSSProperties): CSSProperties {
  return {
    ...(base ?? {}),
    ...(p.px ? { width: p.px, height: p.px } : {}),
    ...(p.trazo ? { strokeWidth: p.trazo } : {}),
  }
}

/** Contador del carrito: número (con «99+»), punto o nada. */
export function InsigniaContador({
  cantidad,
  contador,
  color,
  className = '-top-1 -right-1',
  claseNumero,
}: {
  cantidad: number
  contador: ContadorCarrito
  color: string
  className?: string
  /** Forma del número cuando la caja de íconos la fija (`badgeShape`). */
  claseNumero?: string
}) {
  const c = contadorCarrito(cantidad, contador)
  if (!c) return null
  if (c.tipo === 'punto') {
    return <span aria-hidden="true" data-contador="punto" className={`absolute ${className} h-2.5 w-2.5 rounded-full ring-2 ring-white`} style={{ backgroundColor: color }} />
  }
  return (
    <span
      data-contador="numero"
      className={`absolute ${className} ${claseNumero ?? 'h-5 min-w-5 rounded-full px-1'} flex items-center justify-center text-xs font-bold`}
      style={{ backgroundColor: color, color: textoSobreAcentoSiHex(color) || '#FFFFFF' }}
    >
      {c.texto}
    </span>
  )
}

/**
 * Marco del ícono con el estilo nuevo. `insignia` va en la esquina del ícono («Con texto») o de la
 * píldora / el botón (Figma A). `flecha` para los que abren un menú (moneda).
 */
export function AccionCabecera({
  estilo,
  texto,
  icono,
  insignia,
  flecha,
  abierta,
  primaryColor,
}: {
  estilo: EstiloIconos
  texto: string | null
  icono: ReactNode
  insignia?: ReactNode
  flecha?: boolean
  abierta?: boolean
  primaryColor: string
}) {
  const chevron = flecha ? <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${abierta ? 'rotate-180' : ''}`} /> : null
  const posicion = posicionTextoIcono(estilo)
  if (posicion === 'debajo') {
    return (
      <span className="relative inline-flex flex-col items-center gap-0.5" data-estilo-icono={estilo}>
        <span className="relative inline-flex">
          {icono}
          {insignia}
        </span>
        {(texto || chevron) && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium leading-none">
            {texto}
            {chevron}
          </span>
        )}
      </span>
    )
  }
  const marco =
    estilo === 'pildora'
      ? 'h-9 rounded-full border px-3'
      : estilo === 'relleno'
        ? 'h-9 rounded-lg px-3'
        : ''
  const estiloMarco: CSSProperties =
    estilo === 'pildora'
      ? { borderColor: 'color-mix(in srgb, currentColor 45%, transparent)' }
      : estilo === 'relleno'
        ? { backgroundColor: primaryColor, color: textoSobreAcentoSiHex(primaryColor) || '#FFFFFF' }
        : {}
  return (
    <span className={`relative inline-flex items-center gap-1.5 text-sm font-medium ${marco}`} style={estiloMarco} data-estilo-icono={estilo}>
      {icono}
      {texto && <span className="whitespace-nowrap">{texto}</span>}
      {chevron}
      {insignia}
    </span>
  )
}

/**
 * Color del texto en los estilos nuevos: el de la clase del ícono del celular
 * (`text-[var(--hdr-mobile-icon)]`), el heredado de la barra o el gris de hoy.
 */
export function claseColorIcono(claseIcono: string | undefined, heredarColor: boolean): string {
  const propia = (claseIcono ?? '').split(/\s+/).filter((c) => c.startsWith('text-') || c.startsWith('dark:text-')).join(' ')
  if (propia) return propia
  return heredarColor ? 'text-current' : 'text-gray-700 dark:text-gray-300'
}

/** Clases del botón o enlace que envuelve el ícono: sin el `p-2` de hoy en píldora y relleno. */
export function claseEnvoltorio(estilo: EstiloIconos): string {
  if (estilo === 'pildora' || estilo === 'relleno') return 'relative inline-flex items-center rounded-full transition-opacity hover:opacity-90'
  if (estilo === 'texto' || estilo === 'texto_lado') return 'relative inline-flex items-center rounded-lg px-1.5 py-1 transition-colors hover:bg-[var(--header-hover)]'
  return 'relative p-2 rounded-full hover:bg-[var(--header-hover)] transition-colors'
}

const BANDERAS: Readonly<Record<string, (p: { className?: string; title?: string }) => JSX.Element>> = {
  CO, US, EU, MX, PE, BR, CL, AR, CA, GB, JP, AU,
}

/** Bandera de la moneda (21×14). Sin bandera conocida, el código en una cajita. */
export function BanderaMoneda({ codigo, className = '' }: { codigo: string; className?: string }) {
  const iso = datosMoneda(codigo).bandera
  const Svg = iso ? BANDERAS[iso] : undefined
  const base = `inline-block h-3.5 w-[21px] shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 ${className}`
  if (!Svg) {
    return (
      <span aria-hidden="true" className={`${base} bg-gray-100 text-center text-[8px] font-semibold leading-[14px] text-gray-500`}>
        {codigo.slice(0, 3)}
      </span>
    )
  }
  return (
    <span aria-hidden="true" className={base}>
      <Svg className="block h-full w-full" />
    </span>
  )
}
