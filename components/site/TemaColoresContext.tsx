'use client'

import { createContext, useContext } from 'react'

/**
 * ¿El sitio pinta con los colores del tema V2? Es lo mismo que `data-tema-colores` en la raíz
 * (OrganizationLayoutCliente), pero legible desde un componente: el texto del botón del encabezado
 * se calcula por contraste en JS, y eso el CSS no lo puede hacer.
 *
 * Por defecto `false`: fuera del layout, o en un sitio legacy, todo se pinta como antes.
 */
const TemaColoresContext = createContext(false)

export const TemaColoresProvider = TemaColoresContext.Provider

export function useTemaColores(): boolean {
  return useContext(TemaColoresContext)
}
