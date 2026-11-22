'use client'

import { useState, useRef, useEffect, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Check, ChevronDown, Globe, type LucideIcon } from 'lucide-react'
import { useCurrency } from './CurrencyProvider'
import { IconoConCirculo, propsTrazoIcono } from './header/IconoEncabezado'
import { ContenedorIcono, trazoContenedor, type ColoresCaja } from './header/ContenedorIcono'
import type { ContenedorIconos } from '@/lib/website/constructorEncabezado'
import { ordenarMonedas } from '@/lib/site/ordenMonedas'
import { datosMoneda, monedasVisibles, segmentoMonedas, type OpcionesMoneda } from '@/lib/website/v2/cabeceraTienda'
import { AccionCabecera, BanderaMoneda, claseColorIcono, claseEnvoltorio, estiloGlifo, estiloPropio, type PresentacionIcono } from './header/AccionCabecera'

/**
 * Color de la opción elegida: el primario del sitio (OrganizationLayoutCliente), no `primaryColor`,
 * que en HeaderPorZonas es el color del ícono y puede ser blanco sobre un encabezado oscuro.
 */
const COLOR_MARCA = 'var(--primary-color, #111827)'

export interface CurrencySelectorProps {
  primaryColor?: string
  icon?: LucideIcon
  compactClassName?: string
  heredarColor?: boolean
  relleno?: boolean
  circulo?: boolean
  contenedor?: ContenedorIconos | null
  colores?: ColoresCaja
  /**
   * Selector de moneda de la cabecera nueva (`header_moneda`, Figma 2749:58324): estilo, flecha y
   * monedas visibles. Sin estilo, el selector de hoy (solo se filtran las monedas si se eligieron).
   */
  opciones?: OpcionesMoneda | null
  /** Estilo de los íconos (`header_iconos`) cuando el selector no tiene estilo propio. */
  presentacion?: PresentacionIcono | null
}

export function CurrencySelector({ primaryColor, icon: Icon = Globe, compactClassName = '', heredarColor = false, relleno = false, circulo = false, contenedor = null, colores, opciones = null, presentacion = null }: CurrencySelectorProps) {
  const { currency, baseCurrency, availableCurrencies, setCurrency, loading } = useCurrency()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', tecla)
    }
  }, [])

  // Mostrar siempre si hay monedas disponibles, incluso si solo hay 1
  if (loading) return null
  if (availableCurrencies.length === 0) return null

  // Monedas que ve el cliente: todas (hoy) o las marcadas en el editor, con la base primero.
  const lista = opciones?.visibles ? monedasVisibles(availableCurrencies, opciones.visibles, baseCurrency) : ordenarMonedas(availableCurrencies, baseCurrency)
  const elegir = (code: string) => {
    setCurrency(code)
    setOpen(false)
  }

  // ── Cabecera nueva: estilo propio del selector (Figma B) ────────────────────────────────────
  if (opciones?.estilo) {
    return (
      <SelectorConEstilo
        refContenedor={ref}
        opciones={opciones}
        lista={lista}
        actual={currency}
        base={baseCurrency}
        abierto={open}
        onAbrir={() => setOpen(!open)}
        onElegir={elegir}
        Icon={Icon}
        claseColor={heredarColor ? 'text-current' : 'text-gray-700 dark:text-gray-300'}
      />
    )
  }

  // ── Estilo nuevo de los íconos (con texto, píldora, relleno): globo + código ──────────────
  if (presentacion && estiloPropio(presentacion.estilo)) {
    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`${claseEnvoltorio(presentacion.estilo)}${presentacion.estilo === 'relleno' ? '' : ` ${claseColorIcono(undefined, heredarColor)}`}`}
          aria-label="Seleccionar moneda"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <AccionCabecera
            estilo={presentacion.estilo}
            texto={presentacion.texto}
            primaryColor={primaryColor || '#111827'}
            icono={<Icon className="shrink-0 text-current" {...propsTrazoIcono(relleno)} style={estiloGlifo(presentacion, presentacion.px ? undefined : { width: 20, height: 20 })} />}
            flecha={opciones?.flecha !== false}
            abierta={open}
          />
        </button>
        {open && <MenuMonedasHoy lista={lista} actual={currency} onElegir={elegir} compacto={false} />}
      </div>
    )
  }

  // compactClassName sobreescribe las clases base del botón e iconos
  const hasCompact = compactClassName !== ''
  const glifo = presentacion ? estiloGlifo(presentacion) : undefined

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md hover:bg-[var(--header-hover)] transition-colors ${heredarColor ? 'text-current' : 'text-gray-600 dark:text-gray-300'} ${hasCompact ? compactClassName : 'px-2 py-1.5 text-sm'}`}
        aria-label="Seleccionar moneda"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {contenedor ? (
          <ContenedorIcono base={contenedor} clave="currency" colores={colores || { primary: primaryColor || '#111827', accent: primaryColor || '#111827', secondary: primaryColor || '#111827' }}>
            <Icon style={presentacion ? estiloGlifo(presentacion, trazoContenedor(contenedor, 'currency', relleno)) : trazoContenedor(contenedor, 'currency', relleno)} />
          </ContenedorIcono>
        ) : (
          <IconoConCirculo circulo={circulo} primaryColor={primaryColor || '#111827'} tamano={hasCompact ? 'sm' : 'md'}>
            <Icon className={hasCompact ? 'h-3 w-3 md:h-4 md:w-4' : 'h-4 w-4'} {...propsTrazoIcono(relleno)} style={glifo} />
          </IconoConCirculo>
        )}
        <span className="font-medium">{currency}</span>
        {opciones?.flecha !== false && <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''} ${hasCompact ? 'h-2.5 w-2.5 md:h-3 md:w-3' : 'h-3 w-3'}`} />}
      </button>

      {open && <MenuMonedasHoy lista={lista} actual={currency} onElegir={elegir} compacto={hasCompact} />}
    </div>
  )
}

