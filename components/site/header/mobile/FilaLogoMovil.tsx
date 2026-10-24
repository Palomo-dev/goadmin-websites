'use client'

import type { ReactNode } from 'react'
import { logoMovil, type AjustesLogo, type LadoLogo } from '@/lib/website/logoEncabezado'

/**
 * Fila del encabezado en el celular.
 * Izquierda (lo de hoy): logo | acciones y menú.
 * Centro: menú | logo | acciones.
 * Derecha: menú y acciones | logo.
 */
export function FilaLogoMovil({
  ajustes,
  posicion,
  logo,
  menu,
  acciones,
  minHeight,
}: {
  ajustes?: AjustesLogo | null
  posicion?: LadoLogo
  logo: ReactNode
  menu?: ReactNode
  acciones: ReactNode
  minHeight: number
}) {
  const lado = posicion ?? logoMovil(ajustes)
  const alto = { minHeight }

  if (lado === 'center') {
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2" style={alto}>
        <div className="justify-self-start">{menu}</div>
        <div className="justify-self-center">{logo}</div>
        <div className="flex items-center justify-end gap-2 justify-self-end">{acciones}</div>
      </div>
    )
  }

  if (lado === 'right') {
    return (
      <div className="flex items-center justify-between gap-2" style={alto}>
        <div className="flex items-center gap-2 flex-shrink-0">
          {menu}
          {acciones}
        </div>
        {logo}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2" style={alto}>
      {logo}
      <div className="flex items-center gap-2 flex-shrink-0">
        {acciones}
        {menu}
      </div>
    </div>
  )
}
