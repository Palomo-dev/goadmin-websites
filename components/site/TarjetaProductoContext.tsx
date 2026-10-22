'use client'

/**
 * Estilo de tarjeta que viene del sitio (`tema.tarjetaProducto`). La sección
 * lo reemplaza con `content.product_card_style`. Sin ninguno, la tarjeta de hoy.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { resolverTarjetaProducto, type EstiloTarjetaProducto } from '@/lib/website/tarjetaProducto'

const TarjetaProductoSitio = createContext<unknown>(null)

export function TarjetaProductoProvider({ valor, children }: { valor: unknown; children: ReactNode }) {
  return <TarjetaProductoSitio.Provider value={valor ?? null}>{children}</TarjetaProductoSitio.Provider>
}

export function useEstiloTarjeta(seccion?: unknown): EstiloTarjetaProducto | null {
  return resolverTarjetaProducto(useContext(TarjetaProductoSitio), seccion)
}
