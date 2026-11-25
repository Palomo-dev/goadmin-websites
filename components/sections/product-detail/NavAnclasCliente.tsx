'use client'

/**
 * Pestañas ancla de la ficha (parte de navegador de NavAnclas). Son enlaces `#tipo` que saltan a
 * cada bloque (diseño aprobado: «pestañas fijas que saltan a cada bloque de la ficha»); sin
 * JavaScript siguen funcionando como enlaces. Por eso la semántica es de navegación (`nav` +
 * `aria-current`), no `tablist`: no esconden ni cambian contenido, llevan a él.
 *
 * Arreglo 2026-11-25 (el dueño: «clic en Envío, la pestaña se marca pero el contenido no
 * cambia»). En la plantilla Panorama «Resumen» y «Envío» van ENCIMA de las pestañas: el salto del
 * navegador subía poco o nada (en pantalla alta el bloque ya estaba a la vista) y debajo de las
 * pestañas seguía la descripción. Ahora, con JavaScript:
 * - El salto lo hace este componente: deja el bloque justo debajo del encabezado y, si va
 *   después de las pestañas (que quedan pegadas encima), también debajo de ellas.
 * - El bloque destino se resalta un momento con el color del sitio y recibe el foco (teclado y
 *   lectores de pantalla saben a dónde llegaron).
 * - La pestaña tocada queda marcada durante el salto: el observador no la pisa a medio camino.
 * - Las pestañas cuyo bloque no pinta nada (sin datos u oculto en este dispositivo) no se ven.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { MS_RESALTE_ANCLA, destinoSaltoAncla, pestanaActivaValida, pestanasConContenido } from './anclasFicha'

interface Pestana {
  label: string
  target: string
}

/** Alto del encabezado fijo del sitio; el mismo respaldo que el `scroll-mt` de los destinos. */
function alturaEncabezado(el: Element): number {
  const valor = Number.parseFloat(getComputedStyle(el).getPropertyValue('--header-h'))
  return Number.isFinite(valor) ? valor : 72
}

