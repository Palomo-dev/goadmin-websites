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
  /**
   * Al entrar se queda en la página aunque el editor diga «Ir a Mi cuenta» (el checkout: el
   * carrito y lo escrito no se pierden y los datos de la cuenta se llenan solos). Sin valor, lo
   * del editor, como hoy.
   */
  quedarse?: boolean
  /**
   * Página a la que ir si el acceso no se abre como ventana (la vista manda a la página): la del
   * checkout lleva `?siguiente=/checkout`. Sin valor, la ruta de siempre de la vista.
   */
  paginaRespaldo?: string
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
 * con el formato de reglaAcceso.ts (el mismo modo en el celular; solo la ventana pasa a hoja
 * inferior; con sesión, el menú de cuenta).
 * Sin él (modo «Página», cuenta congelada, Carta QR): el enlace sigue a la página, como siempre.
 * Ctrl/⌘/Mayús/clic central abren la página en otra pestaña, como cualquier enlace.
 */
export function alTocarEnlaceCuenta(
  e: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; currentTarget: EventTarget | null; preventDefault: () => void },
  respaldo: string,
  vista?: VistaAcceso,
  extra?: Pick<DetalleAbrirAcceso, 'quedarse' | 'paginaRespaldo'>,
) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  if (anfitriones === 0) return
  e.preventDefault()
  abrirAccesoCuenta({ origen: e.currentTarget instanceof HTMLElement ? e.currentTarget : null, respaldo, vista, ...(extra ?? {}) })
}

/** ¿Hay un acceso montado que se abra encima? Sin él, los enlaces de cuenta navegan a la página. */
export function hayAccesoMontado(): boolean {
  return anfitriones > 0
}

/**
 * «Iniciar sesión» de cualquier punto de la tienda que no es el ícono ni el menú: el checkout,
 * favoritos (página y panel), consultar pedido, reseñas «solo compradores», precios por volumen y
 * Mi cuenta. Abre el acceso con el MISMO modo de la cabecera (reglaAcceso.ts) en «Ingresar» y, al
 * entrar, se queda donde estaba aunque el editor diga «Ir a Mi cuenta». Sin acceso montado (modo
 * «Página», cuenta congelada) el enlace sigue a `href`, que es /auth?siguiente=<de donde vino>
 * (`rutaIniciarSesion`): al entrar, la página de acceso vuelve ahí.
 */
export function alTocarIniciarSesion(
  e: Parameters<typeof alTocarEnlaceCuenta>[0],
  href: string,
) {
  alTocarEnlaceCuenta(e, href, 'ingresar', { quedarse: true, paginaRespaldo: href })
}

/**
 * «¿Ya compraste aquí? Ingresa con un código» y el «Ingresar» de contraentrega en el checkout:
 * con la ventana de acceso montada (cualquier modo del editor menos «Página»), la abre en
 * «Ingresar» y, al entrar, el cliente se queda en el pago. Sin ella, el enlace sigue a
 * `href` (/auth?siguiente=/checkout), como hoy.
 */
export function alTocarIngresarCheckout(
  e: Parameters<typeof alTocarEnlaceCuenta>[0],
  href: string,
) {
  alTocarIniciarSesion(e, href)
}

/**
 * Se entró desde el acceso sin salir de la página («Quedarse» o un «Iniciar sesión» que vuelve
 * donde estaba): quien pidió la sesión (las reseñas «solo compradores») vuelve a mirar.
 */
export const EVENTO_ACCESO_ENTRO = 'acceso-cuenta-entro'

export function avisarAccesoEntro() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENTO_ACCESO_ENTRO))
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
