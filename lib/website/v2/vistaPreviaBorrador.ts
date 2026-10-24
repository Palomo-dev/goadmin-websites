/**
 * Sitio V2 que se pinta en ESTA petición en lugar de la revisión publicada: el borrador de la
 * vista previa privada (`app/vista-previa/[token]`).
 *
 * Vive en la caché por petición de React (`cache`): cada petición tiene su propio almacén y
 * nace vacío. Solo `app/vista-previa/[token]` lo llena, después de verificar la firma del
 * enlace y que la organización del token es la del host. Ninguna otra ruta lo toca, así que
 * la web pública nunca ve un borrador.
 *
 * Solo servidor.
 */
import { cache } from 'react'
import type { SitioPublicoV2 } from './lectorPublico'
import type { ResolvedOutlet } from '@/lib/outlet/resolver'

interface AlmacenVistaPrevia {
  organizationId: number | null
  sitio: SitioPublicoV2 | null
  outlet: ResolvedOutlet | null
}

const almacen = cache((): AlmacenVistaPrevia => ({ organizationId: null, sitio: null, outlet: null }))

export function fijarSitioVistaPrevia(organizationId: number, sitio: SitioPublicoV2, outlet: ResolvedOutlet | null = null): void {
  const a = almacen()
  a.organizationId = organizationId
  a.sitio = sitio
  a.outlet = outlet
}

/** Solo la vista previa firmada puede sustituir la sede del host por la del sitio elegido. */
export function outletVistaPreviaDe(organizationId: number): { outlet: ResolvedOutlet | null } | null {
  const a = almacen()
  return a.sitio && a.organizationId === organizationId ? { outlet: a.outlet } : null
}

/** Borrador de la vista previa de esta petición para la organización, o `null`. */
export function sitioVistaPreviaDe(organizationId: number): SitioPublicoV2 | null {
  const a = almacen()
  return a.sitio && a.organizationId === organizationId ? a.sitio : null
}
