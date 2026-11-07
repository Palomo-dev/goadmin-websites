'use client'

/**
 * La marca a todo el ancho de la portada `hero · brand_giant`. Cada letra mide distinto en cada
 * fuente (Syne es muy ancha, Archivo condensada), así que el tamaño se ajusta en el navegador al
 * ancho real del contenedor. Antes de medir (servidor, primer pintado) va un tamaño estimado que
 * se queda corto a propósito: nunca desborda.
 */
import { useLayoutEffect, useRef, useState } from 'react'

/** Tamaño estimado: ~0,8 em por letra (holgado para fuentes anchas en negrita). */
export function tamanoEstimadoMarca(texto: string): string {
  const letras = Math.max(3, Array.from(texto).length)
  const vw = Math.min(24, 92 / (letras * 0.8))
  return `clamp(2.5rem, ${vw.toFixed(2)}vw, 20rem)`
}

const MAX_PX = 360

export function LetreroMarca({ texto, className = '' }: { texto: string; className?: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const letra = useRef<HTMLHeadingElement>(null)
  const [px, setPx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const c = caja.current
    const t = letra.current
    if (!c || !t) return
    // Regla de tres con el tamaño que tiene ahora (sin tocar el estilo a mano: lo pone React).
    const ajustar = () => {
      const actual = parseFloat(getComputedStyle(t).fontSize)
      const ancho = t.scrollWidth
      if (actual > 0 && ancho > 0 && c.clientWidth > 0) {
        setPx(Math.min(MAX_PX, Math.floor(actual * (c.clientWidth / ancho) * 0.99)))
      }
    }
    ajustar()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ajustar) : null
    obs?.observe(c)
    // La fuente web puede llegar después del primer pintado y cambiar el ancho.
    document.fonts?.ready.then(ajustar).catch(() => {})
    return () => obs?.disconnect()
  }, [texto])

  return (
    <div ref={caja} className="w-full overflow-hidden text-center">
      <h1
        ref={letra}
        className={`inline-block select-none whitespace-nowrap font-black uppercase leading-[0.82] tracking-[-0.03em] ${className}`}
        style={{ fontSize: px ? `${px}px` : tamanoEstimadoMarca(texto), fontFamily: 'var(--font-heading)' }}
      >
        {texto}
      </h1>
    </div>
  )
}
