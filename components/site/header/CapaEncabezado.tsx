'use client'

/**
 * Capa de los menús y hojas que abre el encabezado (cajón lateral, pantalla completa, hoja
 * inferior, panel configurable, categorías de la píldora).
 *
 * Por qué existe (2026-11-25, captura del celular de una tienda con «Al bajar: encoger»): con la
 * página bajada, SiteHeader envuelve el encabezado en un contenedor con `scale-[0.98]` (y con
 * «ocultar», `-translate-y-full`). Un `transform` —igual que `filter`, `backdrop-filter`,
 * `will-change: transform` o `contain: paint`— en un ancestro vuelve a ese ancestro el bloque
 * contenedor de `position: fixed`. El cajón `fixed inset-0`, pintado dentro del <header>, quedaba
 * del tamaño del encabezado (~230 px): el panel «Menú» recortado, el fondo oscuro solo sobre la
 * cabecera (por eso se veía borrosa) y los productos debajo. Con «ocultar» se iba con él.
 *
 * La capa saca el contenido del encabezado con un portal a la raíz del sitio (`[data-raiz-sitio]`;
 * el body si no está): ningún ancestro la recorta y hereda lo mismo que heredaba de la raíz (modo
 * oscuro, variables y atributos del tema, fuente). Lo que heredaba del propio <header> va explícito,
 * para que el menú se vea igual que antes:
 *  - las variables del <header> (`--header-*`, `--mm-*`, `--hdr-*`) y su color (`variables`);
 *  - `data-capa-encabezado`: las reglas `header …` de app/globals.css que pintan el menú (tema V2,
 *    hover, superficies propias) se repiten para `[data-capa-encabezado] …`;
 *  - `data-hdr-bp`: con otro punto de corte (cssBreakpointHeader) lo `md:hidden` se sigue viendo.
 * La capa es `display: contents`: no crea caja; el contenido conserva su `fixed` y su z-index.
 *
 * Abierta: Esc cierra, el Tab no sale de la capa, al cerrar el foco vuelve al botón que la abrió
 * y el botón flotante del chat se oculta (`html[data-menu-movil-abierto]`), como con el carrito.
 *
 * Un buscador dentro del menú (barra del panel, pantalla de búsqueda) despliega sus sugerencias
 * dentro de la capa, como antes: la capa de desplegables de la cabecera (z 40) quedaría detrás del
 * menú (z 60). Por eso aquí se quita (ProveedorCapaDesplegables en null).
 *
 * No lo pintes dentro del <header> otra vez: scripts/verify-menu-fuera-del-encabezado.mjs lo impide.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ProveedorCapaDesplegables } from './PanelFlotanteEncabezado'

/** Evento con el que el menú inferior pide abrir el menú del encabezado, sin buscar su botón. */
export const EVENTO_ABRIR_MENU_MOVIL = 'gw:abrir-menu-movil'

/**
 * Pide al encabezado que abra su menú. `true` si un encabezado lo atendió; con `false` (plantilla
 * sin oyente) quien llama sigue con lo de antes (tocar el botón «Abrir menú» del encabezado).
 */
export function pedirAbrirMenuMovil(): boolean {
  if (typeof window === 'undefined') return false
  return !window.dispatchEvent(new Event(EVENTO_ABRIR_MENU_MOVIL, { cancelable: true }))
}

/** El encabezado abre su menú cuando el menú inferior lo pide (aunque su botón esté oculto). */
export function useAbrirMenuMovil(abrir: () => void, activo = true) {
  const ref = useRef(abrir)
  useEffect(() => {
    ref.current = abrir
  })
  useEffect(() => {
    if (!activo) return
    const oir = (e: Event) => {
      e.preventDefault()
      ref.current()
    }
    window.addEventListener(EVENTO_ABRIR_MENU_MOVIL, oir)
    return () => window.removeEventListener(EVENTO_ABRIR_MENU_MOVIL, oir)
  }, [activo])
}

/** Del estilo en línea del <header>, solo lo que se hereda: variables CSS y el color. */
export function soloVariables(estilo: CSSProperties | undefined): CSSProperties {
  const out: Record<string, unknown> = {}
  if (!estilo) return out as CSSProperties
  for (const [clave, valor] of Object.entries(estilo)) {
    if (valor === undefined || valor === null || valor === '') continue
    if (clave.startsWith('--') || clave === 'color') out[clave] = valor
  }
  return out as CSSProperties
}

const ENFOCABLES =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

function enfocables(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert]') && el.getClientRects().length > 0,
  )
}

// Varias capas abiertas a la vez (poco común): el atributo del chat se quita con la última.
let capasAbiertas = 0

