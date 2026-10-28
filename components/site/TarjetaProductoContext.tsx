'use client'

/**
 * Estilo de tarjeta que viene del sitio (`tema.tarjetaProducto`). La sección
 * lo reemplaza con `content.product_card_style`. Sin ninguno, la tarjeta de hoy.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { resolverTarjetaProducto, vendidosEnTarjeta, etiquetasPropiasEnTarjeta, type EstiloTarjetaProducto } from '@/lib/website/tarjetaProducto'

const TarjetaProductoSitio = createContext<unknown>(null)

export function TarjetaProductoProvider({ valor, children }: { valor: unknown; children: ReactNode }) {
  return <TarjetaProductoSitio.Provider value={valor ?? null}>{children}</TarjetaProductoSitio.Provider>
}

export function useEstiloTarjeta(seccion?: unknown): EstiloTarjetaProducto | null {
  return resolverTarjetaProducto(useContext(TarjetaProductoSitio), seccion)
}

/** «Unidades vendidas» del estilo de tarjeta (sitio o sección). */
export function useVendidosTarjeta(seccion?: unknown): boolean {
  return vendidosEnTarjeta(useContext(TarjetaProductoSitio), seccion)
}

/** Etiquetas propias del estilo de tarjeta («Originales»…), en orden. Vacío = como hoy. */
export function useEtiquetasPropiasTarjeta(seccion?: unknown) {
  return etiquetasPropiasEnTarjeta(useContext(TarjetaProductoSitio), seccion)
}
