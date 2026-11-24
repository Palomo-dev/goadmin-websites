'use client'

/**
 * Barra «← Volver a …» del celular (Figma 2992:75028, «Tienda/Barra superior con Volver»): va
 * debajo de la cabecera y queda pegada arriba al bajar (debajo de la cabecera si la cabecera es
 * fija; arriba del todo si la cabecera se esconde o se va con la página). Toda la zona de la
 * flecha y el texto se toca (≥ 40 × 40 px). Con la cabecera fuera de la vista aparecen Buscar y el
 * carrito, que la cabecera ya no muestra.
 *
 * Color: el de la cabecera (`header_bg_color`); la flecha con el color de la tienda cuando se lee
 * sobre ella (coloresBarraVolver). Va directo dentro del `<main>` de la página, fuera de los
 * contenedores con relleno, para ocupar todo el ancho y quedar pegada en toda la página.
 *
 * Además registra el nombre de la página («Neveras») para el ← de la página siguiente.
 */
import Link from 'next/link'
import { ChevronLeft, Search } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { coloresBarraVolver } from '@/lib/navegacion/coloresVolver'
import { textoVolver } from '@/lib/navegacion/volver'
import { CartIndicator } from '@/components/site/CartIndicator'
import { ProductSearch } from '@/components/site/ProductSearch'
import { registrarEtiqueta } from './rastro'
import { useDestinoVolver, type OpcionesVolver } from './useDestinoVolver'

/** Abre el cajón del carrito (lo escucha OrganizationLayoutCliente). */
export const EVENTO_ABRIR_CARRITO = 'go:abrir-carrito'

export interface BarraVolverMovilProps extends OpcionesVolver {
  /** Nombre de esta página para el ← de la siguiente («Neveras», el nombre del producto). */
  etiquetaActual?: string | null
  primaryColor?: string | null
  /** `header_bg_color` del sitio: la barra toma el color de la cabecera. */
  colorCabecera?: string | null
  /** Buscar y carrito al quedar sola arriba. Sin `carrito`, no se pinta el ícono del carrito. */
  acciones?: { buscar?: boolean; carrito?: { subdominio: string; branchId?: number | null } | null } | null
  /** Márgenes para salir del relleno del contenedor (la barra debe ser hija directa de él para quedar pegada). */
  className?: string
}

/** Borde inferior de la cabecera de la tienda en la pantalla (0 si ya no se ve). */
function bordeCabecera(): number {
  const header = document.querySelector<HTMLElement>('[data-raiz-sitio] header') ?? document.querySelector<HTMLElement>('body header')
  if (!header) return 0
  return Math.max(0, Math.round(header.getBoundingClientRect().bottom))
}

export function BarraVolverMovil({ padre, preferirUltimaCategoria, etiquetaActual, primaryColor, colorCabecera, acciones, className = '' }: BarraVolverMovilProps) {
  const { href, etiqueta, alPulsar } = useDestinoVolver({ padre, preferirUltimaCategoria })
  const [arriba, setArriba] = useState(0)
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (etiquetaActual) registrarEtiqueta(window.location.pathname, etiquetaActual)
  }, [etiquetaActual])

  // Pegada justo debajo de la cabecera mientras se vea; arriba del todo cuando se esconde.
  useEffect(() => {
    let marco = 0
    const calcular = () => {
      cancelAnimationFrame(marco)
      marco = requestAnimationFrame(() => setArriba(bordeCabecera()))
    }
    calcular()
    window.addEventListener('scroll', calcular, { passive: true })
    window.addEventListener('resize', calcular)
    // La cabecera «Al bajar» se esconde con una transición: se mide otra vez al terminar.
    document.addEventListener('transitionend', calcular, true)
    return () => {
      cancelAnimationFrame(marco)
      window.removeEventListener('scroll', calcular)
      window.removeEventListener('resize', calcular)
      document.removeEventListener('transitionend', calcular, true)
    }
  }, [])

  const c = coloresBarraVolver(colorCabecera, primaryColor)
  const sola = arriba === 0
  const texto = textoVolver(etiqueta)
  const estiloBarra: CSSProperties = { top: arriba, ...(c.fondo ? { backgroundColor: c.fondo } : {}), ...(c.texto ? { color: c.texto } : {}) }
  const claseFondo = c.fondo
    ? c.tono === 'clara' ? 'border-b border-black/10' : ''
    : 'border-b border-slate-200 bg-white text-slate-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white'
  const caja = c.caja
  const estiloCaja: CSSProperties | undefined = caja
    ? { ['--volver-fondo' as string]: caja.fondo, ['--volver-fondo-oscuro' as string]: caja.fondoOscuro, ['--volver-flecha' as string]: caja.flecha, ['--volver-flecha-oscura' as string]: caja.flechaOscura }
    : c.flecha ? { color: c.flecha } : undefined
  const claseCaja = caja
    ? `bg-[var(--volver-fondo)] text-[var(--volver-flecha)] ${c.fondo ? '' : 'dark:bg-[var(--volver-fondo-oscuro)] dark:text-[var(--volver-flecha-oscura)]'}`
    : ''

  return (
    <div className={`sticky z-30 flex h-14 items-center gap-1.5 pl-2 pr-4 md:hidden ${claseFondo} ${className}`} style={estiloBarra} data-barra-volver="">
      <Link href={href} onClick={alPulsar} aria-label={texto} className="flex min-h-[40px] min-w-0 flex-1 items-center gap-1">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${claseCaja}`} style={estiloCaja} aria-hidden="true">
          <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-col leading-tight" aria-hidden="true">
          <span className={`text-[11px] ${c.textoSecundario ? '' : 'text-slate-500 dark:text-gray-400'}`} style={c.textoSecundario ? { color: c.textoSecundario } : undefined}>
            {etiqueta.trim().toLowerCase() === 'inicio' ? 'Volver al' : 'Volver a'}
          </span>
          <span className="truncate text-base font-semibold">{etiqueta.trim().toLowerCase() === 'inicio' ? 'inicio' : etiqueta}</span>
        </span>
      </Link>
      {sola && acciones && (
        <div className="flex shrink-0 items-center gap-[18px]">
          {acciones.buscar && (
            <button type="button" onClick={() => setBuscando(true)} aria-label="Buscar productos" className="flex h-10 w-10 items-center justify-center">
              <Search className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden="true" />
            </button>
          )}
          {acciones.carrito && (
            <CartIndicator
              primaryColor={primaryColor || '#111827'}
              organizationSubdomain={acciones.carrito.subdominio}
              branchId={acciones.carrito.branchId ?? null}
              heredarColor
              onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_CARRITO))}
            />
          )}
        </div>
      )}
      {buscando && <ProductSearch primaryColor={primaryColor || '#111827'} abierto sinDisparador pantallaCompleta alCerrar={() => setBuscando(false)} />}
    </div>
  )
}
