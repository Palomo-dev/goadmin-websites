'use client'

/**
 * Capa para lo que va fijo a la pantalla (barra inferior del celular) y se pinta desde el
 * encabezado.
 *
 * Con «Al bajar» activo (`header_scroll`), SiteHeader envuelve el encabezado en un contenedor que
 * se mueve con `-translate-y-full` (ocultar) o `scale-[0.98]` (encoger). Un `transform` en un
 * ancestro vuelve a ese ancestro el «containing block» de `position: fixed`: la barra inferior
 * subía con el encabezado y desaparecía. SiteHeader deja entonces, como hermana del envoltorio
 * (mismo padre, así hereda las mismas variables y la misma fuente), una capa sin caja
 * (`display: contents`), y `FueraDelEncabezado` pinta ahí su contenido con un portal.
 *
 * Sin «Al bajar» no hay capa y el contenido se pinta donde siempre: el árbol de hoy.
 */
import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const CapaFija = createContext<HTMLElement | null>(null)

export const ProveedorCapaFija = CapaFija.Provider

export function FueraDelEncabezado({ children }: { children: ReactNode }) {
  const capa = useContext(CapaFija)
  return capa ? createPortal(children, capa) : <>{children}</>
}
