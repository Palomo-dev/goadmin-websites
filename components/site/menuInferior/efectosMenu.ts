'use client'
import { useEffect, useLayoutEffect, useState, type PointerEvent as EventoPuntero, type RefObject } from 'react'
import type { EfectoToque } from '@/lib/website/menuInferior'

/**
 * Efectos del menú inferior (Figma 2836:69391, propuestas 3 y 10). Lo visual está en
 * app/globals.css (`[data-menu-inferior]`, `.mi-*`). Con «menos movimiento» del teléfono: el menú no
 * se esconde al bajar, la marca no se desliza y al tocar solo cambia el color.
 */

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function menosMovimiento(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Px que hay que bajar seguidos para que el menú se vaya (Figma S2: «al bajar más de 24 px»). */
const UMBRAL_ESCONDER_PX = 24

/**
 * «Se esconde al bajar» (S2/S3): se va al bajar más de 24 px y vuelve apenas se sube un poco.
 * Siempre visible arriba del todo, al final de la página, en páginas cortas y con «menos
 * movimiento».
 */
export function useEsconderAlBajar(activo: boolean): boolean {
  const [escondido, setEscondido] = useState(false)
  useEffect(() => {
    if (!activo) return
    let ultimo = window.scrollY
    let bajado = 0
    const alDesplazar = () => {
      const y = window.scrollY
      const d = y - ultimo
      ultimo = y
      const doc = document.documentElement
      const alFinal = window.innerHeight + y >= doc.scrollHeight - 8
      const corta = doc.scrollHeight <= window.innerHeight * 1.5
      if (menosMovimiento() || y < UMBRAL_ESCONDER_PX || alFinal || corta) {
        bajado = 0
        setEscondido(false)
        return
      }
      if (d > 0) {
        bajado += d
        if (bajado > UMBRAL_ESCONDER_PX) setEscondido(true)
      } else if (d < 0) {
        bajado = 0
        setEscondido(false)
      }
    }
    window.addEventListener('scroll', alDesplazar, { passive: true })
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      setEscondido(false)
    }
  }, [activo])
  return activo && escondido
}

/**
 * Alto que ocupa el menú abajo (alto + separación del borde), medido en vivo. 0 si no se pinta
 * (escritorio, `display: none`).
 */
export function useAltoMenu(ref: RefObject<HTMLElement | null>, clave: unknown): number {
  const [alto, setAlto] = useState(0)
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAlto(el.offsetHeight > 0 ? Math.round(el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0)) : 0)
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [ref, clave])
  return alto
}

/**
 * Marca que se desliza (N1): posición y ancho del botón activo (`[data-mi-boton][aria-current]`)
 * dentro del contenedor. Sin activo, la marca no se ve.
 */
export interface PosicionMarca { left: number; top: number; width: number; height: number; visible: boolean }

export function useMarcaDeslizante(ref: RefObject<HTMLElement | null>, clave: unknown): PosicionMarca {
  const [pos, setPos] = useState<PosicionMarca>({ left: 0, top: 0, width: 0, height: 0, visible: false })
  useIsoLayoutEffect(() => {
    const cont = ref.current
    if (!cont) return
    const medir = () => {
      const activo = cont.querySelector<HTMLElement>('[data-mi-item][aria-current="page"] [data-mi-marca]')
      if (!activo) {
        setPos((p) => (p.visible ? { ...p, visible: false } : p))
        return
      }
      const a = activo.getBoundingClientRect()
      const c = cont.getBoundingClientRect()
      setPos({ left: Math.round(a.left - c.left), top: Math.round(a.top - c.top), width: Math.round(a.width), height: Math.round(a.height), visible: a.width > 0 })
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(cont)
    return () => ro?.disconnect()
  }, [ref, clave])
  return pos
}

/**
 * «Rebote» y «Onda» al tocar necesitan saber dónde y cuándo se soltó: se delega en el menú.
 * Escala, inclinación y oscurecer son solo CSS (`:active`).
 */
export function alTocarMenu(efecto: EfectoToque) {
  if (efecto !== 'bounce' && efecto !== 'ripple') return undefined
  return (e: EventoPuntero<HTMLElement>) => {
    if (menosMovimiento()) return
    const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-mi-boton]')
    if (!boton) return
    if (efecto === 'bounce') {
      const icono = boton.querySelector<HTMLElement>('[data-mi-icono]')
      if (!icono) return
      icono.classList.remove('mi-rebote-toque')
      // Forzar el reinicio de la animación si se toca dos veces seguidas.
      void icono.offsetWidth
      icono.classList.add('mi-rebote-toque')
      icono.addEventListener('animationend', () => icono.classList.remove('mi-rebote-toque'), { once: true })
      return
    }
    const r = boton.getBoundingClientRect()
    const lado = Math.max(r.width, r.height) * 2
    // La onda queda dentro del botón (capa recortada), sin recortar su contador.
    const capa = document.createElement('span')
    capa.setAttribute('aria-hidden', 'true')
    Object.assign(capa.style, { position: 'absolute', inset: '0', overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' })
    const onda = document.createElement('span')
    onda.className = 'mi-onda'
    Object.assign(onda.style, { left: `${e.clientX - r.left}px`, top: `${e.clientY - r.top}px`, width: `${lado}px`, height: `${lado}px` })
    capa.appendChild(onda)
    boton.appendChild(capa)
    const quitar = () => capa.remove()
    onda.addEventListener('animationend', quitar, { once: true })
    window.setTimeout(quitar, 1200)
  }
}
