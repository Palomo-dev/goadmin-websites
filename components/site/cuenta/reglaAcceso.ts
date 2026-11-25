/**
 * Regla única del acceso a la cuenta («Ingresa a tu cuenta»): cómo se presenta según el modo del
 * editor (`header_cuenta.modo`, lib/website/v2/cabeceraTienda.ts) y el tamaño de la pantalla, y a
 * dónde lleva un «Iniciar sesión» cuando el acceso se abre como página.
 *
 * Pedido del dueño (2026-11-25): «lo que escojo en el escritorio (la página, el diálogo o el
 * drawer), en celular también debería ser así». La hoja de abajo hacia arriba queda SOLO para la
 * «Ventana desde el ícono» (un menú flotante), que en el celular no cabe colgada del ícono.
 *
 * | Modo del editor | Computador                | Celular (< 768 px)                         |
 * |-----------------|---------------------------|--------------------------------------------|
 * | `pagina`        | /auth (no se monta nada)  | /auth                                      |
 * | `panel`         | cajón lateral derecho     | cajón lateral derecho                      |
 * | `dialogo`       | diálogo centrado          | diálogo centrado, ancho casi completo      |
 * | `ventana`       | colgada del ícono         | hoja inferior                              |
 *
 * `header_cuenta` no tiene un ajuste propio para el celular (solo `modo`): el del computador manda.
 *
 * Pura y sin React: la usan AccesoCuenta (el único que pinta el acceso, para el ícono de la
 * cabecera, el menú inferior, el menú del celular, el checkout, favoritos, consultar pedido,
 * reseñas y precios por volumen) y los verify (scripts/verify-acceso-cuenta.mjs).
 */
import type { ModoCuenta } from '@/lib/website/v2/cabeceraTienda'

/** Formato en pantalla: el del editor o, para la ventana en el celular, la hoja inferior. */
export type FormatoAcceso = Exclude<ModoCuenta, 'pagina'> | 'hoja'

/** Ancho del celular del sitio (Tailwind `md`). */
export const CONSULTA_CELULAR = '(max-width: 767px)'

/** Formato en que se abre el acceso; `null` = la página (el acceso no se abre encima). */
export function formatoAcceso(modo: ModoCuenta, celular: boolean): FormatoAcceso | null {
  if (modo === 'pagina') return null
  if (modo === 'ventana' && celular) return 'hoja'
  return modo
}

/**
 * Página de «Iniciar sesión» que, al entrar, vuelve a `volverA` (/auth?siguiente=…). Es el destino
 * del enlace cuando el acceso se abre como página (modo «Página», o sin acceso montado) y el
 * respaldo de los demás modos. `/auth` (o una ruta no interna) no lleva `siguiente`.
 */
export function rutaIniciarSesion(volverA?: string | null): string {
  const r = (volverA ?? '').trim()
  if (!r.startsWith('/') || r.startsWith('//') || r.startsWith('/\\') || r.includes('://')) return '/auth'
  if (r === '/auth' || r.startsWith('/auth?') || r.startsWith('/auth/')) return '/auth'
  return `/auth?siguiente=${encodeURIComponent(r.slice(0, 300))}`
}

/** Lo que se ve de la pantalla (`window.visualViewport`): sin el teclado del celular. */
export interface VistaVisible {
  alto: number
  arriba: number
}

/** Márgenes del diálogo con el borde de lo visible (arriba y abajo). */
export const MARGEN_DIALOGO_ACCESO = 16

export interface EncuadreAcceso {
  top?: number
  bottom?: number | 'auto'
  height?: number
  maxHeight?: number
}

/**
 * Encaje con el teclado abierto (iOS achica lo visible sin mover los `fixed`): el diálogo se
 * centra en lo que se ve y no pasa de su alto; el cajón ocupa solo lo visible; la hoja se apoya
 * encima del teclado. Sin teclado (lo visible = la pantalla) no cambia nada: mandan las clases.
 * La ventana del computador no se toca.
 */
export function encuadreVisible(formato: FormatoAcceso, vista: VistaVisible | null, altoPantalla: number): EncuadreAcceso {
  if (!vista || !(vista.alto > 0)) return {}
  if (Math.abs(altoPantalla - vista.alto) < 2 && vista.arriba < 1) return {}
  const alto = Math.round(vista.alto)
  const arriba = Math.round(vista.arriba)
  if (formato === 'dialogo') {
    return { top: Math.round(arriba + alto / 2), maxHeight: Math.max(160, alto - MARGEN_DIALOGO_ACCESO * 2) }
  } else if (formato === 'panel') {
    return { top: arriba, bottom: 'auto', height: alto }
  } else if (formato === 'hoja') {
    return { bottom: Math.max(0, Math.round(altoPantalla - arriba - alto)), maxHeight: Math.round(alto * 0.92) }
  }
  return {}
}
