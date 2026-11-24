'use client'

/**
 * Página de categoría en el lienzo del editor del ERP (`?preview=1`): las secciones de la
 * plantilla envueltas en `PreviewBridge`, como las demás páginas. Los cambios llegan por
 * `goadmin:preview` y se pintan sin recargar el iframe (antes el editor lo recargaba entero tras
 * cada guardado).
 *
 * Los datos (categoría, productos, subcategorías, hermanas de la columna lateral) llegan ya
 * resueltos del servidor. Sin secciones, `respaldo`: el layout de siempre, pintado en el servidor.
 */
import type { ReactNode } from 'react'
import { PreviewBridge } from '@/components/sections/PreviewBridge'
import type { OrganizationWithDetails, WebsitePageSection } from '@/types/database'
import { SeccionesCategoria } from './SeccionesCategoria'
import type { NodoCategoria } from './columnasCategoria'

interface CategoriaEnVivoProps {
  inicial: WebsitePageSection[]
  organization: OrganizationWithDetails
  primaryColor: string
  sectionData: Record<string, any>
  hermanas: NodoCategoria[]
  respaldo: ReactNode
}

export function CategoriaEnVivo({ inicial, organization, primaryColor, sectionData, hermanas, respaldo }: CategoriaEnVivoProps) {
  return (
    <PreviewBridge initialSections={inicial}>
      {(vivas) =>
        vivas.length > 0 ? (
          <SeccionesCategoria
            secciones={vivas}
            organization={organization}
            primaryColor={primaryColor}
            sectionData={sectionData}
            hermanas={hermanas}
          />
        ) : (
          respaldo
        )
      }
    </PreviewBridge>
  )
}
