'use client'

/**
 * Ventana de `welcome_popup · coupon` (ver `VentanaBienvenida.tsx`).
 *
 * - Se abre una sola vez: antes de abrirla escribe la marca en el almacenamiento; si el navegador
 *   no deja leer o escribir, no se abre (try/catch: nunca rompe la página ni la bloquea).
 * - Diálogo accesible: `role="dialog"` + `aria-modal`, el foco entra al botón de cerrar, Tab da la
 *   vuelta dentro de la ventana, Esc la cierra y el foco vuelve a donde estaba.
 * - Se cierra también con «No, gracias» y tocando fuera. No bloquea el desplazamiento de la página.
 * - En la vista previa del editor (`?preview=1`) no se abre sola: se pinta en línea.
 */

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as EventoTeclado } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'

interface VentanaBienvenidaVistaProps {
  clave: string
  frecuencia: 'once' | 'session'
  retrasoS: number
  saludo: string
  titulo: string
  texto: string
  codigo: string
  imagen: string
  cta: { texto: string; href: string } | null
  colorBoton: { fondo: string; texto: string }
}

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function almacen(frecuencia: 'once' | 'session'): Storage {
  return frecuencia === 'session' ? window.sessionStorage : window.localStorage
}

export function VentanaBienvenidaVista(props: VentanaBienvenidaVistaProps) {
  const { clave, frecuencia, retrasoS } = props
  const enVistaPrevia = useIsPreviewMode()
  const [abierta, setAbierta] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)
  const previo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // La vista previa se lee aquí (no del hook): el hook vale `false` en el primer render.
    if (new URLSearchParams(window.location.search).get('preview') === '1') return
    try {
      if (almacen(frecuencia).getItem(clave) !== null) return
    } catch {
      return // Sin almacenamiento no se puede recordar: mejor no abrirla.
    }
    const temporizador = window.setTimeout(() => {
      try {
        almacen(frecuencia).setItem(clave, String(Date.now()))
      } catch {
        return
      }
      previo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setAbierta(true)
    }, retrasoS * 1000)
    return () => window.clearTimeout(temporizador)
  }, [clave, frecuencia, retrasoS])

  const cerrar = useCallback(() => {
    setAbierta(false)
    const volver = previo.current
    previo.current = null
    if (volver && document.contains(volver)) volver.focus()
  }, [])

  useEffect(() => {
    if (abierta) cerrarRef.current?.focus()
  }, [abierta])

  const alTeclado = (e: EventoTeclado<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrar()
      return
    }
    if (e.key !== 'Tab' || !panel.current) return
    const lista = Array.from(panel.current.querySelectorAll<HTMLElement>(ENFOCABLES))
    if (lista.length === 0) return
    const primero = lista[0]
    const ultimo = lista[lista.length - 1]
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault()
      ultimo.focus()
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault()
      primero.focus()
    }
  }

  if (enVistaPrevia) {
    return (
      <div className="px-4 py-8">
        <p className="mb-3 text-center text-xs opacity-60">Vista previa: en el sitio se abre como ventana, una vez por visitante, a los {retrasoS} s.</p>
        <div className="mx-auto max-w-3xl overflow-hidden shadow-lg" style={{ borderRadius: 'min(var(--radio-sitio, 12px), 16px)' }}>
          <Contenido {...props} />
        </div>
      </div>
    )
  }
  if (!abierta) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div ref={panel} onKeyDown={alTeclado} className="relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto shadow-2xl" style={{ borderRadius: 'min(var(--radio-sitio, 12px), 16px)' }}>
        <Contenido {...props} enDialogo onCerrar={cerrar} cerrarRef={cerrarRef} />
      </div>
    </div>
  )
}

function Contenido({
  saludo,
  titulo,
  texto,
  codigo,
  imagen,
  cta,
  colorBoton,
  enDialogo = false,
  onCerrar,
  cerrarRef,
}: VentanaBienvenidaVistaProps & { enDialogo?: boolean; onCerrar?: () => void; cerrarRef?: React.RefObject<HTMLButtonElement> }) {
  const idTitulo = useId()
  const [copiado, setCopiado] = useState<'no' | 'si' | 'error'>('no')

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado('si')
    } catch {
      setCopiado('error')
    }
  }

  return (
    <div
      role={enDialogo ? 'dialog' : undefined}
      aria-modal={enDialogo ? true : undefined}
      aria-labelledby={enDialogo && titulo ? idTitulo : undefined}
      aria-label={enDialogo && !titulo ? 'Cupón de bienvenida' : undefined}
      className={`grid bg-white text-gray-900 ${imagen ? 'md:grid-cols-2' : ''}`}
    >
      {imagen && (
        <div className="hidden bg-gray-100 md:block">
          <img src={imagen} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="relative p-6 md:p-10">
        {enDialogo && (
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        {saludo && <p className="mb-3 pr-12 text-xs uppercase tracking-wide" style={{ color: 'var(--accent-color, currentColor)' }}>{saludo}</p>}
        {titulo && (
          <h2 id={idTitulo} className="pr-12 text-2xl leading-tight md:text-3xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
            {titulo}
          </h2>
        )}
        {texto && <p className="mt-3 text-sm leading-relaxed text-gray-600">{texto}</p>}
        <button
          type="button"
          onClick={copiar}
          className="mt-6 flex w-full items-center justify-between gap-3 border border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          style={{ borderRadius: 'min(var(--radio-sitio, 8px), 12px)' }}
          aria-label={`Copiar el código ${codigo}`}
        >
          <span className="font-mono text-lg font-semibold tracking-[0.15em]">{codigo}</span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs shadow-sm">{copiado === 'si' ? 'Copiado' : 'Toca para copiar'}</span>
        </button>
        <p className="mt-2 text-xs text-gray-500" aria-live="polite">
          {copiado === 'error' ? `No pudimos copiarlo: escribe ${codigo} en «Código de cupón» al pagar.` : 'Escríbelo en «Código de cupón» al pagar.'}
        </p>
        {cta && (
          <a
            href={cta.href}
            onClick={onCerrar}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 px-6 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: colorBoton.fondo, color: colorBoton.texto, borderRadius: 'var(--radio-boton, 9999px)', outlineColor: colorBoton.fondo }}
          >
            {cta.texto}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
        {enDialogo && (
          <button type="button" onClick={onCerrar} className="mt-4 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900">
            No, gracias
          </button>
        )}
      </div>
    </div>
  )
}
