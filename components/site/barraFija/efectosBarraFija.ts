'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { barraDebeVerse, empujeChatBarra, type AparicionBarraFija } from '@/lib/website/v2/barraFija'

/**
 * Efectos de la barra fija de la ficha (Figma 2836:69391, propuesta 9): cuándo aparece, el chat
 * que sube sobre ella, la cabecera que se esconde («en lugar de la cabecera»), el vuelo al
 * carrito y la vibración. Las decisiones puras están en `lib/website/v2/barraFija.ts`.
 */

/** El botón «Agregar al carrito» de la ficha (BotonAccionFicha); sin él, el bloque de acciones. */
const SELECTOR_BOTON_FICHA = '#product-actions [data-accion-ficha="agregar"]'
const SELECTOR_BLOQUE_FICHA = '#product-actions'

/**
 * Si la barra se ve. `scroll` = hoy (más de 400 px). `pass` = cuando el botón de la ficha sale por
 * arriba de la pantalla (IntersectionObserver); sin botón, vuelve a los 400 px. `bajando` = el
 * último movimiento fue hacia abajo (lo usa «en lugar de la cabecera»).
 */
export function useVisibilidadBarra(aparece: AparicionBarraFija, activo = true): { visible: boolean; bajando: boolean } {
  const [visible, setVisible] = useState(false)
  const [bajando, setBajando] = useState(false)
  const botonPasado = useRef<boolean | null>(null)

  useEffect(() => {
    if (!activo) return
    let ultimoY = window.scrollY
    const recalcular = () => setVisible(barraDebeVerse(aparece, { scrollY: window.scrollY, botonPasado: botonPasado.current }))
    const handleScroll = () => {
      const y = window.scrollY
      // Unos px de margen: el rebote de iOS no cambia la dirección.
      if (Math.abs(y - ultimoY) > 4) {
        setBajando(y > ultimoY)
        ultimoY = y
      }
      recalcular()
    }
    let observador: IntersectionObserver | null = null
    if (aparece === 'pass' && typeof IntersectionObserver !== 'undefined') {
      const boton = document.querySelector(SELECTOR_BOTON_FICHA) ?? document.querySelector(SELECTOR_BLOQUE_FICHA)
      if (boton) {
        botonPasado.current = false
        observador = new IntersectionObserver(([entrada]) => {
          // Pasado = ya no se ve y quedó arriba (si está más abajo, todavía no se llegó a él).
          botonPasado.current = !entrada.isIntersecting && entrada.boundingClientRect.bottom <= 0
          recalcular()
        })
        observador.observe(boton)
      } else {
        botonPasado.current = null
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      observador?.disconnect()
    }
  }, [aparece, activo])

  return { visible, bajando }
}

// ─── Chat flotante ──────────────────────────────────────────────────────────────────────────

/** Variable con lo que sube la burbuja del chat (la lee el estilo inyectado en su Shadow DOM). */
const VARIABLE_EMPUJE = '--empuje-chat-barra-fija'
const ID_ESTILO_CHAT = 'barra-fija-empuje'
/** Cada barra abajo registra su empuje; manda el mayor. */
const empujes = new Map<string, number>()

/**
 * La burbuja del chat (supabase/functions/chat-widget del ERP, Shadow DOM abierto con z-index
 * máximo) sube sobre la barra con una regla dentro de su raíz que lee la variable. Las variables
 * CSS cruzan el Shadow DOM, así el widget no cambia. Si el chat está arriba, no se toca.
 */
function prepararChat() {
  const host = document.querySelector('[data-gochat-widget]') as HTMLElement | null
  const raiz = host?.shadowRoot
  if (!raiz || raiz.getElementById(ID_ESTILO_CHAT)) return
  const lanzador = raiz.querySelector('.gc-lanzador') as HTMLElement | null
  if (lanzador) {
    const r = lanzador.getBoundingClientRect()
    if (r.height > 0 && r.top + r.height / 2 < window.innerHeight / 2) return
  }
  const estilo = document.createElement('style')
  estilo.id = ID_ESTILO_CHAT
  estilo.textContent = `.gc-lanzador{translate:0 calc(-1 * var(${VARIABLE_EMPUJE}, 0px));transition:translate .3s ease,transform .15s ease}`
  raiz.appendChild(estilo)
}

function aplicarEmpuje() {
  const max = Math.max(0, ...empujes.values())
  const raiz = document.documentElement
  if (max > 0) {
    prepararChat()
    raiz.style.setProperty(VARIABLE_EMPUJE, `${max}px`)
  } else {
    raiz.style.removeProperty(VARIABLE_EMPUJE)
  }
}

/** Mientras la barra se ve abajo, el chat sube su alto + 12 px (B5); al irse, baja. */
export function useEmpujeChat(id: string, ref: RefObject<HTMLElement | null>, visible: boolean, abajo: boolean) {
  useEffect(() => {
    const medir = () => {
      const el = ref.current
      // Oculta por el punto de corte (lg:hidden / hidden lg:block): alto 0, no empuja.
      const alto = el && el.offsetHeight > 0 ? el.offsetHeight + (parseFloat(getComputedStyle(el).bottom) || 0) : 0
      empujes.set(id, empujeChatBarra(alto, visible, abajo))
      aplicarEmpuje()
    }
    medir()
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('resize', medir)
      empujes.delete(id)
      aplicarEmpuje()
    }
  }, [id, ref, visible, abajo])
}

