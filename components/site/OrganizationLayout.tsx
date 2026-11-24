/**
 * Layout de todas las páginas públicas (servidor).
 *
 * Envoltorio fino sobre `OrganizationLayoutCliente`: añade lo que depende de la sede de la
 * petición (prefijo de rutas, selector de sede, barra móvil del restaurante y horario del
 * pie) sin que las ~25 rutas que lo montan tengan que pasarlo. Ver lib/outlet/sedeLayout.ts.
 * Las props son las mismas de siempre.
 *
 * Pie igual en todas las páginas (2026-11-21): solo la ruta comodín ([[...slug]]) pasaba `menus`;
 * en producto, categoría, carrito, checkout, etc. faltaban las columnas de los menús del pie.
 * Si la página no los pasa, se resuelven aquí (lib/website/pieSitio.ts) con las mismas lecturas
 * cacheadas que getOrgContext. La comodín siempre los pasa (también vacíos), así que no se leen dos veces.
 */

import { getDatosSedeLayout } from '@/lib/outlet/sedeLayout'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { temaPublicoDesdeDocumento, type TemaPublico } from '@/lib/website/v2/temaPublico'
import { getCategoriasMenuV2 } from '@/lib/website/v2/lectorPublico'
import { resolverPieSitio } from '@/lib/website/pieSitio'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'
import { getAjustesSitio } from '@/lib/website/ajustesSitio.server'
import { getExtrasEncabezadoPie } from '@/lib/website/extrasEncabezadoPie.server'
import { getMenuCategories, getWebsiteMenusByLocation } from '@/lib/supabase/queries'
import { OrganizationLayoutCliente, type OrganizationLayoutProps } from './OrganizationLayoutCliente'
import { getEscalonesTienda } from '@/lib/promociones/escalonesTienda.server'
import { ProveedorEscalonesTienda } from './volumen/EscalonesTiendaContext'
import { getEtiquetasPromoTienda } from '@/lib/promociones/etiquetasPromocion.server'
import { ProveedorPromosEtiqueta } from './etiquetas/PromosEtiquetaContext'

export type { OrganizationLayoutProps }

