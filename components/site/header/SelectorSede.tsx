'use client'

/**
 * Selector e indicador de sede (Figma «Header y navegación» 27:214 y «Elegir la sede»
 * del flujo de restaurante): chip «📍 Sede Centro ● ▾» con la lista de sedes, el estado
 * de cada una («Abierto ahora · cierra a las 22:00», «Cierra pronto», «Cerrado · abre…»)
 * y la sede actual marcada.
 *
 * Contrato (paquete de pedido): `sedes` ya trae el `href` base de cada sede calculado en
 * el servidor (dominio propio → `https://<dominio>`; si no, `/<slug>` bajo el sitio
 * principal; la principal sin slug → el sitio principal). No se pinta con menos de 2
 * sedes: hoy (0 sedes publicadas) no aparece en ningún sitio.
 *
 * Cambiar de sede con el carrito lleno: cada sede tiene su carta, sus precios y su
 * carrito (`getCartKey(sub, branchId)`), así que el carrito NO se mueve. Se avisa:
 * «Tu pedido de Sede X se queda guardado» → Cambiar / Vaciar y cambiar / Cancelar.
 *
 * El estado de apertura sale de `useEstadosEnVivo` (el mismo de «Horario y sedes» y del
 * hero): se calcula en el navegador tras montar, en la zona de cada sede, con el horario
 * revisado (el horario por defecto del ERP no muestra estado).
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, MapPin } from 'lucide-react'
import { cn, getCartKey } from '@/lib/utils'
import type { HorarioSemana } from '@/lib/restaurant/horario'
import { OpenStatusBadge, useEstadosEnVivo } from '@/components/sections/restaurant/EstadoApertura'

export interface SedeSelector {
  id: number
  nombre: string
  /** Base de la sede: `https://dominio`, `/<slug>` o `https://marca.goadmin.io/<slug>`; `''` = sitio principal. */
  href: string
  horario: HorarioSemana | null
  zonaHoraria: string
}

export interface SelectorSedeProps {
  sedes: SedeSelector[]
  /** Sede de la página (`outlet.branchId`); null en el sitio principal. */
  actualId: number | null
  /** Subdominio de la organización (clave del carrito). */
  subdomain: string
  primaryColor: string
  /** Prefijo de la sede actual cuando se sirve por ruta (`'/sede-norte'`), para conservar la ruta. */
  prefijoActual?: string
  /** «Ver todas las sedes y horarios» (opcional). */
  hrefTodas?: string | null
  className?: string
  /** `chip` (encabezado) o `enlace` (texto «Cambiar sede», p. ej. en el checkout). */
  apariencia?: 'chip' | 'enlace'
}

/** Rutas que no tienen sentido en otra sede (otro pedido, otro plato): se va a la portada de la sede. */
const RUTAS_SIN_EQUIVALENTE = ['/productos/', '/pedido/', '/checkout/resultado', '/checkout/confirmacion']

function rutaEnOtraSede(base: string, pathname: string, prefijoActual: string): string {
  const sinPrefijo = prefijoActual && (pathname === prefijoActual || pathname.startsWith(`${prefijoActual}/`))
    ? pathname.slice(prefijoActual.length) || '/'
    : pathname
  const ruta = RUTAS_SIN_EQUIVALENTE.some((r) => sinPrefijo.startsWith(r)) ? '/' : sinPrefijo
  if (ruta === '/' || ruta === '') return base || '/'
  return `${base}${ruta}`
}

function unidadesEnCarrito(subdomain: string, branchId: number | null): number {
  try {
    const crudo = window.localStorage.getItem(getCartKey(subdomain, branchId))
    const lista = crudo ? JSON.parse(crudo) : []
    return Array.isArray(lista) ? lista.reduce((n: number, i: { quantity?: unknown }) => n + (Number(i?.quantity) || 0), 0) : 0
  } catch {
    return 0
  }
}

