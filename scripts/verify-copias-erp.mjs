/**
 * verify-copias-erp.mjs — las copias del ERP que viven en este repo son IDÉNTICAS al original.
 *
 *   npm run verify:copias
 *   ERP_REPO=/ruta/a/go-admin-erp npm run verify:copias
 *
 * Por qué: el contrato del documento V2, el mapeo de ajustes y el estilo por sección se escriben
 * en el ERP (editor) y se leen aquí (sitio público). Si las dos copias divergen, el editor guarda
 * algo que la web rechaza (el lector valida en modo estricto) o pinta distinto. Un solo punto de
 * verdad: el archivo del ERP; aquí se copia tal cual, sin cabeceras ni cambios de import.
 *
 * Qué comprueba:
 * 1. Cada copia existe y no trae imports de alias (`@/`) que solo resuelven en el ERP.
 * 2. Si el repo del ERP está disponible (`ERP_REPO` o `../go-admin-erp`), que el contenido sea
 *    byte a byte el mismo. Sin el ERP al lado avisa y no falla (CI de este repo solo).
 */
import { readFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ERP = resolve(process.env.ERP_REPO || join(ROOT, '..', 'go-admin-erp'))

/** [ruta aquí, ruta en el ERP] */
export const COPIAS = [
  ['lib/website/v2/contrato/documentoSitio.ts', 'src/lib/website/contrato/documentoSitio.ts'],
  ['lib/website/v2/mapeoAjustes.ts', 'src/lib/website/v2/mapeoAjustes.ts'],
  ['lib/website/v2/estiloSeccion.ts', 'src/lib/website/v2/estiloSeccion.ts'],
  ['lib/website/v2/colorMarca.ts', 'src/lib/website/v2/colorMarca.ts'],
  ['lib/website/v2/fuenteTema.ts', 'src/lib/website/v2/fuenteTema.ts'],
  // Teléfono con país: parseo, validación por país y E.164 (los usa components/site/TelefonoPais.tsx).
  ['lib/utils/telefono.ts', 'src/lib/utils/telefono.ts'],
  ['lib/data/countryPhoneCodes.ts', 'src/lib/data/countryPhoneCodes.ts'],
]

const problemas = []
const notas = []

async function existe(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const conErp = await existe(join(ERP, 'src/lib/website'))
  if (!conErp) notas.push(`Sin el repo del ERP en ${ERP}: solo se revisa que las copias existan (ERP_REPO=… para comparar).`)

  for (const [aqui, alla] of COPIAS) {
    const rutaAqui = join(ROOT, aqui)
    if (!(await existe(rutaAqui))) {
      problemas.push(`Falta la copia ${aqui}`)
      continue
    }
    const local = await readFile(rutaAqui, 'utf8')
    if (/from ['"]@\//.test(local)) problemas.push(`${aqui} importa con alias @/: la copia debe usar rutas relativas como el original`)
    if (!conErp) continue
    const rutaErp = join(ERP, alla)
    if (!(await existe(rutaErp))) {
      problemas.push(`El ERP ya no tiene ${alla}: revisa si se movió y actualiza COPIAS`)
      continue
    }
    const original = await readFile(rutaErp, 'utf8')
    if (original !== local) {
      const a = original.split('\n')
      const b = local.split('\n')
      const linea = a.findIndex((l, i) => l !== b[i])
      problemas.push(`${aqui} difiere de ${alla} (primera línea distinta: ${linea + 1}). Copia el del ERP tal cual.`)
    }
  }

  for (const n of notas) console.log(`· ${n}`)
  if (problemas.length > 0) {
    console.error(`✗ verify-copias-erp: ${problemas.length} problema(s)`)
    for (const p of problemas) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log(`✓ verify-copias-erp: ${COPIAS.length} copias${conErp ? ' idénticas al ERP' : ' presentes'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
