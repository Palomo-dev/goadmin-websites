/**
 * Ícono de la tienda con «Estilo de los íconos» (Figma «16 Sitio web» 2852:70951, propuesta 8,
 * aprobada 2026-11-23). UN solo punto para la cabecera (acciones, lupa de todos los buscadores) y
 * el menú inferior.
 *
 * La tienda pasa los íconos como componentes de Lucide (`icon={CartIconComp}`) y los pinta con
 * sus clases y su trazo. `conGlifo` devuelve un componente con la MISMA forma:
 * - Sin nada nuevo (sin dibujo del catálogo y sin estilo) devuelve el componente de Lucide tal
 *   cual: mismo componente, mismo HTML que hoy.
 * - Con un dibujo del catálogo nuevo (o Relleno/Duotono sobre un nombre de Lucide con equivalente)
 *   pinta Phosphor con `<use>` a `/api/iconos/<peso>/<Nombre>.svg#g` (solo se descarga ese ícono).
 * - Con un peso sobre un nombre de Lucide sin equivalente, el de hoy con otro trazo.
 * - Tamaño, sombra y fondo (círculo o cuadrado, con color) se aplican encima.
 *
 * Sin hooks: sirve en componentes de servidor y de cliente.
 */
import { forwardRef, type CSSProperties, type ForwardedRef, type ReactElement } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { dibujoGlifo, radioFondoGlifo, rutaGlifo, sombraGlifo, type EstiloGlifos, type RefGlifo } from '@/lib/website/v2/glifosTienda'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

export interface OpcionesGlifo {
  /** Dibujo del catálogo nuevo. */
  glifo?: RefGlifo | null
  /** Nombre de Lucide guardado (para su equivalente en Relleno y Duotono). */
  nombre?: string | null
  estilo?: EstiloGlifos | null
  /** Color propio del ícono (menú inferior: activo o inactivo de «Estilo de los íconos»). */
  color?: string | null
  /** Fondo cuando el estilo no trae color propio (menú inferior: el botón activo, color de la marca). */
  fondo?: string | null
}

/** ¿Hay algo nuevo que pintar? Sin esto, el componente de Lucide de siempre. */
export function glifoConCambios(op: OpcionesGlifo): boolean {
  return Boolean(op.glifo || op.estilo || op.color)
}

const cache = new WeakMap<LucideIcon, Map<string, LucideIcon>>()

/**
 * Componente con la forma de un ícono de Lucide que pinta el dibujo y el estilo elegidos.
 * Estable entre renders (misma entrada, mismo componente) para no remontar el ícono.
 */
export function conGlifo(base: LucideIcon, op: OpcionesGlifo): LucideIcon {
  if (!glifoConCambios(op)) return base
  const clave = JSON.stringify([op.glifo ?? null, op.nombre ?? null, op.estilo ?? null, op.color ?? null, op.fondo ?? null])
  let porBase = cache.get(base)
  if (!porBase) {
    porBase = new Map()
    cache.set(base, porBase)
  }
  const guardado = porBase.get(clave)
  if (guardado) return guardado
  const Comp = forwardRef<SVGSVGElement, LucideProps>(function GlifoTienda(props, ref) {
    return pintarGlifo(base, op, props, ref)
  }) as unknown as LucideIcon
  ;(Comp as { displayName?: string }).displayName = 'GlifoTienda'
  porBase.set(clave, Comp)
  return Comp
}

/** Props del trazo que no aplican a un dibujo relleno (Phosphor) o que pisa el peso elegido. */
const TRAZO_CSS = ['fill', 'fillOpacity', 'stroke', 'strokeWidth'] as const

function sinTrazo(style: CSSProperties | undefined): CSSProperties | undefined {
  if (!style) return style
  const copia: CSSProperties = { ...style }
  for (const k of TRAZO_CSS) delete copia[k]
  return copia
}

function pintarGlifo(Base: LucideIcon, op: OpcionesGlifo, props: LucideProps, ref: ForwardedRef<SVGSVGElement>): ReactElement {
  const estilo = op.estilo ?? null
  const dibujo = dibujoGlifo(op.glifo, op.nombre, estilo)
  const fondo = estilo?.bg ?? null
  // Fondo con color (el suyo o el del activo): el ícono toma el color que contrasta con él.
  const colorFondo = fondo ? (fondo.color ?? op.fondo ?? null) : null
  const sombra = sombraGlifo(estilo, Boolean(fondo))
  const { size, strokeWidth, fill, style, className, ...resto } = props
  const medidas: CSSProperties = estilo?.size ? { width: estilo.size, height: estilo.size } : {}
  const extra: CSSProperties = {
    ...medidas,
    ...(op.color && !colorFondo ? { color: op.color } : {}),
    // `color` de Lucide pinta el trazo; en Phosphor el dibujo toma el color del texto.
    ...(dibujo.tipo === 'phosphor' && resto.color && !op.color && !colorFondo ? { color: resto.color } : {}),
    ...(sombra && !fondo ? { filter: sombra } : {}),
  }
  let svg: ReactElement
  if (dibujo.tipo === 'phosphor') {
    const lado = size ?? 24
    svg = (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={lado}
        height={lado}
        viewBox="0 0 256 256"
        fill="currentColor"
        className={className}
        style={{ ...sinTrazo(style), ...extra }}
        aria-hidden={resto['aria-hidden'] ?? true}
        {...(resto.id ? { id: resto.id } : {})}
        data-glifo={dibujo.name}
        {...(resto['aria-label'] ? { 'aria-label': resto['aria-label'], role: 'img' } : {})}
      >
        <use href={`${rutaGlifo(dibujo.name, dibujo.weight)}#g`} />
      </svg>
    )
  } else {
    const t = dibujo.trazo
    svg = (
      <Base
        ref={ref}
        {...resto}
        {...(size !== undefined ? { size } : {})}
        className={className}
        strokeWidth={t?.strokeWidth ?? strokeWidth}
        // Con un peso elegido manda el del estilo (también sobre el relleno de antes).
        fill={t ? (t.fill ?? 'none') : fill}
        {...(t?.fillOpacity !== undefined ? { fillOpacity: t.fillOpacity } : {})}
        style={t ? { ...sinTrazo(style), ...extra } : { ...style, ...extra }}
      />
    )
  }
  if (!fondo) return svg
  const caja: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 6,
    lineHeight: 0,
    borderRadius: radioFondoGlifo(fondo.shape),
    backgroundColor: colorFondo ?? 'color-mix(in srgb, currentColor 12%, transparent)',
    ...(colorFondo ? { color: textoSobreAcentoSiHex(colorFondo) || '#FFFFFF' } : {}),
    ...(sombra ? { boxShadow: sombra } : {}),
  }
  return (
    <span data-glifo-fondo={fondo.shape} style={caja}>
      {svg}
    </span>
  )
}
