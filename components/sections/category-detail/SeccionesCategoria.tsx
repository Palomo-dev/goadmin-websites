/**
 * Secciones de la plantilla `category_detail` (F9.4 + plantillas de tienda): apiladas o, con una
 * sección VISIBLE `category_filters · sidebar_facets`, con la columna lateral a la izquierda y
 * el listado a la derecha (`planColumnasCategoria`).
 *
 * Síncrono y sin consultas: lo pintan `CategoryDetailRenderer` (servidor, la página pública) y
 * `CategoriaEnVivo` (cliente, el lienzo del editor con las secciones en vivo). Las categorías
 * hermanas de la columna lateral llegan ya resueltas (`hermanas`).
 */
import { SectionRenderer, SECTION_MAP } from '@/components/sections/SectionRenderer'
import type { OrganizationWithDetails, WebsitePageSection } from '@/types/database'
import { planColumnasCategoria, VARIANTE_FILTROS_LATERALES, type NodoCategoria } from './columnasCategoria'
import { normalizarOrdenFiltrosCategoria } from '@/lib/website/v2/contrato/seccionesTienda'

/**
 * Datos de las secciones según la plantilla (Figma «16 Sitio web», bloque 6): las opciones de orden
 * del bloque de filtros (las usa también la columna lateral) y si el encabezado ya muestra
 * «N productos» (entonces la barra de filtros no lo repite).
 */
function datosDeSecciones(secciones: readonly WebsitePageSection[], sectionData: Record<string, any>): Record<string, any> {
  const visible = (tipo: string) => secciones.find((s) => s.section_type === tipo && s.is_visible !== false)
  const filtros = visible('category_filters')
  const encabezado = visible('category_header')
  return {
    ...sectionData,
    ordenesCategoria: normalizarOrdenFiltrosCategoria((filtros?.content ?? null) as Record<string, unknown> | null).ordenes,
    conteoEnEncabezado: Boolean(encabezado) && (encabezado?.content as Record<string, unknown> | null)?.show_count !== false,
  }
}

/**
 * Los filtros de siempre en «Columna lateral» (`filter_position: 'sidebar'`) se pintan con la
 * misma columna de `sidebar_facets`: subcategorías con casilla y el orden (si está encendido).
 */
function comoColumnaLateral(s: WebsitePageSection): WebsitePageSection {
  if (s.section_variant === VARIANTE_FILTROS_LATERALES) return s
  const c = (s.content ?? {}) as Record<string, unknown>
  return { ...s, section_variant: VARIANTE_FILTROS_LATERALES, content: { ...c, show_subcategories: true, show_sort: c.show_sort !== false } }
}

/** ¿Estas secciones arman la columna lateral? (entonces hacen falta las categorías hermanas). */
export function usaColumnaLateral(secciones: readonly WebsitePageSection[]): boolean {
  return planColumnasCategoria(secciones, Boolean(SECTION_MAP.category_filters?.[VARIANTE_FILTROS_LATERALES])) !== null
}

interface SeccionesCategoriaProps {
  secciones: readonly WebsitePageSection[]
  organization: OrganizationWithDetails
  primaryColor: string
  sectionData: Record<string, any>
  /** Categorías hermanas de la columna lateral; `null` si no se leyeron (sin columna lateral). */
  hermanas: NodoCategoria[] | null
}

export function SeccionesCategoria({ secciones, organization, primaryColor, sectionData: datosBase, hermanas }: SeccionesCategoriaProps) {
  const sectionData = datosDeSecciones(secciones, datosBase)
  const esPrimera = (i: number) => i === 0 || secciones.slice(0, i).every((s) => s.is_visible === false)
  const plan = planColumnasCategoria(secciones, Boolean(SECTION_MAP.category_filters?.[VARIANTE_FILTROS_LATERALES]))

  // ---- Modo plantilla con columna lateral (solo plantillas de tienda) ----
  if (plan) {
    const dataLateral = { ...sectionData, categoriasHermanas: hermanas ?? [] }
    return (
      <div className="container mx-auto px-4 py-8">
        {plan.map((bloque) => bloque.tipo === 'seccion' ? (
          <SectionRenderer
            key={bloque.seccion.id}
            section={bloque.seccion}
            organization={organization}
            primaryColor={primaryColor}
            data={sectionData}
            isFirst={esPrimera(bloque.indice)}
          />
        ) : (
          <div key={`columnas-${bloque.lateral.id}`} className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12">
            <div className="min-w-0">
              <SectionRenderer
                section={comoColumnaLateral(bloque.lateral)}
                organization={organization}
                primaryColor={primaryColor}
                data={dataLateral}
                isFirst={esPrimera(bloque.indiceLateral)}
              />
            </div>
            <div className="min-w-0">
              {bloque.principal.map(({ seccion, indice }) => (
                <SectionRenderer
                  key={seccion.id}
                  section={seccion}
                  organization={organization}
                  primaryColor={primaryColor}
                  data={sectionData}
                  isFirst={esPrimera(indice)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ---- Modo plantilla: secciones apiladas ----
  return (
    <div className="container mx-auto px-4 py-8">
      {secciones.map((section, i) => (
        <SectionRenderer
          key={section.id}
          section={section}
          organization={organization}
          primaryColor={primaryColor}
          data={sectionData}
          isFirst={esPrimera(i)}
        />
      ))}
    </div>
  )
}
