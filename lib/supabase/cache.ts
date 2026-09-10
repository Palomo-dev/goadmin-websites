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
