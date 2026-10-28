'use client'

import { useEffect, useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react'

/**
 * Menú de escritorio que no cabe (desborde a 768/1024, QA 28-oct). El CSS de globals.css deja que
 * el menú ceda ancho; este hook marca `data-nav-desliza` SOLO cuando sus enlaces no caben, y ahí el
 * menú se desliza en vez de empujar los íconos fuera de la pantalla. Si cabe, nada cambia.
 */
export const SELECTOR_MENU_ESCRITORIO = 'header .hidden.md\\:flex > nav, header nav.hidden.md\\:flex'
export const ATRIBUTO_DESLIZA = 'data-nav-desliza'

/** Decide si un menú debe deslizarse: solo en computador (≥768) y si su contenido no cabe. */
export function debeDeslizar(anchoVentana: number, scrollWidth: number, clientWidth: number): boolean {
  return anchoVentana >= 768 && clientWidth > 0 && scrollWidth > clientWidth + 1
}

export function useMenuDeslizable(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    const medir = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR_MENU_ESCRITORIO).forEach((nav) => {
        const si = debeDeslizar(window.innerWidth, nav.scrollWidth, nav.clientWidth)
        if (si !== nav.hasAttribute(ATRIBUTO_DESLIZA)) nav.toggleAttribute(ATRIBUTO_DESLIZA, si)
      })
    }
    const ro = new ResizeObserver(medir)
    const observar = () => {
      ro.disconnect()
      document.querySelectorAll<HTMLElement>(SELECTOR_MENU_ESCRITORIO).forEach((nav) => {
        ro.observe(nav)
        Array.from(nav.children).forEach((c) => ro.observe(c))
      })
      medir()
    }
    observar()
    const mo = new MutationObserver(observar)
    const header = document.querySelector('header')
    if (header) mo.observe(header, { childList: true, subtree: true })
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [])
}

/**
 * Submenú dentro de un menú que se desliza: el ancla deja de ser la caja que hace scroll (para
 * que el panel no quede recortado) y el panel se coloca bajo su enlace. Sin deslizar, `{}`.
 */
export function usePanelBajoEnlace(abierto: boolean, ancla: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>): CSSProperties {
  const [pos, setPos] = useState<CSSProperties>({})
  const efecto = typeof window === 'undefined' ? useEffect : useLayoutEffect
  efecto(() => {
    const a = ancla.current
    const p = panel.current
    if (!abierto || !a || !p || !a.closest(`nav[${ATRIBUTO_DESLIZA}]`)) {
      setPos((v) => (Object.keys(v).length ? {} : v))
      return
    }
    const base = (p.offsetParent as HTMLElement | null)?.getBoundingClientRect()
    if (!base) return
    const r = a.getBoundingClientRect()
    const maxIzq = Math.max(0, window.innerWidth - p.offsetWidth - 8 - base.left)
    setPos({ left: Math.min(Math.max(0, r.left - base.left), maxIzq), top: r.bottom - base.top })
  }, [abierto])
  return pos
}
