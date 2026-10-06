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

interface AlmacenVistaPrevia {
  organizationId: number | null
  sitio: SitioPublicoV2 | null
}

const almacen = cache((): AlmacenVistaPrevia => ({ organizationId: null, sitio: null }))

export function fijarSitioVistaPrevia(organizationId: number, sitio: SitioPublicoV2): void {
  const a = almacen()
  a.organizationId = organizationId
  a.sitio = sitio
}

/** Borrador de la vista previa de esta petición para la organización, o `null`. */
export function sitioVistaPreviaDe(organizationId: number): SitioPublicoV2 | null {
  const a = almacen()
  return a.sitio && a.organizationId === organizationId ? a.sitio : null
}
