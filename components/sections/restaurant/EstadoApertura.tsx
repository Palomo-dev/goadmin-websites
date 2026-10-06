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
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ahoraEnZona, estadoApertura, type Apertura, type Dia, type HorarioSemana } from '@/lib/restaurant/horario'

export interface SedeConHorario {
  id: number
  horario: HorarioSemana | null
  zonaHoraria: string
}

export interface EstadoSede {
  apertura: Apertura | null
  hoy: Dia
}

/** Estado de cada sede, recalculado cada minuto. `null` antes del montaje. */
export function useEstadosEnVivo(sedes: SedeConHorario[]): Map<number, EstadoSede> | null {
  const [estados, setEstados] = useState<Map<number, EstadoSede> | null>(null)
  useEffect(() => {
    const calcular = () => {
      const m = new Map<number, EstadoSede>()
      for (const s of sedes) {
        const ahora = ahoraEnZona(s.zonaHoraria)
        m.set(s.id, { apertura: estadoApertura(s.horario, ahora), hoy: ahora.dia })
      }
      setEstados(m)
    }
    calcular()
    const id = window.setInterval(calcular, 60_000)
    return () => window.clearInterval(id)
  }, [sedes])
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
