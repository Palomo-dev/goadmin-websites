'use client'

/**
 * Barra fija del pago en computador (Figma «16 Sitio web» › «Barra de pago en computador»
 * 3214:110908, aprobada por el dueño el 2026-11-25). Los mismos tres estilos que la del celular
 * (A dos filas, B botón de dos líneas, C botón partido, por defecto C) con el contenido que decide
 * `contenidoBarraPagoComputador` (./barraPago.ts).
 *
 * - Izquierda: hasta 3 miniaturas superpuestas, «N productos», «Ver resumen» y la línea de contexto
 *   (envío, contraentrega, ahorro, «Se cobra en COP»). Con el botón apagado y un motivo que el
 *   checkout YA conoce: «Falta un dato para pagar» + el motivo + «Ir al campo».
 * - Derecha: lo del estilo. El botón llama lo mismo que el de debajo del resumen.
 * - Siempre visible en 1 paso (el dueño, 2026-11-25: se ven los dos botones, la barra y el del
 *   resumen). Solo computador (`hidden md:block`); en celular va `BarraPagoMovil`.
 */

import { useEffect, useId, useRef } from 'react'
import { AlertCircle, Banknote, Check, ChevronUp, Loader2, Lock, Package, Percent } from 'lucide-react'
import { etiquetaAccesibleBoton, type ContenidoBarraComputador, type IconoContexto } from './barraPago'

interface Props {
  contenido: ContenidoBarraComputador
  color: string
  /** Imágenes de las primeras líneas del carrito (null = sin imagen: cuadro gris). Se pintan hasta 3. */
  imagenes: (string | null)[]
  deshabilitado: boolean
  procesando: boolean
  onPagar: () => void
  /** «Ver resumen»: lleva al resumen del pedido. */
  onDetalle: () => void
  /** Motivo del botón apagado (`motivoBarraApagada`); null = sin motivo conocido. */
  motivoApagado: string | null
  /** «Ir al campo»: lleva a donde se resuelve el motivo. Sin él, no se pinta. */
  onIrAlCampo: (() => void) | null
  /** Alto real de la barra en px, para el espaciador del checkout (0 en celular: no se ve). */
  onAlto: (alto: number) => void
}

const ICONO_CONTEXTO: Record<IconoContexto, typeof Package> = {
  paquete: Package,
  porcentaje: Percent,
  billete: Banknote,
}

