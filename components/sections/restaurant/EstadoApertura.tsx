'use client'

/**
 * Estado «Abierto ahora / Cierra a las …» de una o varias sedes, en vivo.
 *
 * Lo comparten `hours_location` (una tarjeta por sede) y `restaurant_hero`
 * (la sede de la página o la principal). El cálculo es `estadoApertura` de
 * lib/restaurant/horario.ts sobre el horario de la sede (`branches.opening_hours`)
 * en SU zona horaria; aquí solo se recalcula cada minuto y se pinta el badge.
 *
 * Hasta el montaje no hay estado (`null`): el HTML del servidor puede venir de
 * caché y no debe mostrar un «Abierto» viejo.
 *
 * Horario sin revisar (el valor por defecto del formulario de Sucursales del ERP,
 * 76 de 80 sedes el 2026-10-06): no hay estado. Pintar «Cerrado» a las 19:00 en un
 * restaurante que abre hasta las 23:00 espanta al cliente; mejor no decir nada.
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { ahoraEnZona, estadoApertura, horarioRevisado, type Apertura, type Dia, type HorarioSemana } from '@/lib/restaurant/horario'

export interface SedeConHorario {
  id: number
  horario: HorarioSemana | null
  zonaHoraria: string
}

export interface EstadoSede {
  apertura: Apertura | null
  hoy: Dia
}

/**
 * Firma del contenido de las sedes (id, zona y horario). El efecto depende de ESTO y no de la
 * identidad del arreglo: quien llama con `[sede]` armado en cada render (la bienvenida de la
 * Carta QR) provocaba un bucle sin fin (efecto → setEstados → render → arreglo nuevo → efecto),
 * miles de renders por segundo que en un iPhone dejaban la Carta QR sin responder.
 */
export function firmaSedesConHorario(sedes: readonly SedeConHorario[]): string {
  return sedes.map((s) => `${s.id}|${s.zonaHoraria}|${JSON.stringify(s.horario ?? null)}`).join(';')
}

/** Estado de cada sede, recalculado cada minuto. `null` antes del montaje. */
export function useEstadosEnVivo(sedes: SedeConHorario[]): Map<number, EstadoSede> | null {
  const [estados, setEstados] = useState<Map<number, EstadoSede> | null>(null)
  const firma = firmaSedesConHorario(sedes)
  const sedesRef = useRef(sedes)
  sedesRef.current = sedes
  useEffect(() => {
    let previa = ''
    const calcular = () => {
      const m = new Map<number, EstadoSede>()
      for (const s of sedesRef.current) {
        const ahora = ahoraEnZona(s.zonaHoraria)
        m.set(s.id, { apertura: estadoApertura(horarioRevisado(s.horario), ahora), hoy: ahora.dia })
      }
      // Cada minuto solo hay render si el estado cambió («Abierto» → «Cierra pronto»…).
      const serie = JSON.stringify([...m])
      if (serie === previa) return
      previa = serie
      setEstados(m)
    }
    calcular()
    const id = window.setInterval(calcular, 60_000)
    return () => window.clearInterval(id)
  }, [firma])
  return estados
}

const BADGE: Record<Apertura['estado'], { fondo: string; texto: string; punto: string }> = {
  open: {
    fondo: 'bg-green-50 dark:bg-green-900/30',
    texto: 'text-green-700 dark:text-green-300',
    punto: 'bg-green-600 dark:bg-green-400',
  },
  closing_soon: {
    fondo: 'bg-amber-50 dark:bg-amber-900/30',
    texto: 'text-amber-700 dark:text-amber-300',
    punto: 'bg-amber-500',
  },
  closed: {
    fondo: 'bg-red-50 dark:bg-red-900/30',
    texto: 'text-red-700 dark:text-red-300',
    punto: 'bg-red-600 dark:bg-red-400',
  },
}

export function OpenStatusBadge({ apertura, className }: { apertura: Apertura; className?: string }) {
  const c = BADGE[apertura.estado]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1', c.fondo, className)}>
      <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', c.punto, apertura.estado !== 'closed' && 'motion-safe:animate-pulse')} />
      <span className={cn('text-xs font-medium leading-4', c.texto)}>{apertura.texto}</span>
    </span>
  )
}
