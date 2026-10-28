'use client'

import type { ReactNode } from 'react'
import { logoMovil, type AjustesLogo, type LadoLogo } from '@/lib/website/logoEncabezado'
import { ordenMovil } from '@/lib/website/menuMovil'

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
  const orden = ordenMovil(ajustes)
  const logoAlineado = <div className={lado === 'center' ? 'flex justify-center' : lado === 'right' ? 'flex justify-end' : 'flex justify-start'}>{logo}</div>

  // Orden elegido en «Celular» (sin clave, las filas de siempre de abajo).
  if (orden === 'menu-logo-acciones') {
    return <div className="flex w-full items-center gap-2" style={alto}>{menu}<div className="min-w-0 flex-1">{logoAlineado}</div><div className="flex items-center gap-2 flex-shrink-0">{acciones}</div></div>
  }
  if (orden === 'logo-sobre-acciones' || orden === 'acciones-sobre-logo') {
    const filaAcciones = <div className="flex items-center justify-between gap-2">{menu}<div className="flex items-center gap-2">{acciones}</div></div>
    return (
      <div className="flex w-full flex-col justify-center gap-2 py-2" style={alto}>
        {orden === 'logo-sobre-acciones' ? <>{logoAlineado}{filaAcciones}</> : <>{filaAcciones}{logoAlineado}</>}
      </div>
    )
  }

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
