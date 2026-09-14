import { unstable_cache } from 'next/cache'

/**
 * Caché de datos ESTRUCTURALES del sitio.
 *
 * QUÉ SE CACHEA Y QUÉ NO
 * ----------------------
 * Aquí solo entra lo que cambia cuando un comerciante edita su sitio: la
 * organización, sus páginas, menús, navegación, categorías, sucursales,
 * impuestos y píxeles.
 *
 * NO se cachea nada que dependa de precio, stock o disponibilidad. Servir un
 * precio o un stock viejo en una tienda es un problema comercial peor que el
 * técnico que resolvería. Esas consultas siguen yendo a la base en cada
 * petición, a propósito.
 *
 * POR QUÉ EL CENTINELA DE `undefined`
 * -----------------------------------
 * unstable_cache construye la clave con `JSON.stringify(args)`, y dentro de un
 * array eso convierte `undefined` en `null`. El propio código de Next lo avisa:
 * "stringify is likely not safe here. We will coerce undefined to null which
 * will make the keyspace smaller than the execution space".
 *
 * En este repositorio esa colisión NO es inocua, porque `branchId` tiene tres
 * significados distintos:
 *   undefined -> sin filtro de sucursal (todo el catálogo)
 *   null      -> solo lo que tiene branch_id NULL
 *   number    -> esa sucursal (más lo que tiene branch_id NULL)
 *
 * Sin el centinela, f(org, undefined) y f(org, null) compartirían entrada y un
 * outlet acabaría viendo las categorías de otro. Se sustituye `undefined` por
 * una cadena centinela ANTES de que Next calcule la clave, y se restaura justo
 * antes de invocar la función real, así que el comportamiento no cambia.
 */
const UNDEFINED_SENTINEL = '__undefined__'

/** Contenido que edita el comerciante: se quiere ver el cambio pronto. */
export const CONTENT_TTL = 60

/** Ajustes que casi nunca cambian: organización, sucursales, impuestos. */
export const SETTINGS_TTL = 300

export function cacheStructural<A extends any[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  revalidate: number = CONTENT_TTL
): (...args: A) => Promise<R> {
  const cached = unstable_cache(
    async (...args: any[]) =>
      fn(...(args.map((a) => (a === UNDEFINED_SENTINEL ? undefined : a)) as A)),
    // `name` desempata: la clave fija de Next es fn.toString() + keyParts, y dos
    // funciones con el mismo cuerpo colisionarían sin esto.
    [name],
    { revalidate, tags: [name] }
  )

  return ((...args: A) =>
    cached(...args.map((a) => (a === undefined ? UNDEFINED_SENTINEL : a)))) as (
    ...args: A
  ) => Promise<R>
}

// ---------------------------------------------------------------------------
// Caché del CATÁLOGO (productos con precio, imágenes y stock).
//
// Por qué existe, a pesar del aviso de arriba: el 2026-09-14 una ráfaga de
// ~35 visitas en 7 s a la portada de una tienda con 4.368 productos tumbó la
// base de datos entera (cada render pedía dos veces 500 productos con sus
// embeds, ~1,8 MB por consulta, sin ninguna caché entre peticiones). Postgres
// dejó de responder y se reinició solo. Servir un stock con 30 s de retraso
// es un problema menor que dejar sin tienda a todas las organizaciones.
//
// Compromiso:
//   - TTL corto (CATALOG_TTL): el stock y el precio se refrescan solos.
//   - Etiqueta por organización (`catalogo-<id>`): el ERP la invalida al
//     editar productos, precios o stock, vía POST /api/revalidate, para que
//     el comerciante vea su cambio al instante sin esperar el TTL.
//   - La disponibilidad real se sigue validando en el checkout contra la base
//     (app/api/orders), no contra esta caché.
//
// Límite a tener presente: Next descarta silenciosamente entradas > 2 MB. Por
// eso las consultas del catálogo usan una lista explícita de columnas y no
// `*` (las columnas `busqueda_*` eran ~1/3 del payload y el sitio no las usa).
// ---------------------------------------------------------------------------

/** Catálogo: productos, precios, imágenes y stock. */
export const CATALOG_TTL = 30

/** Etiqueta de caché del catálogo de una organización. */
export function catalogTag(organizationId: number): string {
  return `catalogo-${organizationId}`
}

/** Etiqueta global: invalida el catálogo de TODAS las organizaciones. */
export const CATALOG_TAG_ALL = 'catalogo'

export function cacheCatalog<A extends any[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  // NoInfer: los parámetros se infieren de `fn`, no de este callback.
  organizationIdOf: (...args: NoInfer<A>) => number
): (...args: A) => Promise<R> {
  return (...args: A) => {
    const orgId = organizationIdOf(...args)
    // unstable_cache se construye por llamada porque las etiquetas son fijas
    // en el momento de envolver y aquí dependen de la organización. La clave
    // de caché sigue siendo [name] + args, así que no hay duplicados.
    const cached = unstable_cache(
      async (...inner: any[]) =>
        fn(...(inner.map((a) => (a === UNDEFINED_SENTINEL ? undefined : a)) as A)),
      [name],
      { revalidate: CATALOG_TTL, tags: [name, CATALOG_TAG_ALL, catalogTag(orgId)] }
    )
    return cached(...args.map((a) => (a === undefined ? UNDEFINED_SENTINEL : a)))
  }
}
