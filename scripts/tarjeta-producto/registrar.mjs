/** `node --import ./scripts/tarjeta-producto/registrar.mjs …` — registra el cargador (ver cargador.mjs). */
import { register } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
register('./cargador.mjs', import.meta.url, { data: { root: ROOT, ref: process.env.TARJETA_REF || null } })
