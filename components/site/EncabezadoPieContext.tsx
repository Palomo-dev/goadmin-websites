'use client'

/**
 * Opciones del encabezado y del pie por plantilla + los datos que resolvió el servidor
 * (lib/website/extrasEncabezadoPie.server.ts), al alcance de las variantes de encabezado, de la
 * barra móvil y del pie sin pasar props por cada una.
 *
 * Sin proveedor (una página que no monta OrganizationLayout, o el valor por defecto) todas las
 * opciones valen su default: el sitio de hoy.
 */
import { createContext, useContext } from 'react'
import type { SedeSelector } from './header/SelectorSede'
import {
  EXTRAS_VACIOS,
  opcionesEncabezadoPie,
  type ExtrasEncabezadoPie,
  type OpcionesEncabezadoPie,
} from '@/lib/website/encabezadoPie'

export interface SelectorEnEncabezado {
  sedes: SedeSelector[]
  actualId: number | null
  subdomain: string
  prefijoActual: string
  hrefTodas: string | null
}

export interface ValorEncabezadoPie {
  opciones: OpcionesEncabezadoPie
  extras: ExtrasEncabezadoPie
  /** Selector de sede para pintar DENTRO del encabezado; `null` si va en la franja (hoy) o hay < 2 sedes. */
  selector: SelectorEnEncabezado | null
  /** Giro de la organización (`organizations.type_id`). */
  tipo: number | null
}

export const VALOR_POR_DEFECTO: ValorEncabezadoPie = {
  opciones: opcionesEncabezadoPie(null),
  extras: EXTRAS_VACIOS,
  selector: null,
  tipo: null,
}

const Contexto = createContext<ValorEncabezadoPie>(VALOR_POR_DEFECTO)

export const EncabezadoPieProvider = Contexto.Provider

export function useEncabezadoPie(): ValorEncabezadoPie {
  return useContext(Contexto)
}
