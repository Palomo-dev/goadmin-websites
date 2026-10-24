'use client'

import { useEffect, useState } from 'react'

export interface EstadoScrollEncabezado {
  /** El modo pide movimiento. `fijo` o ausente = false y el encabezado no cambia. */
  activo: boolean
  oculto: boolean
  encogido: boolean
}

/**
 * Oculta o encoge el encabezado al bajar. Con `fijo` (lo de hoy) no escucha el scroll.
 * Respeta `prefers-reduced-motion`: en ese caso tampoco se mueve.
 */
export function useScrollEncabezado(modo: unknown): EstadoScrollEncabezado {
  const activo = modo === 'ocultar_al_bajar' || modo === 'encoger' || modo === 'ocultar_y_encoger'
  const [estado, setEstado] = useState({ oculto: false, encogido: false })

  useEffect(() => {
    if (!activo || typeof window === 'undefined') {
      setEstado({ oculto: false, encogido: false })
      return
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let marco = 0
    let anterior = window.scrollY
    const alScroll = () => {
      cancelAnimationFrame(marco)
      marco = requestAnimationFrame(() => {
        const y = window.scrollY
        const bajando = y > anterior && y > 80
        const subiendo = y < anterior
        anterior = y
        const ocultar = modo === 'ocultar_al_bajar' || modo === 'ocultar_y_encoger'
        const encoger = modo === 'encoger' || modo === 'ocultar_y_encoger'
        setEstado({
          oculto: ocultar && bajando && !subiendo,
          encogido: encoger && y > 40,
        })
      })
    }
    window.addEventListener('scroll', alScroll, { passive: true })
    return () => {
      cancelAnimationFrame(marco)
      window.removeEventListener('scroll', alScroll)
    }
  }, [activo, modo])

  if (!activo) return { activo: false, oculto: false, encogido: false }
  return { activo: true, ...estado }
}
