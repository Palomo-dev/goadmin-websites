'use client'

import { createContext, useContext } from 'react'

/**
 * ¿El layout pinta la página en «modo mesa» (Carta QR, lib/restaurant/modoMesa.ts)? Lo pone
 * OrganizationLayoutCliente; lo leen las piezas que en la mesa no van (la franja «Pides en Mesa N»
 * de la carta). Por defecto `false`: fuera del layout o en cualquier otra página, como siempre.
 */
const ModoMesaContext = createContext(false)

export const ModoMesaProvider = ModoMesaContext.Provider

export function useModoMesa(): boolean {
  return useContext(ModoMesaContext)
}
