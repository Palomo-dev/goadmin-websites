/**
 * Organización del buscador de productos (`/api/products/search`).
 *
 * La organización sale SIEMPRE del contexto del host (`getOrgContext`). Un `organizationId` en
 * la query solo se tolera si coincide con la del contexto: lo mandaban los componentes antes de
 * este cambio y una pestaña abierta con el JS anterior lo sigue mandando. Cualquier otro valor
 * (otra organización, basura, o sin contexto que lo respalde) es un intento de leer el catálogo
 * de otra organización: 403.
 *
 * Módulo puro (sin imports con valor): lo carga `scripts/verify-busqueda-org.mjs`.
 */

export type ResultadoOrganizacionBusqueda =
  | { tipo: 'ok'; organizationId: number }
  /** Sin contexto ni parámetro: respuesta vacía, como siempre. */
  | { tipo: 'sin_organizacion' }
  | { tipo: 'prohibido'; motivo: 'sin_contexto' | 'no_coincide' }

export function resolverOrganizacionBusqueda(
  organizacionDelContexto: number | null | undefined,
  organizationIdQuery: string | null,
): ResultadoOrganizacionBusqueda {
  const delContexto =
    typeof organizacionDelContexto === 'number' && Number.isInteger(organizacionDelContexto) && organizacionDelContexto > 0
      ? organizacionDelContexto
      : null

  if (organizationIdQuery !== null) {
    if (delContexto === null) return { tipo: 'prohibido', motivo: 'sin_contexto' }
    const texto = organizationIdQuery.trim()
    if (!/^\d+$/.test(texto) || Number(texto) !== delContexto) return { tipo: 'prohibido', motivo: 'no_coincide' }
  }

  return delContexto === null ? { tipo: 'sin_organizacion' } : { tipo: 'ok', organizationId: delContexto }
}
