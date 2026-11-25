'use client'

/**
 * Abrir el acceso a la cuenta desde cualquier lado (ícono de la cabecera, fila del menú del
 * celular): un evento que escucha el único AccesoCuenta montado en el layout, y un estado
 * compartido para que el ícono diga si la ventana está abierta (`aria-expanded`).
 */
import { useSyncExternalStore } from 'react'
import type { VistaAcceso } from '@/lib/website/v2/cabeceraTienda'

export const EVENTO_ABRIR_ACCESO = 'abrir-acceso-cuenta'

export interface DetalleAbrirAcceso {
  /** Vista con la que abre (sin sesión). Sin valor, ingresar. */
  vista?: VistaAcceso
  /** Quien la abrió: la ventana se cuelga de él y el foco vuelve a él al cerrar. */
  origen?: HTMLElement | null
}

let anfitriones = 0

/** AccesoCuenta se registra al montarse: sin él (cuenta congelada, Carta QR), el ícono navega. */
export function registrarAnfitrionAcceso(): () => void {
  anfitriones++
  return () => {
    anfitriones--
  }
}

/**
 * Abre el acceso. Si no hay quien lo pinte, va a `respaldo` (la ruta de siempre: /auth o
 * /mi-cuenta), para que el ícono nunca quede sin hacer nada.
 */
export function abrirAccesoCuenta(detalle: DetalleAbrirAcceso & { respaldo?: string } = {}) {
  if (typeof window === 'undefined') return
  if (anfitriones === 0) {
    window.location.href = detalle.respaldo ?? '/auth'
    return
  }
  window.dispatchEvent(new CustomEvent<DetalleAbrirAcceso>(EVENTO_ABRIR_ACCESO, { detail: detalle }))
}

/**
 * Clic en un enlace de cuenta (/auth o /mi-cuenta) de cualquier menú: el botón «Cuenta» del menú
 * inferior del celular (pestañas y menú V2) y la cuenta de la cabecera por zonas. UNA sola fuente
 * para «Al tocar el ícono de cuenta» del editor: el AccesoCuenta que monta el layout solo existe
 * cuando `header_cuenta.modo` NO es «Página» (OrganizationLayoutCliente). Montado: se abre ahí
 * (panel, ventana o diálogo; en el celular, la hoja inferior; con sesión, el menú de cuenta).
 * Sin él (modo «Página», cuenta congelada, Carta QR): el enlace sigue a la página, como siempre.
 * Ctrl/⌘/Mayús/clic central abren la página en otra pestaña, como cualquier enlace.
 */
export function alTocarEnlaceCuenta(
  e: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; currentTarget: EventTarget | null; preventDefault: () => void },
  respaldo: string,
  vista?: VistaAcceso,
) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (anfitriones === 0) return
  e.preventDefault()
  abrirAccesoCuenta({ origen: e.currentTarget instanceof HTMLElement ? e.currentTarget : null, respaldo, vista })
}

let abierto = false
const oyentes = new Set<() => void>()

export function fijarAccesoAbierto(v: boolean) {
  if (abierto === v) return
  abierto = v
  oyentes.forEach((f) => f())
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

/** `true` mientras el panel, la ventana, el diálogo o la hoja de la cuenta están abiertos. */
export function useAccesoAbierto(): boolean {
  return useSyncExternalStore(suscribir, () => abierto, () => false)
}