function sinMovimiento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function NavAnclasCliente({ pestanas, sticky, primaryColor }: { pestanas: Pestana[]; sticky: boolean; primaryColor: string }) {
  const navRef = useRef<HTMLElement | null>(null)
  const [activa, setActiva] = useState(pestanas[0]?.target ?? '')
  /** Por destino: ¿pinta algo? `null` hasta medir (servidor y primer render: todas). */
  const [conContenido, setConContenido] = useState<Record<string, boolean> | null>(null)
  /** Hasta cuándo manda la pestaña tocada sobre el observador (salto en curso). */
  const saltoHasta = useRef(0)
  const resalte = useRef<{ el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null>(null)

  const visibles = useMemo(() => pestanasConContenido(pestanas, conContenido), [pestanas, conContenido])
  const marcada = pestanaActivaValida(activa, visibles)

  // Qué destinos pintan algo: al montar y cada vez que uno cambia de alto (variantes, «Ver más»,
  // reseñas que llegan, visibilidad por dispositivo al girar o cambiar el ancho).
  useEffect(() => {
    const medir = () => {
      const siguiente: Record<string, boolean> = {}
      for (const p of pestanas) {
        const el = document.getElementById(p.target)
        siguiente[p.target] = !!el && el.getBoundingClientRect().height > 0
      }
      setConContenido((previo) => {
        if (previo && pestanas.every((p) => previo[p.target] === siguiente[p.target])) return previo
        return siguiente
      })
    }
    medir()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const observador = new ResizeObserver(medir)
    for (const p of pestanas) {
      const el = document.getElementById(p.target)
      if (el) observador.observe(el)
    }
    return () => observador.disconnect()
  }, [pestanas])

  // Llegada con `#destino` en la dirección: esa pestaña marcada.
  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1))
    if (hash && pestanas.some((p) => p.target === hash)) setActiva(hash)
  }, [pestanas])

  // Al desplazarse, se marca la pestaña del bloque que entra en la franja alta de la pantalla.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const destinos = visibles
      .map((p) => document.getElementById(p.target))
      .filter((el): el is HTMLElement => el !== null)
    if (destinos.length === 0) return
    const observador = new IntersectionObserver(
      (entradas) => {
        if (Date.now() < saltoHasta.current) return
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
  }, [visibles])

  // Sin resaltes colgados al salir de la ficha.
  useEffect(() => () => {
    if (resalte.current) clearTimeout(resalte.current.timer)
  }, [])

  const resaltar = useCallback((el: HTMLElement) => {
    if (resalte.current) {
      clearTimeout(resalte.current.timer)
      resalte.current.el.style.outline = ''
      resalte.current.el.style.outlineOffset = ''
    }
    el.style.outline = `2px solid ${primaryColor}`
    el.style.outlineOffset = '6px'
    const timer = setTimeout(() => {
      el.style.outline = ''
      el.style.outlineOffset = ''
      resalte.current = null
    }, MS_RESALTE_ANCLA)
    resalte.current = { el, timer }
  }, [primaryColor])

  const saltar = useCallback((evento: MouseEvent<HTMLAnchorElement>, target: string) => {
    // Clic con modificadores (abrir en otra pestaña…): lo de siempre del navegador.
    if (evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return
    const destino = document.getElementById(target)
    const nav = navRef.current
    setActiva(target)
    if (!destino || !nav) return // Sin destino, el enlace `#tipo` hace lo suyo.
    evento.preventDefault()
    const contenedor = nav.parentElement
    const pestanasEncima = sticky
      && !!contenedor?.contains(destino)
      && (nav.compareDocumentPosition(destino) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    const top = destinoSaltoAncla({
      topDestino: destino.getBoundingClientRect().top,
      scrollY: window.scrollY,
      alturaEncabezado: alturaEncabezado(nav),
      alturaPestanas: nav.getBoundingClientRect().height,
      pestanasEncima,
    })
    const suave = !sinMovimiento()
    saltoHasta.current = Date.now() + (suave ? 1000 : 150)
    window.scrollTo({ top, behavior: suave ? 'smooth' : 'auto' })
    // La dirección queda con `#destino` (enlace para compartir) sin el salto propio del navegador.
    // Se conserva el estado del historial: el router de Next guarda el suyo ahí.
    try {
      window.history.replaceState(window.history.state, '', `#${target}`)
    } catch {
      /* sin historial (vista previa embebida): el salto ya se hizo */
    }
    if (!destino.hasAttribute('tabindex')) destino.setAttribute('tabindex', '-1')
    destino.focus({ preventScroll: true })
    resaltar(destino)
  }, [sticky, resaltar])

  if (visibles.length === 0) return null

  return (
    <nav
      ref={navRef}
      aria-label="Secciones del producto"
      data-pestanas-ancla=""
      className={sticky ? 'sticky z-10' : undefined}
      style={sticky ? { top: 'var(--header-h, 0px)', backgroundColor: 'var(--background-color, #ffffff)' } : undefined}
    >
      <ul
        className="flex gap-6 overflow-x-auto border-b"
        style={{ borderColor: 'color-mix(in srgb, var(--text-color, #111827) 12%, transparent)', scrollbarWidth: 'none' }}
      >
        {visibles.map((p) => {
          const esActiva = p.target === marcada
          return (
            <li key={p.target} className="flex-shrink-0">
              <a
                href={`#${p.target}`}
                aria-current={esActiva ? 'location' : undefined}
                className={`-mb-px inline-block border-b-2 py-3 text-sm transition-colors ${esActiva ? 'font-medium text-gray-900 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}`}
                style={esActiva ? { borderColor: primaryColor } : undefined}
                onClick={(e) => saltar(e, p.target)}
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