// ─── «En lugar de la cabecera» ──────────────────────────────────────────────────────────────

/**
 * Esconde la cabecera del computador mientras la barra ocupa su lugar (regla en app/globals.css,
 * `html[data-barra-fija-cabecera]`). Al desmontar, la cabecera vuelve.
 */
export function useCabeceraEscondida(activo: boolean, oculta: boolean) {
  useEffect(() => {
    if (!activo) return
    const raiz = document.documentElement
    raiz.setAttribute('data-barra-fija-cabecera', oculta ? 'oculta' : 'visible')
  }, [activo, oculta])
  useEffect(() => {
    if (!activo) return
    return () => document.documentElement.removeAttribute('data-barra-fija-cabecera')
  }, [activo])
}

// ─── Al agregar ─────────────────────────────────────────────────────────────────────────────

/** Vibración suave en los teléfonos que la permiten. */
export function vibrarSuave() {
  try {
    navigator.vibrate?.(15)
  } catch {
    // Sin permiso o sin soporte: nada.
  }
}

/**
 * «Vuela al carrito» (B4): la miniatura sale del botón en arco hasta el ícono del carrito (600
 * ms) y el ícono late. Con «menos movimiento» o sin ícono a la vista, no vuela (queda el check).
 */
export function volarAlCarrito(desde: DOMRect, imagen: string | null, color: string) {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const destino = Array.from(document.querySelectorAll<HTMLElement>('[data-icono-carrito]'))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .find(({ r }) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight)
  if (!destino) return
  const lado = 44
  const x0 = desde.left + desde.width / 2
  const y0 = desde.top + desde.height / 2
  const dx = destino.r.left + destino.r.width / 2 - x0
  const dy = destino.r.top + destino.r.height / 2 - y0
  const nodo = document.createElement(imagen ? 'img' : 'span')
  if (imagen && nodo instanceof HTMLImageElement) {
    nodo.src = imagen
    nodo.alt = ''
  }
  nodo.setAttribute('aria-hidden', 'true')
  Object.assign(nodo.style, {
    position: 'fixed',
    left: `${x0 - lado / 2}px`,
    top: `${y0 - lado / 2}px`,
    width: `${lado}px`,
    height: `${lado}px`,
    borderRadius: '10px',
    objectFit: 'cover',
    background: imagen ? '#fff' : color,
    boxShadow: '0 4px 14px rgba(0,0,0,.2)',
    zIndex: '70',
    pointerEvents: 'none',
  })
  document.body.appendChild(nodo)
  const quitar = () => {
    nodo.remove()
    destino.e.classList.add('latido-carrito')
    window.setTimeout(() => destino.e.classList.remove('latido-carrito'), 400)
  }
  if (typeof nodo.animate !== 'function') {
    quitar()
    return
  }
  const animacion = nodo.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${Math.min(dy * 0.5, 0) - 90}px) scale(0.75)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.7 },
    ],
    { duration: 600, easing: 'cubic-bezier(.45,0,.55,1)' },
  )
  animacion.onfinish = quitar
  animacion.oncancel = quitar
}