export async function OrganizationLayout(props: OrganizationLayoutProps) {
  const settings = (props.effectiveSettings ?? props.organization.website_settings ?? null) as OrganizationLayoutProps['effectiveSettings']
  const sedePromos = props.outlet?.branchId ?? props.branchId ?? null
  const zonaPromos = (props.organization as { timezone?: string | null }).timezone ?? null
  const [datosSede, temaSitio, pixeles, ajustes, categoriasBusqueda, escalones, etiquetasPromo] = await Promise.all([
    getDatosSedeLayout(props.organization, props.outlet ?? null, settings ?? null),
    getTemaSitio(props.organization.id, props.outlet?.branchId ?? undefined),
    getPixelesSitio(props.organization.id),
    // Misma fila global ya cacheada que lee getOrgContext (react.cache + cacheStructural).
    getAjustesSitio(props.organization.id),
    // Búsquedas populares sin `search_popular`: las primeras categorías de la tienda, aunque no
    // se muestren en el encabezado ni en el pie y aunque la página no pase `menuCategories`.
    // Misma llamada (y clave de caché) que `categoriasTienda` de getOrgContext.
    props.categoriasBusqueda ?? getMenuCategories(props.organization.id, props.outlet?.branchId ?? props.branchId ?? undefined).catch(() => []),
    // Precio por volumen («Compra más, paga menos», Figma «16 Sitio web» 3006:75498): una lectura
    // por organización en la caché del catálogo (30 s) y react.cache; las tarjetas y la ficha la
    // resuelven en memoria. Sin promociones por volumen: [] y no se monta nada.
    getEscalonesTienda(props.organization.id, props.outlet?.branchId ?? props.branchId ?? null, (props.organization as { timezone?: string | null }).timezone ?? null),
    // Etiquetas de las promociones reales («2 X 1», «−20 %», Figma «16 Sitio web» 3036:78040):
    // igual que el volumen, una lectura por organización cacheada; tarjetas y ficha en memoria.
    getEtiquetasPromoTienda(props.organization.id, sedePromos, zonaPromos),
  ])
  // Al cliente solo viajan los nombres de las primeras raíces (no el árbol: hasta ~74 KB en
  // tiendas grandes, en cada página). 8 por si hay nombres vacíos o repetidos.
  const nombresBusqueda = categoriasBusqueda.slice(0, 8).map((c) => ({ name: c.name }))
  // Sede del pie: la que pasa la página (comodín, producto, categoría, búsqueda: la de getOrgContext)
  // o, si no la pasa, la que reconoce getDatosSedeLayout con las mismas cabeceras.
  const sedePie = props.outlet?.branchId ?? props.branchId ?? datosSede.sedeActualId ?? undefined
  // Encabezado y pie por plantilla: con las opciones en su default no hace consultas nuevas.
  const [extrasShell, pie] = await Promise.all([
    getExtrasEncabezadoPie(props.organization, settings ?? null, datosSede, ajustes),
    // Lecturas cacheadas, las mismas llamadas (y claves) que getOrgContext: getSitioPublicoV2
    // (react.cache + unstable_cache, la de getTemaSitio), getCategoriasMenuV2 y
    // getWebsiteMenusByLocation (cacheStructural). Con `menus` ya pasados no se lee nada más.
    resolverPieSitio(
      { organizationId: props.organization.id, branchId: sedePie, menus: props.menus, footerNav: props.footerNav, footerNavTree: props.footerNavTree },
      {
        leerSitio: getSitioPublicoV2,
        leerCategorias: getCategoriasMenuV2,
        leerMenusLegacy: (organizationId, branchId) => getWebsiteMenusByLocation(organizationId, 'footer', branchId),
        alFallar: (error) => console.error('[sitio-v2] Error leyendo los menús del pie; se usan los legacy', {
          organizationId: props.organization.id, error: error instanceof Error ? error.message : String(error),
        }),
      },
    ),
  ])
  return (
    <OrganizationLayoutCliente
      {...props}
      menus={pie.menus}
      footerNav={pie.footerNav}
      footerNavTree={pie.footerNavTree}
      datosSede={datosSede}
      extrasShell={extrasShell}
      temaSitio={temaSitio}
      paginasPie={pie.paginasPie}
      pixeles={pixeles}
      codigoPropio={ajustes.codigoPropio}
      categoriasBusqueda={nombresBusqueda}
    >
      <ProveedorEscalonesTienda promos={escalones} zona={(props.organization as { timezone?: string | null }).timezone ?? null}>
        <ProveedorPromosEtiqueta promos={etiquetasPromo.publicas} hayDeCliente={etiquetasPromo.hayDeCliente} sede={sedePromos} zona={zonaPromos}>
          {props.children}
        </ProveedorPromosEtiqueta>
      </ProveedorEscalonesTienda>
    </OrganizationLayoutCliente>
  )
}

/**
 * Estilo general del sitio V2 (fondo, texto, fuentes, redondeo, botón, movimiento). Mismos
 * argumentos que `getOrgContext` → `getSitioPublicoV2` está en react.cache: no hay lectura nueva.
 * Legacy o cualquier fallo → `null` y el layout queda como siempre.
 */
async function getTemaSitio(organizationId: number, branchId: number | undefined): Promise<TemaPublico | null> {
  try {
    const sitio = await getSitioPublicoV2(organizationId, branchId)
    if (!sitio) return null
    return temaPublicoDesdeDocumento(sitio.documento, sitio.branchId !== null, sitio.principal?.documento ?? null)
  } catch (error) {
    console.error('[sitio-v2] Error leyendo el tema del sitio; se pinta el de siempre', {
      organizationId, error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