/**
 * Menú de hoy: código y país. Panel siempre blanco y con colores propios: no hereda el texto claro
 * de un encabezado oscuro (las opciones salían invisibles) ni pasa a oscuro con la clase `dark`.
 */
function MenuMonedasHoy({ lista, actual, onElegir, compacto }: { lista: { code: string; country: string }[]; actual: string; onElegir: (code: string) => void; compacto: boolean }) {
  return (
    <div
      role="listbox"
      aria-label="Moneda"
      className={`absolute right-0 top-full mt-1 ${compacto ? 'w-44 md:w-56' : 'w-56'} max-h-[320px] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white py-1 text-left text-[#111827] shadow-xl z-[1000] [scrollbar-width:thin] [scrollbar-color:#D1D5DB_transparent]`}
    >
      {lista.map((c) => {
        const elegida = c.code === actual
        return (
          <button
            key={c.code}
            type="button"
            role="option"
            aria-selected={elegida}
            onClick={() => onElegir(c.code)}
            className="flex h-10 w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
            style={elegida ? { backgroundColor: `color-mix(in srgb, ${COLOR_MARCA} 10%, white)` } : undefined}
          >
            <span className="w-10 shrink-0 font-semibold" style={{ color: elegida ? COLOR_MARCA : '#111827' }}>{c.code}</span>
            <span className="min-w-0 flex-1 truncate text-xs" style={{ color: '#4B5563' }}>{c.country}</span>
            {elegida && <Check aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: COLOR_MARCA }} />}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Menú de monedas de la cabecera nueva (Figma 2748:95713): «MONEDA», bandera, código y nombre,
 * la actual marcada y la nota de conversión. Lo usan el selector del computador y la hoja del celular.
 */
export function ListaMonedas({ lista, actual, base, onElegir, titulo = 'Moneda', mayusculas = true }: { lista: { code: string; country: string }[]; actual: string; base: string; onElegir: (code: string) => void; titulo?: string | null; mayusculas?: boolean }) {
  return (
    <div className="text-left text-[#111827]">
      {titulo && <p className={`px-3 pb-1 pt-2 text-[11px] font-semibold text-[#6B7280] ${mayusculas ? 'uppercase tracking-wide' : ''}`}>{titulo}</p>}
      <div role="listbox" aria-label="Moneda" className="flex flex-col gap-0.5 px-1">
        {lista.map((c) => {
          const elegida = c.code === actual
          return (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={elegida}
              onClick={() => onElegir(c.code)}
              className="flex h-10 w-full items-center gap-3 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none"
              style={elegida ? { backgroundColor: `color-mix(in srgb, ${COLOR_MARCA} 10%, white)` } : undefined}
            >
              <BanderaMoneda codigo={c.code} />
              <span className="w-10 shrink-0 font-semibold" style={{ color: elegida ? COLOR_MARCA : '#111827' }}>{c.code}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: '#4B5563' }}>{datosMoneda(c.code, c.country).nombre}</span>
              {elegida && <Check aria-hidden="true" className="h-4 w-4 shrink-0" style={{ color: COLOR_MARCA }} />}
            </button>
          )
        })}
      </div>
      <p className="mx-3 mt-1 border-t border-gray-100 pb-2 pt-2 text-[11px] leading-[14px] text-[#6B7280]">
        Los precios se convierten con la tasa del día. Pagas en {base}.
      </p>
    </div>
  )
}

function PanelMenu({ children, ancho = 'w-72' }: { children: ReactNode; ancho?: string }) {
  return (
    <div className={`absolute right-0 top-full z-[1000] mt-2 ${ancho} max-h-[380px] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-xl`}>
      {children}
    </div>
  )
}

function SelectorConEstilo({
  refContenedor,
  opciones,
  lista,
  actual,
  base,
  abierto,
  onAbrir,
  onElegir,
  Icon,
  claseColor,
}: {
  refContenedor: RefObject<HTMLDivElement>
  opciones: OpcionesMoneda
  lista: { code: string; country: string }[]
  actual: string
  base: string
  abierto: boolean
  onAbrir: () => void
  onElegir: (code: string) => void
  Icon: LucideIcon
  claseColor: string
}) {
  const flecha = opciones.flecha ? <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} /> : null
  const hover = 'transition-colors hover:bg-[var(--header-hover)]'
  const borde = { borderColor: 'color-mix(in srgb, currentColor 45%, transparent)' }

  if (opciones.estilo === 'segmento') {
    const { vista, resto } = segmentoMonedas(lista, actual)
    return (
      <div ref={refContenedor} className={`relative ${claseColor}`}>
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' }} role="group" aria-label="Moneda">
          {vista.map((m) => {
            const elegida = m.code === actual
            return (
              <button
                key={m.code}
                type="button"
                aria-pressed={elegida}
                onClick={() => onElegir(m.code)}
                className="h-7 rounded-full px-3 text-xs font-semibold transition-colors"
                style={elegida ? { backgroundColor: '#FFFFFF', color: '#111827' } : undefined}
              >
                {m.code}
              </button>
            )
          })}
          {resto.length > 0 && (
            <button type="button" onClick={onAbrir} aria-haspopup="listbox" aria-expanded={abierto} className="flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold">
              +{resto.length}
              {flecha}
            </button>
          )}
        </div>
        {abierto && resto.length > 0 && (
          <PanelMenu>
            <ListaMonedas lista={resto} actual={actual} base={base} onElegir={onElegir} />
          </PanelMenu>
        )}
      </div>
    )
  }

  let contenido: ReactNode
  let clase = `flex items-center gap-1.5 rounded-full text-sm font-semibold ${hover}`
  let estilo: CSSProperties | undefined
  if (opciones.estilo === 'icono') {
    contenido = (
      <>
        <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        {flecha}
      </>
    )
    clase = `flex h-9 items-center gap-1 rounded-full px-2 ${hover}`
  } else if (opciones.estilo === 'bandera') {
    contenido = (
      <>
        <BanderaMoneda codigo={actual} />
        <span>{actual}</span>
        {flecha}
      </>
    )
    clase = `flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-semibold ${hover}`
    estilo = borde
  } else if (opciones.estilo === 'simbolo') {
    contenido = (
      <>
        <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: COLOR_MARCA, color: '#FFFFFF' }}>
          {datosMoneda(actual).simbolo}
        </span>
        <span>{actual}</span>
        {flecha}
      </>
    )
    clase = `flex h-9 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-sm font-semibold ${hover}`
  } else {
    contenido = (
      <>
        <span>{actual}</span>
        {flecha}
      </>
    )
    clase = `flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-semibold ${hover}`
  }

  return (
    <div ref={refContenedor} className={`relative ${claseColor}`}>
      <button type="button" onClick={onAbrir} className={clase} style={estilo} aria-label={`Moneda: ${actual}`} aria-haspopup="listbox" aria-expanded={abierto} data-estilo-moneda={opciones.estilo}>
        {contenido}
      </button>
      {abierto && (
        <PanelMenu>
          <ListaMonedas lista={lista} actual={actual} base={base} onElegir={onElegir} />
        </PanelMenu>
      )}
    </div>
  )
}