function Miniaturas({ imagenes }: { imagenes: (string | null)[] }) {
  const visibles = imagenes.slice(0, 3)
  if (visibles.length === 0) return null
  return (
    <span className="hidden flex-shrink-0 items-center lg:flex" aria-hidden="true">
      {visibles.map((src, i) => (
        <span
          key={i}
          className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border-2 border-white bg-gray-100 ${i > 0 ? '-ml-3' : ''}`}
          style={{ zIndex: visibles.length - i }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
        </span>
      ))}
    </span>
  )
}

export function BarraPagoComputador({ contenido: c, color, imagenes, deshabilitado, procesando, onPagar, onDetalle, motivoApagado, onIrAlCampo, onAlto }: Props) {
  const idMotivo = useId()
  const ref = useRef<HTMLDivElement>(null)

  // El mismo patrón que BarraPagoMovil: el espaciador mide lo que mide la barra (en 768 px la línea
  // de contexto puede partirse en dos y la barra crece).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => onAlto(el.offsetHeight)
    medir()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    obs?.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      obs?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [onAlto])

  const Icono = c.boton.icono === 'check' ? Check : Lock
  const claseBoton = 'flex items-center rounded-xl text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2'
  const procesandoNodo = (
    <span className="flex w-full items-center justify-center gap-2 font-semibold">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Procesando...
    </span>
  )
  const propsBoton = {
    type: 'button' as const,
    onClick: onPagar,
    disabled: deshabilitado,
    'aria-label': procesando ? undefined : etiquetaAccesibleBoton(c),
    'aria-describedby': motivoApagado ? idMotivo : undefined,
    style: { backgroundColor: color },
  }

  const izquierda = motivoApagado ? (
    <div className="flex min-w-0 items-center gap-3" data-barra-motivo="">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700" aria-hidden="true">
        <AlertCircle className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-800">Falta un dato para pagar</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-gray-700">
          <span id={idMotivo} className="truncate">{motivoApagado}</span>
          {onIrAlCampo && (
            <>
              <span className="text-gray-300" aria-hidden="true">·</span>
              <button type="button" onClick={onIrAlCampo} className="inline-flex flex-shrink-0 items-center gap-1 rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900" style={{ color }}>
                Ir al campo
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      <Miniaturas imagenes={imagenes} />
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm font-semibold text-gray-900">{c.productos}</span>
          <button type="button" onClick={onDetalle} className="inline-flex flex-shrink-0 items-center gap-1 rounded text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900" style={{ color }}>
            Ver resumen
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
        {c.contexto.length > 0 && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-600">
            {c.contexto.map((p, i) => {
              const IconoPieza = p.icono ? ICONO_CONTEXTO[p.icono] : null
              return (
                <span key={`${i}-${p.texto}`} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-gray-300" aria-hidden="true">·</span>}
                  <span
                    className={`inline-flex items-center gap-1.5 ${p.verde ? 'font-medium text-green-700' : p.cobroEnBase ? 'text-gray-500' : ''}`}
                    data-cobro-base={p.cobroEnBase ? '' : undefined}
                  >
                    {IconoPieza && <IconoPieza className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
                    {p.texto}
                  </span>
                </span>
              )
            })}
          </p>
        )}
      </div>
    </div>
  )

  let derecha
  if (c.estilo === 'dos_filas') {
    derecha = (
      <div className="flex flex-shrink-0 items-center gap-6">
        {c.columnas.length > 1 ? (
          <div className="flex items-end divide-x divide-gray-200">
            {c.columnas.map((col) => (
              <div key={col.etiqueta} className="px-3 text-center first:pl-0 last:pr-0 lg:px-5">
                <span className="block text-xs text-gray-500">{col.etiqueta}</span>
                <span className={col.destacado ? 'block text-2xl font-bold leading-8 text-gray-900' : 'block text-base font-medium leading-8 text-gray-800'}>{col.valor}</span>
              </div>
            ))}
          </div>
        ) : c.columnas[0] ? (
          <div className="text-right">
            <span className="block text-xs text-gray-500">{c.columnas[0].etiqueta}</span>
            <span className="block text-2xl font-bold leading-8 text-gray-900">{c.columnas[0].valor}</span>
          </div>
        ) : null}
        <button {...propsBoton} className={`${claseBoton} h-[52px] min-w-0 max-w-[42vw] justify-center gap-2 px-7`}>
          {procesando ? procesandoNodo : (
            <>
              <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate font-semibold">{c.boton.texto}</span>
            </>
          )}
        </button>
      </div>
    )
  } else if (c.estilo === 'dos_lineas') {
    derecha = (
      <div className="flex flex-shrink-0 items-center gap-8">
        {c.total && (
          <span className="whitespace-nowrap text-sm text-gray-500">
            Total <strong className="ml-1.5 text-2xl font-bold text-gray-900">{c.total}</strong>
          </span>
        )}
        <button {...propsBoton} className={`${claseBoton} min-h-[60px] min-w-[224px] justify-center gap-3 px-7 py-2`}>
          {procesando ? procesandoNodo : (
            <>
              <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="flex min-w-0 flex-col items-center text-center">
                <span className="whitespace-nowrap text-base font-semibold leading-5">{c.boton.texto}</span>
                {c.boton.linea2 && <span className="whitespace-nowrap text-xs leading-4 opacity-90">{c.boton.linea2}</span>}
              </span>
            </>
          )}
        </button>
      </div>
    )
  } else {
    derecha = (
      <button {...propsBoton} className={`${claseBoton} h-14 w-[440px] max-w-[50vw] flex-shrink-0 px-6`}>
        {procesando ? procesandoNodo : (
          <>
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate text-base font-semibold">{c.boton.texto}</span>
            </span>
            {c.boton.monto && (
              <span className="ml-4 flex flex-shrink-0 flex-col items-end border-l border-white/40 pl-4 leading-tight">
                {c.boton.montoEtiqueta && <span className="text-[11px] font-medium opacity-90">{c.boton.montoEtiqueta}</span>}
                <span className="whitespace-nowrap text-xl font-bold">{c.boton.monto}</span>
              </span>
            )}
          </>
        )}
      </button>
    )
  }

  return (
    <div
      ref={ref}
      data-barra-pago-computador=""
      data-barra-pago={c.estilo}
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:block"
    >
      <div className="container mx-auto flex items-center justify-between gap-6 px-4 py-4">
        {izquierda}
        {derecha}
      </div>
    </div>
  )
}
