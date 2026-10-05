/**
 * Adaptador PÚBLICO del documento de sitio V2 a las formas que ya pinta el sitio
 * (`WebsiteSettings`, `WebsitePageWithSections`, `WebsiteMenuWithItems`).
 *
 * Código puro: sin Supabase ni Next. Lo usa `lectorPublico.ts` solo cuando el sitio tiene
 * `v2_adopted = true`; el resto de sitios no pasa por aquí.
 *
 * Herencia de sede (ADR-002 D6): la MISMA regla que el ERP. `ajustesPublicosDesdeDocumento`
 * reproduce `ajustesDesdeDocumento` de go-admin-erp/src/lib/website/v2/vistaEditor.ts (commit
 * e80e9706) sobre los tipos de este repo, y resuelve cada campo con `resolverCampo` del contrato
 * copiado. No se reinventa: si la regla cambia en el ERP, se vuelve a copiar.
 *
 * Plantillas: el importador del ERP renombra `__product_detail` → `plantillas/product-detail`
 * (`normalizarSlug`, copiada abajo). Se buscan por `tipo` (se conserva `page_type`) y, si hay
 * varias, por ese slug canónico. Nunca se sirven como ruta pública.
 */
import { resolverCampo, LIMITES_DOCUMENTO, type DocumentoSitio, type ItemMenu, type MenuSitio, type PaginaSitio } from './contrato/documentoSitio'
import { CAMPOS_HEREDABLES, COLUMNAS_SHELL_ESTRUCTURA, OPCIONES_SHELL, esVacio } from './mapeoAjustes'
import { leerCampo, structuredCloneSeguro, valorPropioDe } from './rutasDocumento'
import type {
  WebsiteMenuItemWithChildren,
  WebsiteMenuWithItems,
  WebsitePageSection,
  WebsitePageWithSections,
  WebsiteSettings,
} from '@/types/database'

/** Prefijo de las plantillas de detalle en el documento V2. */
export const PREFIJO_PLANTILLAS = 'plantillas/'

/** Id del menú que el importador deriva de `show_in_footer` (importadorLegacy.ts). */
export const MENU_PAGINAS_PIE = 'paginas-pie'

/**
 * ORIGEN: copia literal de `normalizarSlug` en go-admin-erp/src/lib/website/v2/importadorLegacy.ts
 * (commit e80e9706). Convierte un slug legacy (`__product_detail`) al del documento.
 */