export function CapaEncabezado({
  abierta,
  alCerrar,
  variables,
  retorno,
  gestionarFoco = true,
  comoEncabezado = true,
  persistente = false,
  refCapa,
  children,
}: {
  /** Menú abierto: activa Esc, foco y la ocultación del chat. */
  abierta: boolean
  alCerrar?: () => void
  /** Estilo en línea del <header> que la abre (se copian solo variables y color). */
  variables?: CSSProperties
  /** A dónde vuelve el foco si el que la abrió ya no está (el botón «Abrir menú» del encabezado). */
  retorno?: RefObject<HTMLElement | null>
  /** `false` cuando el contenido ya maneja Esc y foco (vaul, Radix). */
  gestionarFoco?: boolean
  /**
   * `false` para lo que ya iba fuera del <header> (panel configurable, buscador a pantalla
   * completa): sin variables ni reglas del encabezado, como hasta hoy.
   */
  comoEncabezado?: boolean
  /** Montada aunque esté cerrada (contenedor de un portal ajeno, p. ej. la hoja de vaul). */
  persistente?: boolean
  /** El elemento de la capa (para `container` de un portal ajeno). */
  refCapa?: (el: HTMLDivElement | null) => void
  children?: ReactNode
}) {
  // Sin portal hasta hidratar: el servidor no pinta la capa y el primer render del cliente tampoco.
  const [cliente, setCliente] = useState(false)
  useEffect(() => setCliente(true), [])
  const capaRef = useRef<HTMLDivElement | null>(null)
  const alCerrarRef = useRef(alCerrar)
  useEffect(() => {
    alCerrarRef.current = alCerrar
  })
  const fijarCapa = useCallback(
    (el: HTMLDivElement | null) => {
      capaRef.current = el
      refCapa?.(el)
    },
    [refCapa],
  )

  // Quién tenía el foco al abrir: se lee al pintar, antes de que un `autoFocus` de adentro lo mueva.
  const previoRef = useRef<HTMLElement | null | undefined>(undefined)
  if (abierta && cliente && previoRef.current === undefined && typeof document !== 'undefined') {
    previoRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  // El chat flotante (Shadow DOM con z-index máximo) no tapa el menú.
  useEffect(() => {
    if (!abierta || !cliente) return
    const raiz = document.documentElement
    capasAbiertas += 1
    raiz.setAttribute('data-menu-movil-abierto', '')
    return () => {
      capasAbiertas = Math.max(0, capasAbiertas - 1)
      if (capasAbiertas === 0) raiz.removeAttribute('data-menu-movil-abierto')
    }
  }, [abierta, cliente])

  useEffect(() => {
    if (!abierta || !cliente || !gestionarFoco) return
    const capa = capaRef.current
    const previo = previoRef.current
    // Foco inicial: lo que ya lo tomó adentro (autoFocus) se respeta; si no, [data-foco-inicial]
    // (el «Cerrar menú») o el primero que se pueda enfocar.
    const marco = requestAnimationFrame(() => {
      const c = capaRef.current
      if (!c || c.contains(document.activeElement)) return
      const inicial = c.querySelector<HTMLElement>('[data-foco-inicial]') ?? enfocables(c)[0]
      inicial?.focus({ preventScroll: true })
    })
    const alTeclado = (e: KeyboardEvent) => {
      const c = capaRef.current
      if (!c) return
      const objetivo = e.target instanceof Node ? e.target : null
      const dentro = !!objetivo && c.contains(objetivo)
      const sinFoco = !objetivo || objetivo === document.body || objetivo === document.documentElement
      // Otro diálogo encima (hoja de monedas, buscador, acceso a la cuenta): la tecla es suya.
      if (!dentro && !sinFoco) return
      if (e.key === 'Escape') {
        alCerrarRef.current?.()
        return
      }
      if (e.key !== 'Tab') return
      const lista = enfocables(c)
      if (!lista.length) {
        e.preventDefault()
        return
      }
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      const activo = document.activeElement
      const salir = e.shiftKey ? activo === primero || !c.contains(activo) : activo === ultimo || !c.contains(activo)
      if (salir) {
        e.preventDefault()
        ;(e.shiftKey ? ultimo : primero).focus()
      }
    }
    document.addEventListener('keydown', alTeclado)
    return () => {
      cancelAnimationFrame(marco)
      document.removeEventListener('keydown', alTeclado)
      // Al cerrar, el foco vuelve al que abrió (o al botón del encabezado), salvo que la persona
      // ya lo haya llevado a otra parte.
      const actual = document.activeElement
      const quedoAqui = !actual || actual === document.body || !actual.isConnected || !!capa?.contains(actual)
      if (!quedoAqui) return
      const volver = previo && previo !== document.body && previo.isConnected && !capa?.contains(previo) ? previo : retorno?.current
      volver?.focus({ preventScroll: true })
    }
    // `retorno` es un ref: su `.current` se lee al cerrar.
  }, [abierta, cliente, gestionarFoco])

  useEffect(() => {
    if (!abierta) previoRef.current = undefined
  }, [abierta])

  if (!cliente || !(abierta || persistente) || typeof document === 'undefined') return null
  const destino = document.querySelector<HTMLElement>('[data-raiz-sitio]') ?? document.body
  const puntoDeCorte = document.querySelector('[data-hdr-bp]')?.getAttribute('data-hdr-bp') ?? undefined
  return createPortal(
    <div
      ref={fijarCapa}
      className="contents"
      style={comoEncabezado ? soloVariables(variables) : undefined}
      data-capa-encabezado={comoEncabezado ? '' : undefined}
      data-capa-menu=""
      data-hdr-bp={puntoDeCorte}
    >
      <ProveedorCapaDesplegables value={null}>{children}</ProveedorCapaDesplegables>
    </div>,
    destino,
  )
}
