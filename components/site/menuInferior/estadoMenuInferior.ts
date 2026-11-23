'use client'
import { useEffect, useSyncExternalStore } from 'react'

/**
 * Coordinación entre la barra fija de compra de la ficha y el menú de abajo (Figma 2844:70510,
 * «Páginas especiales», para TODAS las tiendas):
 *
 * - La barra del celular (StickyAddToCart) avisa si se ve (`useAvisoBarraFijaCelular`).
 * - El menú inferior v2 (MenuInferior) se oculta mientras se ve (F1) o se apila debajo (F2).
 * - Las barras de antes (BarraPestanas, MobileBottomNav, barra del constructor…) se ocultan con la
 *   regla `html[data-barra-fija-celular="visible"][data-pagina-menu="ficha"]` de app/globals.css.
 *
 * El aviso también va en `<html data-barra-fija-celular>` para que el CSS lo lea sin React.
 */
let barraVisible = false
const oyentes = new Set<() => void>()

function avisar(visible: boolean) {
  if (barraVisible === visible) return
  barraVisible = visible
  if (typeof document !== 'undefined') {
    if (visible) document.documentElement.setAttribute('data-barra-fija-celular', 'visible')
    else document.documentElement.removeAttribute('data-barra-fija-celular')
  }
  oyentes.forEach((o) => o())
}

/** La barra fija del celular de la ficha avisa si se ve; al desmontarse, que ya no. */
export function useAvisoBarraFijaCelular(visible: boolean) {
  useEffect(() => {
    avisar(visible)
  }, [visible])
  useEffect(() => () => avisar(false), [])
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

/** Si la barra fija de compra del celular se ve ahora. */
export function useBarraFijaCelularVisible(): boolean {
  return useSyncExternalStore(suscribir, () => barraVisible, () => false)
}