export function normalizarSlug(slug: string): string {
  const crudo = (slug ?? '').trim().toLowerCase()
  const esPlantilla = crudo.startsWith('__')
  const limpio = crudo
    .split('/')
    .map((parte) =>
      parte
        .replace(/_/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('/')
  const conPrefijo = esPlantilla && limpio ? `plantillas/${limpio}` : limpio
  return conPrefijo.slice(0, LIMITES_DOCUMENTO.longitudSlug).replace(/[-/]+$/g, '')
}

// ─── Ajustes ──────────────────────────────────────────────────────────────────────────────────

/** Base contra la que hereda un sitio de sede. */
export interface BaseHerencia {
  /** Revisión publicada del principal; `null` si el principal no tiene ninguna. */
  documento: DocumentoSitio | null
  /** Fila legacy del principal: de aquí hereda la sede cuando `documento` es `null`. */
  ajustesLegacy: WebsiteSettings | null
}

/**
 * Ajustes efectivos de un sitio V2.
 * - Columnas con destino en el documento: salen del documento (resueltas contra el principal si
 *   es una sede).
 * - El resto (operación, integraciones, columnas sin efecto, D12): de la fila legacy `base`, que
 *   sigue siendo su fuente.
 *
 * @param principal `null` para el sitio principal; la base de herencia para una sede.
 */
export function ajustesPublicosDesdeDocumento(
  documento: DocumentoSitio,
  base: WebsiteSettings | null,
  principal: BaseHerencia | null,
): WebsiteSettings {
  const ajustes = { ...(base ?? {}) } as unknown as Record<string, unknown>
  const legacyPrincipal = (principal?.ajustesLegacy ?? null) as unknown as Record<string, unknown> | null

  for (const campo of CAMPOS_HEREDABLES) {
    const propio = leerCampo(documento, campo.ruta)
    let valor: unknown
    if (principal) {
      const valorPrincipal = principal.documento
        ? valorPropioDe(principal.documento, campo.ruta)
        : (() => {
            const v = legacyPrincipal?.[campo.columna]
            return esVacio(v) ? null : v
          })()
      valor = resolverCampo<unknown>(valorPrincipal, propio)
    } else {
      valor = propio && propio.mode === 'value' ? propio.value : null
    }
    ajustes[campo.columna] = valor ?? campo.porDefecto ?? null
  }

  const { header, footer } = documento.shell
  ajustes.header_style = header.composicion || COLUMNAS_SHELL_ESTRUCTURA.header_style.porDefecto
  ajustes.footer_style = footer.composicion || COLUMNAS_SHELL_ESTRUCTURA.footer_style.porDefecto
  // Ids de menús del DOCUMENTO, no de website_menus: el lector V2 no los busca en la tabla.
  ajustes.header_menu_id = header.menuPrincipalId ?? null
  ajustes.header_mega_menu_id = header.menuMegaId ?? null
  for (const [columna, def] of Object.entries(OPCIONES_SHELL)) {
    const opciones = def.zona === 'header' ? header.opciones : footer.opciones
    ajustes[columna] = columna in (opciones ?? {}) ? structuredCloneSeguro(opciones[columna]) : def.porDefecto
  }
  return ajustes as unknown as WebsiteSettings
}

// ─── Páginas ──────────────────────────────────────────────────────────────────────────────────

export interface ContextoPublico {
  organizationId: number
  /** `null` = sitio principal. */
  branchId: number | null
}

function textoSeo(campo: { mode: string; value?: unknown } | undefined): string | null {
  return campo && campo.mode === 'value' && typeof campo.value === 'string' ? campo.value : null
}

/** Página del documento con sus secciones visibles en el orden del documento. */
export function paginaAPublica(pagina: PaginaSitio, ctx: ContextoPublico): WebsitePageWithSections {
  const secciones: WebsitePageSection[] = []
  pagina.secciones.forEach((s, i) => {
    // El renderizador solo conoce «visible»: visible si lo es en algún dispositivo (mismo
    // criterio que el editor del ERP, seccionAVista).
    const visible = s.visibilidad?.escritorio !== false || s.visibilidad?.movil !== false
    if (!visible) return
    secciones.push({
      id: s.id,
      page_id: pagina.id,
      organization_id: ctx.organizationId,
      section_type: s.tipo,
      section_variant: s.variante ?? 'default',
      content: structuredCloneSeguro(s.contenido) as WebsitePageSection['content'],
      settings: structuredCloneSeguro(s.diseno ?? {}) as WebsitePageSection['settings'],
      sort_order: i,
      is_visible: true,
      created_at: '',
      updated_at: '',
    })
  })
  return {
    id: pagina.id,
    organization_id: ctx.organizationId,
    slug: pagina.slug,
    title: pagina.titulo,
    description: null,
    page_type: pagina.tipo as WebsitePageWithSections['page_type'],
    show_in_header: false,
    show_in_footer: false,
    header_order: 0,
    footer_order: 0,
    is_published: pagina.publicada,
    meta_title: textoSeo(pagina.seo?.titulo),
    meta_description: textoSeo(pagina.seo?.descripcion),
    og_image_url: textoSeo(pagina.seo?.imagenOgUrl),
    parent_page_id: null,
    linked_category_id: null,
    menu_icon: null,
    menu_badge: null,
    // `page_settings` no tiene destino en el contrato actual (el importador lo avisa).
    page_settings: null,
    created_at: '',
    updated_at: '',
    website_page_sections: secciones,
  }
}

/** Página publicada por slug. Las plantillas nunca se sirven como ruta. */
export function paginaPublicaDesdeDocumento(
  documento: DocumentoSitio,
  slug: string,
  ctx: ContextoPublico,
): WebsitePageWithSections | null {
  if (!slug || slug.startsWith(PREFIJO_PLANTILLAS)) return null
  const pagina = documento.paginas.find((p) => p.slug === slug && p.publicada)
  return pagina ? paginaAPublica(pagina, ctx) : null
}

/**
 * Plantilla de detalle por tipo (`product_detail`, `category_detail`…). Mismo criterio que la
 * lectura legacy (`page_type` + publicada, una sola), con el slug renombrado para desempatar.
 */
export function plantillaPublicaDesdeDocumento(
  documento: DocumentoSitio,
  tipo: string,
  ctx: ContextoPublico,
): WebsitePageWithSections | null {
  const candidatas = documento.paginas.filter((p) => p.tipo === tipo && p.publicada)
  const canonica = normalizarSlug(`__${tipo}`)
  const elegida = candidatas.find((p) => p.slug === canonica) ?? (candidatas.length === 1 ? candidatas[0] : null)
  return elegida ? paginaAPublica(elegida, ctx) : null
}

// ─── Menús ────────────────────────────────────────────────────────────────────────────────────

export interface CategoriaMenu {
  id: number
  name: string
  slug: string
}

export interface MenusPublicos {
  header: WebsiteMenuWithItems | null
  mega: WebsiteMenuWithItems | null
  /** Menús nombrados del pie (sin el derivado de páginas). */
  footer: WebsiteMenuWithItems[]
  /** Menú derivado de `show_in_footer`, que legacy pintaba como navegación del pie. */
  footerPaginas: WebsiteMenuWithItems | null
}

/** Ids de categoría que referencian los menús (para resolver su slug con una sola consulta). */
export function idsCategoriasDeMenus(documento: DocumentoSitio): number[] {
  const ids = new Set<number>()
  const visitar = (items: ItemMenu[]) => {
    for (const item of items) {
      if (item.tipo === 'entity' && item.entidad === 'category') {
        const id = Number(item.entidadId)
        if (Number.isInteger(id) && id > 0) ids.add(id)
      }
      if (item.hijos) visitar(item.hijos)
    }
  }
  documento.menus.forEach((m) => visitar(m.items))
  return Array.from(ids)
}

const ETIQUETA_GENERICA_CATEGORIA = 'Categoría'

function itemAPublico(
  item: ItemMenu,
  menuId: string,
  padre: string | null,
  orden: number,
  paginas: Map<string, PaginaSitio>,
  categorias: Map<number, CategoriaMenu>,
  organizationId: number,
): WebsiteMenuItemWithChildren | null {
  const base: WebsiteMenuItemWithChildren = {
    id: item.id,
    menu_id: menuId,
    organization_id: organizationId,
    item_type: 'custom_link',
    page_id: null,
    category_id: null,
    custom_label: item.etiqueta,
    custom_url: null,
    parent_item_id: padre,
    icon: null,
    badge: null,
    display_order: orden,
    is_active: true,
    created_at: '',
    updated_at: '',
    children: [],
    page: null,
    category: null,
  }

  let nodo: WebsiteMenuItemWithChildren | null = null
  switch (item.tipo) {
    case 'page': {
      const pagina = paginas.get(item.paginaId)
      // Igual que legacy: un ítem de una página no publicada no sale.
      if (!pagina || !pagina.publicada) return null
      nodo = { ...base, item_type: 'page', page_id: pagina.id, page: { id: pagina.id, slug: pagina.slug, title: item.etiqueta || pagina.titulo } }
      break
    }
    case 'entity': {
      if (item.entidad === 'category') {
        const id = Number(item.entidadId)
        const categoria = categorias.get(id)
        if (!categoria) return null
        // El importador pone «Categoría» cuando legacy no tenía etiqueta propia; legacy mostraba el nombre.
        const nombre = item.etiqueta && item.etiqueta !== ETIQUETA_GENERICA_CATEGORIA ? item.etiqueta : categoria.name
        nodo = { ...base, item_type: 'category', category_id: id, category: { id, name: nombre, slug: categoria.slug } }
      } else if (item.entidad === 'product') {
        nodo = { ...base, custom_url: `/productos/${encodeURIComponent(item.entidadId)}` }
      } else {
        nodo = { ...base, custom_url: `/espacios/${encodeURIComponent(item.entidadId)}` }
      }
      break
    }
    case 'custom':
      nodo = { ...base, custom_url: item.url }
      break
    case 'anchor': {
      const pagina = item.paginaId ? paginas.get(item.paginaId) : undefined
      const ruta = pagina ? (pagina.slug === 'home' ? '/' : `/${pagina.slug}`) : ''
      nodo = { ...base, custom_url: `${ruta}#${item.ancla}` }
      break
    }
    case 'site':
      nodo = { ...base, custom_url: item.ruta || '/' }
      break
  }
  if (!nodo) return null
  nodo.children = (item.hijos ?? [])
    .map((h, i) => itemAPublico(h, menuId, item.id, i, paginas, categorias, organizationId))
    .filter((h): h is WebsiteMenuItemWithChildren => h !== null)
  return nodo
}

function menuAPublico(
  menu: MenuSitio,
  indice: number,
  paginas: Map<string, PaginaSitio>,
  categorias: Map<number, CategoriaMenu>,
  organizationId: number,
  ubicacion: 'header' | 'footer',
): WebsiteMenuWithItems {
  return {
    id: menu.id,
    organization_id: organizationId,
    name: menu.nombre,
    slug: menu.id,
    location: ubicacion,
    // El documento ordena los menús del pie pero no guarda la columna: uno por columna.
    footer_column: ubicacion === 'footer' ? indice + 1 : null,
    footer_order: indice,
    header_order: indice,
    is_active: true,
    created_at: '',
    updated_at: '',
    branch_id: null,
    source_menu_id: null,
    items: menu.items
      .map((item, i) => itemAPublico(item, menu.id, null, i, paginas, categorias, organizationId))
      .filter((h): h is WebsiteMenuItemWithChildren => h !== null),
  }
}

export function menusPublicosDesdeDocumento(
  documento: DocumentoSitio,
  organizationId: number,
  categorias: Map<number, CategoriaMenu>,
): MenusPublicos {
  const paginas = new Map(documento.paginas.map((p) => [p.id, p]))
  const porId = new Map(documento.menus.map((m) => [m.id, m]))
  const { header, footer } = documento.shell

  const menuHeader = header.menuPrincipalId ? porId.get(header.menuPrincipalId) : undefined
  const menuMega = header.menuMegaId ? porId.get(header.menuMegaId) : undefined

  const pie: WebsiteMenuWithItems[] = []
  let footerPaginas: WebsiteMenuWithItems | null = null
  footer.menuIds.forEach((id) => {
    const menu = porId.get(id)
    if (!menu) return
    if (id === MENU_PAGINAS_PIE) {
      footerPaginas = menuAPublico(menu, 0, paginas, categorias, organizationId, 'footer')
      return
    }
    pie.push(menuAPublico(menu, pie.length, paginas, categorias, organizationId, 'footer'))
  })

  return {
    header: menuHeader ? menuAPublico(menuHeader, 0, paginas, categorias, organizationId, 'header') : null,
    mega: menuMega ? menuAPublico(menuMega, 0, paginas, categorias, organizationId, 'header') : null,
    footer: pie,
    footerPaginas,
  }
}
