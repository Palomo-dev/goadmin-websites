/**
 * Layout de todas las páginas públicas (servidor).
 *
 * Envoltorio fino sobre `OrganizationLayoutCliente`: añade lo que depende de la sede de la
 * petición (prefijo de rutas, selector de sede, barra móvil del restaurante y horario del
 * pie) sin que las ~25 rutas que lo montan tengan que pasarlo. Ver lib/outlet/sedeLayout.ts.
 * Las props son las mismas de siempre.
 */

import { getDatosSedeLayout } from '@/lib/outlet/sedeLayout'
import { getSitioPublicoV2 } from '@/lib/website/v2/lectorPublico'
import { temaPublicoDesdeDocumento, type TemaPublico } from '@/lib/website/v2/temaPublico'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'
import { getAjustesSitio } from '@/lib/website/ajustesSitio.server'
import { OrganizationLayoutCliente, type OrganizationLayoutProps } from './OrganizationLayoutCliente'

export type { OrganizationLayoutProps }

export async function OrganizationLayout(props: OrganizationLayoutProps) {
  const settings = (props.effectiveSettings ?? props.organization.website_settings ?? null) as OrganizationLayoutProps['effectiveSettings']
  const [datosSede, temaSitio, pixeles, ajustes] = await Promise.all([
    getDatosSedeLayout(props.organization, props.outlet ?? null, settings ?? null),
    getTemaSitio(props.organization.id, props.outlet?.branchId ?? undefined),
    getPixelesSitio(props.organization.id),
    // Misma fila global ya cacheada que lee getOrgContext (react.cache + cacheStructural).
    getAjustesSitio(props.organization.id),
  ])
  return (
    <OrganizationLayoutCliente
      {...props}
      datosSede={datosSede}
      temaSitio={temaSitio}
      pixeles={pixeles}
      codigoPropio={ajustes.codigoPropio}
    />
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
