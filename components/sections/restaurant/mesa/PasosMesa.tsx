'use client'

/**
 * Carta QR por pasos (Figma 2032:75742): en «modo mesa» la página muestra UN paso a la vez
 * (bienvenida, carta, pedido, estado, cuenta, pagar, valorar, horario). Mapa y reglas:
 * lib/restaurant/pasosMesa.ts.
 *
 * Todas las secciones quedan montadas y solo se ocultan (`hidden`) las que no son del paso: el
 * almacén de la mesa, el sondeo, la configuración del mesero y la ronda no se pierden ni se
 * vuelven a pedir al cambiar de paso. Los avisos y la hoja «Llamar al mesero» los pinta una
 * instancia propia de <AvisosMesa />, montada antes que las secciones, para que existan en
 * cualquier paso (también en la bienvenida, que no tiene la barra de la mesa).
 *
 * Cada paso arranca arriba, con un fundido corto (sin animación con prefers-reduced-motion).
 * En el lienzo del editor, el paso lo pide el editor (`goadmin:paso`, PreviewBridge).
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { EVENTO_PASO_LIENZO, useIsPreviewMode } from '@/components/sections/PreviewBridge'
import { usePasosMesa } from '@/components/site/PasosMesaContext'
import { atrasMesa, fijarPasoLienzo, iniciarPasosMesa } from '@/lib/restaurant/mesaStore'
import { pasoDeSeccion, pasosDeSeccion, pasosDisponibles, type PasoMesa } from '@/lib/restaurant/pasosMesa'
import { AvisosMesa } from './AvisosMesa'
import { EncabezadoPantalla } from './comun'

interface SeccionPaso {
  id: string
  section_type: string
  section_variant?: string | null
  is_visible?: boolean | null
  settings?: unknown
  content?: unknown
}

/**
 * Secciones de mesa que van pegadas a los bordes de su pantalla (lámina 02: la barra de la mesa
 * arriba del todo y la carta justo debajo). SectionWrapper ya las declara «sin relleno», pero
 * `ptMap.none` es '' y su `|| ptMap.lg` lo convertía en 48 px; corregirlo allí cambiaría todas
 * las secciones con relleno «none» de los 83 sitios, así que solo se corrige dentro de los pasos y
 * solo si el dueño no fijó el relleno en el editor.
 */
const PEGADAS: ReadonlySet<string> = new Set(['table_service', 'table_order', 'table_bill', 'visit_feedback', 'restaurant_hero:mesa', 'menu_full:qr'])
function pegada(s: SeccionPaso, lado: 'padding_top' | 'padding_bottom'): boolean {
  const c = s.content && typeof s.content === 'object' ? (s.content as Record<string, unknown>) : {}
  if (c[lado]) return false
  if (s.section_type === 'menu_full' && lado === 'padding_bottom') return false
  return PEGADAS.has(s.section_type) || PEGADAS.has(`${s.section_type}:${s.section_variant ?? ''}`)
}
const ESTILO_PEGADAS = `
[data-pasos-mesa] > [data-sin-relleno-arriba] > section[data-section-id] { padding-top: 0; }
[data-pasos-mesa] > [data-sin-relleno-abajo] > section[data-section-id] { padding-bottom: 0; }
`

export function PasosMesa<S extends SeccionPaso>({ sections, render }: { sections: S[]; render: (s: S) => ReactNode }) {
  const preview = useIsPreviewMode()
  const disponibles = useMemo(() => pasosDisponibles(sections), [sections])
  const { paso: pasoActual } = usePasosMesa()
  const paso: PasoMesa = pasoActual ?? 'bienvenida'
  const raiz = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    iniciarPasosMesa(disponibles, preview)
  }, [disponibles, preview])

  // Cada paso arranca arriba, con un fundido corto (solo opacidad: un `transform` en un ancestro
  // rompería las pantallas `fixed` de la mesa).
  const anterior = useRef(paso)
  useEffect(() => {
    if (anterior.current === paso) return
    anterior.current = paso
    window.scrollTo({ top: 0 })
    const el = raiz.current
    const reducido = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (el && !reducido && typeof el.animate === 'function') {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' })
    }
  }, [paso])

  // Lienzo del editor: «muéstrame el paso de esta sección» (encabezado y pie: la bienvenida).
  useEffect(() => {
    if (!preview) return
    const alPedir = (e: Event) => {
      const id = (e as CustomEvent<{ sectionId?: unknown }>).detail?.sectionId
      if (typeof id !== 'string') return
      const s = sections.find((x) => x.id === id)
      const destino = s ? pasoDeSeccion(s.section_type, s.section_variant) : pasoDeSeccion(id)
      if (destino !== anterior.current) {
        fijarPasoLienzo(destino)
      } else {
        // Mismo paso (la barra de la mesa y la carta): se lleva la sección a la vista.
        document.querySelector(`[data-section-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' })
      }
    }
    window.addEventListener(EVENTO_PASO_LIENZO, alPedir)
    return () => window.removeEventListener(EVENTO_PASO_LIENZO, alPedir)
  }, [preview, sections])

  return (
    <div ref={raiz} data-pasos-mesa="" data-paso-mesa={paso}>
      {/* CSS constante (sin datos de nadie): como HTML para que el `>` no se escape distinto en el servidor. */}
      <style dangerouslySetInnerHTML={{ __html: ESTILO_PEGADAS }} />
      <AvisosMesa />
      {paso === 'horario' && (
        <EncabezadoPantalla titulo="Horario y sedes" onAtras={() => atrasMesa(() => undefined)} />
      )}
      {sections.map((s) => {
        const activa = pasosDeSeccion(s.section_type, s.section_variant).includes(paso)
        return (
          <div
            key={s.id}
            hidden={!activa}
            data-paso-seccion={pasoDeSeccion(s.section_type, s.section_variant)}
            data-sin-relleno-arriba={pegada(s, 'padding_top') ? '' : undefined}
            data-sin-relleno-abajo={pegada(s, 'padding_bottom') ? '' : undefined}
          >
            {render(s)}
          </div>
        )
      })}
    </div>
  )
}
