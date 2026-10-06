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

interface ValorRutaSitio {
  /** `''` o `'/sede-norte'`. */
  prefijo: string
  ruta: (path: string) => string
}

const SIN_PREFIJO: ValorRutaSitio = { prefijo: '', ruta: (path) => path }

const RutaSitioContext = createContext<ValorRutaSitio>(SIN_PREFIJO)

export function RutaSitioProvider({ prefijo, children }: { prefijo: string; children: React.ReactNode }) {
  const valor = useMemo<ValorRutaSitio>(
    () => (prefijo ? { prefijo, ruta: (path: string) => conPrefijo(path, prefijo) } : SIN_PREFIJO),
    [prefijo],
  )
  return <RutaSitioContext.Provider value={valor}>{children}</RutaSitioContext.Provider>
}

export function useRutaSitio(): ValorRutaSitio {
  return useContext(RutaSitioContext)
}
