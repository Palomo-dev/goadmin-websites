'use client'

/**
 * Apariencia del buscador (`search_appearance` / `mobile_search_appearance`, Figma 3241:99000) para
 * el campo que abre la lupa (formas «Ícono» e «Ícono que abre el buscador encima»): el ícono suelto
 * sigue el estilo de «Íconos» y la apariencia aplica al campo que se abre y al desplegable.
 *
 * SiteHeader la provee ya resuelta para su dispositivo. Sin proveedor (o sin subclaves visuales)
 * el valor es `null` y ProductSearch pinta exactamente lo de hoy.
 */
import { createContext, useContext, type ReactNode } from 'react'
import {
  aparienciaActiva,
  aparienciaDeDispositivo,
  type AparienciaBuscador,
  type DispositivoBuscador,
} from '@/lib/website/v2/aparienciaBuscador'

export interface ValorAparienciaBuscador {
  apariencia: AparienciaBuscador
  dispositivo: DispositivoBuscador
}

const Contexto = createContext<ValorAparienciaBuscador | null>(null)

export function useAparienciaBuscador(): ValorAparienciaBuscador | null {
  return useContext(Contexto)
}

/** Sin apariencia guardada para el dispositivo devuelve los hijos tal cual (el árbol de hoy). */
export function ProveedorAparienciaBuscador({
  settings,
  dispositivo,
  children,
}: {
  settings: unknown
  dispositivo: DispositivoBuscador
  children: ReactNode
}) {
  const apariencia = aparienciaDeDispositivo(settings, dispositivo)
  if (!aparienciaActiva(apariencia)) return <>{children}</>
  return <Contexto.Provider value={{ apariencia, dispositivo }}>{children}</Contexto.Provider>
}
