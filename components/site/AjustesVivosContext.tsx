'use client'

import { createContext, useContext } from 'react'

/** Ajustes del sitio que el editor manda en vivo. `null` fuera del preview. */
const AjustesVivosContext = createContext<Record<string, unknown> | null>(null)

export const AjustesVivosProvider = AjustesVivosContext.Provider

export function useAjustesVivosSitio(): Record<string, unknown> | null {
  return useContext(AjustesVivosContext)
}
