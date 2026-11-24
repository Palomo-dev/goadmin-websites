/**
 * resolver-ts.mjs — para los verify que importan el motor REAL de la tienda con
 * `--experimental-strip-types`:
 *
 *   node --experimental-strip-types --import ./scripts/resolver-ts.mjs scripts/verify-….mjs
 *
 * Node no resuelve los imports relativos sin extensión (`./promociones/precioVolumen`) que sí
 * resuelve el build de Next. Este gancho prueba `.ts` y `/index.ts` solo para imports relativos
 * hechos desde un `.ts`. Sin dependencias. Los ganchos viven en resolver-ts.ganchos.mjs.
 */
import { register } from 'node:module'

register('./resolver-ts.ganchos.mjs', import.meta.url)
