'use client'

import { createContext, useContext } from 'react'
import { useMesaQRStore } from '@/lib/restaurant/mesaStore'
import type { PasoMesa } from '@/lib/restaurant/pasosMesa'

/**
 * Carta QR por pasos (lib/restaurant/pasosMesa.ts): lo que el servidor resolvió con `?paso=` y
 * las secciones de la página. Lo pone OrganizationLayoutCliente solo en «modo mesa»; así el
 * primer pintado (servidor e hidratación) ya muestra un solo paso, sin parpadeo. En el navegador
 * manda el almacén de la mesa en cuanto PasosMesa arranca.
 */
export interface PasosMesaServidor {
  inicial: PasoMesa
  pasos: PasoMesa[]
  mesero: boolean
}

const PasosMesaContext = createContext<PasosMesaServidor | null>(null)

export const PasosMesaProvider = PasosMesaContext.Provider

export interface PasosMesaActuales {
  /** `false` fuera de la Carta QR en modo mesa: todo como siempre. */
  activo: boolean
  paso: PasoMesa | null
  pasos: PasoMesa[]
  mesero: boolean
}

export function usePasosMesa(): PasosMesaActuales {
  const ctx = useContext(PasosMesaContext)
  const paso = useMesaQRStore((e) => e.paso)
  const disp = useMesaQRStore((e) => e.pasos)
  if (!ctx) return { activo: false, paso: null, pasos: [], mesero: false }
  return { activo: true, paso: paso ?? ctx.inicial, pasos: disp?.pasos ?? ctx.pasos, mesero: disp?.mesero ?? ctx.mesero }
}
