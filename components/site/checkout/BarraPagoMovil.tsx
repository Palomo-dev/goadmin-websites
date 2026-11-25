'use client'

/**
 * Barra fija del pago en celular (Figma «16 Sitio web» 3059:80757, aprobada 2026-11-24). Pinta lo
 * que decide `contenidoBarraPago` (./barraPago.ts) en el estilo de la tienda: A dos filas, B botón
 * de dos líneas o C botón partido (por defecto).
 *
 * - Área segura del iPhone: el relleno de abajo suma `env(safe-area-inset-bottom)`.
 * - `onAlto` informa el alto real (con el área segura) para el espaciador del checkout.
 * - La burbuja del chat sube 12 px sobre la barra (opción 4a) con `useEmpujeChat`, la misma regla
 *   del menú inferior y de la barra de la ficha: nunca queda encima del botón.
 *
 * Solo celular (`md:hidden`); en computador va `BarraPagoComputador` (mismos estilos).
 */

import { useEffect, useId, useRef } from 'react'
import { Banknote, Check, ChevronUp, Loader2, Lock } from 'lucide-react'
import { useEmpujeChat } from '@/components/site/barraFija/efectosBarraFija'
import { etiquetaAccesibleBoton, type ContenidoBarraPago } from './barraPago'

interface Props {
  contenido: ContenidoBarraPago
  color: string
  deshabilitado: boolean
  procesando: boolean
  onPagar: () => void
  /** «Ver resumen» / «Detalle»: lleva al resumen del pedido. */
  onDetalle: () => void
  /** Alto real de la barra en px (0 cuando no se ve, p. ej. en computador). */
  onAlto: (alto: number) => void
}

export function BarraPagoMovil({ contenido: c, color, deshabilitado, procesando, onPagar, onDetalle, onAlto }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEmpujeChat(useId(), ref, true, true)

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
  const enlace = c.enlace ? (
    <button type="button" onClick={onDetalle} className="inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold" style={{ color }}>
      {c.enlace}
      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  ) : null

  const claseBoton = 'flex w-full items-center rounded-xl text-white transition-opacity disabled:opacity-60'
  const procesandoNodo = (
    <span className="flex w-full items-center justify-center gap-2 font-semibold">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      Procesando...
    </span>
  )

  return (
    <div
      ref={ref}
      data-barra-pago={c.estilo}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 pt-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] md:hidden"
      style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
    >
      {c.estilo === 'dos_filas' && (
        <>
          {c.columnas.length > 1 ? (
            <div className="mb-2.5 grid grid-cols-3 items-end gap-2">
              {c.columnas.map((col, i) => (
                <div key={col.etiqueta} className={i === 0 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'}>
                  <span className="block text-xs text-gray-500">{col.etiqueta}</span>
                  <span className={col.destacado ? 'block text-lg font-bold leading-6 text-gray-900' : 'block text-sm font-medium leading-6 text-gray-800'}>{col.valor}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mb-2.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate text-xs text-gray-500">{c.columnas[0]?.etiqueta}</span>
                <span className="block text-lg font-bold leading-6 text-gray-900">{c.columnas[0]?.valor}</span>
              </div>
              {c.chipAlRecibir ? (
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                  {c.chipAlRecibir}
                </span>
              ) : enlace}
            </div>
          )}
          <button type="button" onClick={onPagar} disabled={deshabilitado} aria-label={procesando ? undefined : etiquetaAccesibleBoton(c)} className={`${claseBoton} h-12 justify-center gap-2 px-4`} style={{ backgroundColor: color }}>
            {procesando ? procesandoNodo : (
              <>
                <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="truncate font-semibold">{c.boton.texto}</span>
              </>
            )}
          </button>
        </>
      )}

      {c.estilo === 'dos_lineas' && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-gray-500">
              Total <strong className="ml-1 text-base text-gray-900">{c.total}</strong>
              {c.contexto && <span className="ml-2 text-xs font-medium text-green-700">{c.contexto}</span>}
            </span>
            {enlace}
          </div>
          <button type="button" onClick={onPagar} disabled={deshabilitado} aria-label={procesando ? undefined : etiquetaAccesibleBoton(c)} className={`${claseBoton} min-h-[56px] justify-center gap-2.5 px-4 py-2`} style={{ backgroundColor: color }}>
            {procesando ? procesandoNodo : (
              <>
                <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="flex min-w-0 flex-col items-center text-center">
                  <span className="max-w-full truncate text-base font-semibold leading-5">{c.boton.texto}</span>
                  {c.boton.linea2 && <span className="max-w-full truncate text-xs leading-4 opacity-90">{c.boton.linea2}</span>}
                </span>
              </>
            )}
          </button>
        </>
      )}

      {c.estilo === 'partido' && (
        <>
          <div className="mb-2 flex min-h-[18px] items-center justify-between gap-3">
            {c.contexto && (
              <span className={`flex min-w-0 items-center gap-1.5 text-xs ${c.contextoAlRecibir ? 'font-medium text-green-700' : 'text-gray-600'}`}>
                {c.contextoAlRecibir && <Banknote className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
                <span className="truncate">{c.contexto}</span>
              </span>
            )}
            {enlace}
          </div>
          <button type="button" onClick={onPagar} disabled={deshabilitado} aria-label={procesando ? undefined : etiquetaAccesibleBoton(c)} className={`${claseBoton} h-[52px] px-4`} style={{ backgroundColor: color }}>
            {procesando ? procesandoNodo : (
              <>
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate font-semibold">{c.boton.texto}</span>
                </span>
                {c.boton.monto && (
                  <span className="ml-3 flex flex-shrink-0 flex-col items-end border-l border-white/40 pl-3 leading-tight">
                    {c.boton.montoEtiqueta && <span className="text-[10px] font-medium opacity-90">{c.boton.montoEtiqueta}</span>}
                    <span className="whitespace-nowrap text-lg font-bold">{c.boton.monto}</span>
                  </span>
                )}
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}
