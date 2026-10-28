'use client'

import { useEffect, useLayoutEffect, useState, type RefObject, type CSSProperties } from 'react'

/**
 * Menú de escritorio que no cabe (desborde a 768/1024, QA 28-oct). El CSS de globals.css deja que
 * el menú ceda ancho; este hook marca `data-nav-desliza` SOLO cuando sus enlaces no caben, y ahí el
 * menú se desliza en vez de empujar los íconos fuera de la pantalla. Si cabe, nada cambia.
 */
export const SELECTOR_MENU_ESCRITORIO = 'header .hidden.md\\:flex > nav, header nav.hidden.md\\:flex'
export const ATRIBUTO_DESLIZA = 'data-nav-desliza'
/** Bordes con enlaces escondidos (degradado de aviso): 'izq', 'der' o 'ambos'. */
export const ATRIBUTO_BORDE = 'data-nav-oculto'

/** Qué bordes esconden enlaces según la posición del deslizamiento; null si no desliza. */
export function bordeOculto(desliza: boolean, scrollLeft: number, scrollWidth: number, clientWidth: number): 'izq' | 'der' | 'ambos' | null {
  if (!desliza) return null
  const izq = scrollLeft > 1
  const der = scrollLeft + clientWidth < scrollWidth - 1
  return izq && der ? 'ambos' : izq ? 'izq' : der ? 'der' : null
}

function marcarBorde(nav: HTMLElement): void {
  const b = bordeOculto(nav.hasAttribute(ATRIBUTO_DESLIZA), nav.scrollLeft, nav.scrollWidth, nav.clientWidth)
  if (b === null) nav.removeAttribute(ATRIBUTO_BORDE)
  else if (nav.getAttribute(ATRIBUTO_BORDE) !== b) nav.setAttribute(ATRIBUTO_BORDE, b)
}

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
        marcarBorde(nav)
      })
    }
    const alDeslizar = (e: Event) => {
      const t = e.target
      if (t instanceof HTMLElement && t.hasAttribute(ATRIBUTO_DESLIZA)) marcarBorde(t)
    }
    document.addEventListener('scroll', alDeslizar, { capture: true, passive: true })
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
      document.removeEventListener('scroll', alDeslizar, { capture: true })
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
