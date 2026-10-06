'use client'

/**
 * Prefijo de la sede de la petición para los componentes cliente que viven dentro
 * de `OrganizationLayout` (encabezado, pie, secciones, carrito).
 *
 *   const { ruta } = useRutaSitio()
 *   <Link href={ruta(`/productos/${id}`)} />
 *
 * Fuera del proveedor (o sin sede por prefijo) `ruta` devuelve la ruta tal cual.
 */

import { createContext, useContext, useMemo } from 'react'
import { conPrefijo } from './rutaSitio'
import type { HorarioSemana } from '@/lib/restaurant/horario'

interface ValorRutaSitio {
  /** `''` o `'/sede-norte'`. */
  prefijo: string
  ruta: (path: string) => string
  /**
   * Horario revisado de la sede de la página (o de la principal en restaurantes), el mismo
   * que pinta el pie. `null` → quien lo use cae a `website_settings.business_hours`.
   */
  horarioSede: HorarioSemana | null
}

const SIN_PREFIJO: ValorRutaSitio = { prefijo: '', ruta: (path) => path, horarioSede: null }

const RutaSitioContext = createContext<ValorRutaSitio>(SIN_PREFIJO)

export function RutaSitioProvider({
  prefijo,
  horarioSede = null,
  children,
}: {
  prefijo: string
  horarioSede?: HorarioSemana | null
  children: React.ReactNode
}) {
  const valor = useMemo<ValorRutaSitio>(
    () =>
      prefijo || horarioSede
        ? { prefijo, ruta: prefijo ? (path: string) => conPrefijo(path, prefijo) : (path: string) => path, horarioSede }
        : SIN_PREFIJO,
    [prefijo, horarioSede],
  )
  return <RutaSitioContext.Provider value={valor}>{children}</RutaSitioContext.Provider>
}

export function useRutaSitio(): ValorRutaSitio {
  return useContext(RutaSitioContext)
}