export function SelectorSede({
  sedes,
  actualId,
  subdomain,
  primaryColor,
  prefijoActual = '',
  hrefTodas = null,
  className,
  apariencia = 'chip',
}: SelectorSedeProps) {
  const [abierto, setAbierto] = useState(false)
  const [destino, setDestino] = useState<{ sede: SedeSelector; unidades: number } | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  const idLista = useId()
  const idDialogo = useId()

  // Estable: useEstadosEnVivo recalcula cuando cambia la lista.
  const conHorario = useMemo(
    () => sedes.map((s) => ({ id: s.id, horario: s.horario, zonaHoraria: s.zonaHoraria })),
    [sedes],
  )
  const estados = useEstadosEnVivo(conHorario)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  if (sedes.length < 2) return null

  const actual = sedes.find((s) => s.id === actualId) ?? null
  const estadoActual = actual ? estados?.get(actual.id)?.apertura ?? null : null

  const navegar = (sede: SedeSelector) => {
    window.location.assign(rutaEnOtraSede(sede.href, window.location.pathname, prefijoActual))
  }

  const elegir = (sede: SedeSelector) => {
    setAbierto(false)
    if (sede.id === actualId) return
    const unidades = unidadesEnCarrito(subdomain, actualId)
    if (unidades > 0) {
      setDestino({ sede, unidades })
    } else {
      navegar(sede)
    }
  }

  const vaciarYCambiar = () => {
    if (!destino) return
    try {
      window.localStorage.removeItem(getCartKey(subdomain, actualId))
    } catch {
      /* almacenamiento bloqueado: se cambia igual */
    }
    navegar(destino.sede)
  }

  const puntoActual =
    estadoActual?.estado === 'open' ? 'bg-green-600' : estadoActual?.estado === 'closing_soon' ? 'bg-amber-500' : estadoActual ? 'bg-red-600' : null

  return (
    <div ref={raiz} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={idLista}
        className={cn(
          apariencia === 'chip'
            ? 'inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800'
            : 'inline-flex items-center gap-1 text-sm font-medium underline-offset-2 hover:underline',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
        style={apariencia === 'enlace' ? { color: primaryColor } : { outlineColor: primaryColor }}
      >
        {apariencia === 'chip' ? (
          <>
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: primaryColor }} />
            <span className="max-w-[12rem] truncate">{actual ? actual.nombre : 'Elige tu sede'}</span>
            {puntoActual && (
              <span className={cn('h-2 w-2 shrink-0 rounded-full', puntoActual)} aria-hidden="true" />
            )}
            {estadoActual && <span className="sr-only">{estadoActual.texto}</span>}
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
          </>
        ) : (
          <>
            Cambiar sede
            <ChevronDown className={cn('h-4 w-4 transition-transform', abierto && 'rotate-180')} aria-hidden="true" />
          </>
        )}
      </button>

      {abierto && (
        <div
          id={idLista}
          className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Elige tu sede
          </p>
          <ul role="list" className="space-y-1">
            {sedes.map((sede) => {
              const esActual = sede.id === actualId
              const apertura = estados?.get(sede.id)?.apertura ?? null
              return (
                <li key={sede.id}>
                  <button
                    type="button"
                    onClick={() => elegir(sede)}
                    aria-current={esActual ? 'true' : undefined}
                    className={cn(
                      'flex w-full min-h-[44px] items-start justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800',
                      esActual && 'bg-gray-50 dark:bg-gray-800',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{sede.nombre}</span>
                      {apertura && <OpenStatusBadge apertura={apertura} className="mt-1 px-2 py-0.5" />}
                    </span>
                    {esActual && <Check className="mt-0.5 h-4 w-4 shrink-0" aria-label="Sede actual" style={{ color: primaryColor }} />}
                  </button>
                </li>
              )
            })}
          </ul>
          {hrefTodas && (
            <a href={hrefTodas} className="mt-1 block px-3 py-2 text-sm font-medium hover:underline" style={{ color: primaryColor }}>
              Ver todas las sedes y horarios
            </a>
          )}
        </div>
      )}

      {destino && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setDestino(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${idDialogo}-titulo`}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDestino(null)
            }}
          >
            <h2 id={`${idDialogo}-titulo`} className="text-lg font-semibold text-gray-900 dark:text-white">
              ¿Cambiar a {destino.sede.nombre}?
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tu pedido{actual ? ` de ${actual.nombre}` : ''} ({destino.unidades} {destino.unidades === 1 ? 'producto' : 'productos'}) se
              queda guardado. Cada sede tiene su carta y sus precios: en {destino.sede.nombre} empiezas un pedido nuevo.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setDestino(null)}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={vaciarYCambiar}
                className="min-h-[44px] rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Vaciar mi pedido y cambiar
              </button>
              <button
                type="button"
                onClick={() => navegar(destino.sede)}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Cambiar de sede
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
