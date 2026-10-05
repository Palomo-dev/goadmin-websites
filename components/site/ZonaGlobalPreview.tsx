'use client'

import type { ReactNode } from 'react'
import { useIsPreviewMode } from '@/components/sections/PreviewBridge'

/**
 * Zona global (encabezado o pie) seleccionable desde el editor del ERP.
 *
 * Solo en modo preview (`?preview=1`): envuelve el encabezado o el pie en un
 * contenedor `display: contents` (no crea caja, así el `sticky` del encabezado
 * sigue funcionando) con `data-section-id="header"|"footer"`. El
 * `PreviewBridge` reconoce el clic y lo envía al editor por el mismo canal que
 * las secciones (`goadmin:select`). Fuera del preview devuelve los hijos tal
 * cual: ni un nodo ni un estilo de más.
 */
export type ZonaGlobal = 'header' | 'footer'

const ETIQUETA: Record<ZonaGlobal, string> = {
  header: 'Encabezado · global · clic en un enlace para editar el menú',
  footer: 'Pie de página · global · clic en un enlace para editar su menú',
}

// Contorno y etiqueta de la zona seleccionada. El encabezado ya es `sticky`
// (posicionado): la etiqueta se ancla a él. El pie se vuelve `relative` solo
// mientras está seleccionado y solo en el preview.
const ESTILOS = `
[data-goadmin-zona][data-goadmin-activa] > header,
[data-goadmin-zona][data-goadmin-activa] > footer {
  outline: 2px solid #4361ee;
  outline-offset: -2px;
}
[data-goadmin-zona="footer"][data-goadmin-activa] > footer { position: relative; }
[data-goadmin-zona][data-goadmin-activa] > header::before,
[data-goadmin-zona][data-goadmin-activa] > footer::before {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 60;
  padding: 2px 8px;
  border-radius: 0 0 6px 0;
  background: #4361ee;
  color: #fff;
  font: 500 12px/16px system-ui, sans-serif;
  pointer-events: none;
}
[data-goadmin-zona="header"][data-goadmin-activa] > header::before { content: "${ETIQUETA.header}"; }
[data-goadmin-zona="footer"][data-goadmin-activa] > footer::before { content: "${ETIQUETA.footer}"; }
`

export function ZonaGlobalPreview({ zona, children }: { zona: ZonaGlobal; children: ReactNode }) {
  const isPreview = useIsPreviewMode()
  if (!isPreview) return <>{children}</>
  return (
    <div data-section-id={zona} data-goadmin-zona={zona} style={{ display: 'contents' }}>
      {children}
      {/* Un solo bloque de estilos basta: lo pone el encabezado. Va después de
          los hijos para que el primer hijo siga siendo el <header> (el bridge
          desplaza hasta él). */}
      {zona === 'header' && <style>{ESTILOS}</style>}
    </div>
  )
}
