'use client'

/**
 * Pestañas ancla de la ficha (parte de navegador de NavAnclas): marca la pestaña del bloque que
 * está a la vista. Sin JavaScript siguen funcionando como enlaces `#tipo`.
 */

import { useEffect, useState } from 'react'

interface Pestana {
  label: string
  target: string
}

export function NavAnclasCliente({ pestanas, sticky, primaryColor }: { pestanas: Pestana[]; sticky: boolean; primaryColor: string }) {
  const [activa, setActiva] = useState(pestanas[0]?.target ?? '')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const destinos = pestanas
      .map((p) => document.getElementById(p.target))
      .filter((el): el is HTMLElement => el !== null)
    if (destinos.length === 0) return
    const observador = new IntersectionObserver(
      (entradas) => {
        const visible = entradas
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiva(visible.target.id)
      },
      // Franja alta de la pantalla, bajo el encabezado: el bloque que entra ahí es el activo.
      { rootMargin: '-20% 0px -70% 0px' },
    )
    destinos.forEach((el) => observador.observe(el))
    return () => observador.disconnect()
  }, [pestanas])

  return (
    <nav
      aria-label="Secciones del producto"
      data-pestanas-ancla=""
      className={sticky ? 'sticky z-10' : undefined}
      style={sticky ? { top: 'var(--header-h, 0px)', backgroundColor: 'var(--background-color, #ffffff)' } : undefined}
    >
      <ul
        className="flex gap-6 overflow-x-auto border-b"
        style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)', scrollbarWidth: 'none' }}
      >
        {pestanas.map((p) => {
          const esActiva = p.target === activa
          return (
            <li key={p.target} className="flex-shrink-0">
              <a
                href={`#${p.target}`}
                aria-current={esActiva ? 'location' : undefined}
                className={`-mb-px inline-block border-b-2 py-3 text-sm transition-colors ${esActiva ? 'font-medium text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                style={esActiva ? { borderColor: primaryColor } : undefined}
                onClick={() => setActiva(p.target)}
              >
                {p.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
