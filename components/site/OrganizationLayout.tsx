/**
 * Layout de todas las páginas públicas (servidor).
 *
 * Envoltorio fino sobre `OrganizationLayoutCliente`: añade lo que depende de la sede de la
 * petición (prefijo de rutas, selector de sede, barra móvil del restaurante y horario del
 * pie) sin que las ~25 rutas que lo montan tengan que pasarlo. Ver lib/outlet/sedeLayout.ts.
 * Las props son las mismas de siempre.
 */

import { getDatosSedeLayout } from '@/lib/outlet/sedeLayout'
import { OrganizationLayoutCliente, type OrganizationLayoutProps } from './OrganizationLayoutCliente'

export type { OrganizationLayoutProps }

export async function OrganizationLayout(props: OrganizationLayoutProps) {
  const settings = (props.effectiveSettings ?? props.organization.website_settings ?? null) as OrganizationLayoutProps['effectiveSettings']
  const datosSede = await getDatosSedeLayout(props.organization, props.outlet ?? null, settings ?? null)
  return <OrganizationLayoutCliente {...props} datosSede={datosSede} />
}
