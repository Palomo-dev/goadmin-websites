'use client'

/**
 * Opciones de la tienda que leen piezas lejos de la cabecera: favoritos (`header_favoritos`) y el
 * botón «Comprar» de /carrito (`header_carrito`). Las pone OrganizationLayoutCliente con los
 * ajustes efectivos (y los vivos del editor en la vista previa). Sin proveedor, los valores por
 * defecto: la tienda de hoy.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { opcionesCarrito, opcionesFavoritos, type OpcionesCarrito, type OpcionesFavoritos } from '@/lib/website/v2/cabeceraTienda'

export interface ValorOpcionesTienda {
  favoritos: OpcionesFavoritos
  carrito: OpcionesCarrito
}

const POR_DEFECTO: ValorOpcionesTienda = { favoritos: opcionesFavoritos(null), carrito: opcionesCarrito(null) }

const Contexto = createContext<ValorOpcionesTienda>(POR_DEFECTO)

export function OpcionesTiendaProvider({ value, children }: { value: ValorOpcionesTienda; children: ReactNode }) {
  return <Contexto.Provider value={value}>{children}</Contexto.Provider>
}

export function useOpcionesTienda(): ValorOpcionesTienda {
  return useContext(Contexto)
}
