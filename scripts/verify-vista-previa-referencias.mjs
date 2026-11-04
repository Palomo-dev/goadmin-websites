/**
 * verify-vista-previa-referencias.mjs — un borrador con menús o páginas inexistentes se pinta en la
 * vista previa sin esas referencias, en vez de 404. Sin dependencias.
 *
 *   npm run verify:vista-previa-referencias
 *
 * Caso real (2026-11-04, org 335): el pie apuntaba a un menú que ya no estaba y varios ítems de
 * menú a páginas que no estaban. El contrato lo rechazaba entero y el lienzo del editor mostraba
 * «404 This page could not be found».
 *
 * Qué comprueba:
 * 1. depurarReferencias quita solo lo que falta (pie, encabezado, ítems y sus hijos) y no toca lo demás.
 * 2. El documento depurado pasa el contrato real (lib/website/v2/contrato/documentoSitio.ts).
 * 3. soloErroresDeReferencia: cualquier otro error (p. ej. slug repetido) deja la vista previa como estaba.
 * 4. No muta la entrada, y un documento sano sale igual.
 * 5. En el fuente: solo getSitioBorradorV2 la usa (nunca la revisión publicada) y conserva el else.
 */
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { stripTypeScriptTypes } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let fallos = 0
let total = 0
function check(cond, msg) {
  total++
  if (!cond) {
    fallos++
    console.error('✗', msg)
  }
}
const igual = (a, b, msg) => check(JSON.stringify(a) === JSON.stringify(b), `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`)

const tmp = await mkdtemp(join(ROOT, 'node_modules', '.verify-vista-previa-referencias-'))
async function cargar(rel, nombre) {
  const js = stripTypeScriptTypes(await readFile(join(ROOT, rel), 'utf8'), { mode: 'strip' }).replace(/^import\s+type[^\n]*\n/gm, '')
  const destino = join(tmp, nombre)
  await writeFile(destino, js)
  return import(pathToFileURL(destino).href)
}

try {
  const contrato = await cargar('lib/website/v2/contrato/documentoSitio.ts', 'contrato.mjs')
  const { depurarReferencias, soloErroresDeReferencia } = await cargar('lib/website/v2/depurarReferencias.ts', 'depurar.mjs')

  const pagina = (id, slug) => ({ id, slug, tipo: 'builtin', titulo: slug, publicada: true, secciones: [] })
  const roto = {
    schemaVersion: 1,
    tema: {},
    shell: {
      header: { composicion: 'default', menuPrincipalId: 'encabezado', menuMegaId: 'mega-borrado' },
      footer: { composicion: 'default', menuIds: ['tienda', 'legales-borrado', 'ayuda'] },
    },
    menus: [
      {
        id: 'tienda', nombre: 'Tienda', items: [
          { id: 'i1', tipo: 'page', etiqueta: 'Inicio', paginaId: 'p-home' },
          { id: 'i2', tipo: 'page', etiqueta: 'Borrada', paginaId: 'p-borrada' },
          { id: 'i3', tipo: 'custom', etiqueta: 'Pedido', url: '/consultar-pedido' },
          {
            id: 'i4', tipo: 'page', etiqueta: 'Productos', paginaId: 'p-productos', hijos: [
              { id: 'i4a', tipo: 'page', etiqueta: 'Hija borrada', paginaId: 'p-otra-borrada' },
              { id: 'i4b', tipo: 'page', etiqueta: 'Inicio', paginaId: 'p-home' },
            ],
          },
        ],
      },
      { id: 'ayuda', nombre: 'Ayuda', items: [] },
      { id: 'encabezado', nombre: 'Encabezado', items: [{ id: 'e1', tipo: 'page', etiqueta: 'Inicio', paginaId: 'p-home' }] },
    ],
    paginas: [pagina('p-home', 'home'), pagina('p-productos', 'productos')],
  }
  const copia = JSON.stringify(roto)

  const antes = contrato.validarDocumentoSitio(roto)
  check(!antes.ok, 'el borrador roto no pasa el contrato (por eso había 404)')
  check(!antes.ok && soloErroresDeReferencia(antes.errores), `sus errores son solo de referencia: ${JSON.stringify(antes.errores)}`)

  const { documento, quitadas } = depurarReferencias(roto)
  igual(JSON.stringify(roto), copia, 'no muta la entrada')
  igual(quitadas.sort(), ['menus.0.items.1', 'menus.0.items.3.hijos.0', 'shell.footer.menuIds.1', 'shell.header.menuMegaId'].sort(), 'quita exactamente lo que falta')
  igual(documento.shell.footer.menuIds, ['tienda', 'ayuda'], 'pie sin el menú inexistente, en el mismo orden')
  igual(documento.shell.header.menuPrincipalId, 'encabezado', 'el menú principal que existe se conserva')
  igual(documento.shell.header.menuMegaId, null, 'el mega menú inexistente queda en null')
  igual(documento.menus[0].items.map((i) => i.id), ['i1', 'i3', 'i4'], 'ítems: solo sale el que apuntaba a una página borrada')
  igual(documento.menus[0].items[2].hijos.map((i) => i.id), ['i4b'], 'hijos: también se depuran')
  igual(documento.paginas, roto.paginas, 'las páginas no se tocan')

  const despues = contrato.validarDocumentoSitio(documento)
  check(despues.ok, `el depurado pasa el contrato: ${JSON.stringify(despues.errores ?? [])}`)

  const sano = depurarReferencias(documento)
  igual(sano.quitadas, [], 'un documento sano no pierde nada')
  igual(sano.documento, documento, 'y sale igual')

  const otroError = contrato.validarDocumentoSitio({ ...roto, paginas: [pagina('p-home', 'home'), pagina('p-productos', 'home')] })
  check(!otroError.ok && !soloErroresDeReferencia(otroError.errores), 'con un slug repetido no se depura: la vista previa sigue como antes')
  check(!soloErroresDeReferencia([]), 'sin errores no hay nada que depurar')
  igual(depurarReferencias(null).quitadas, [], 'entrada que no es objeto: sin cambios')

  // ─── 5. Reglas en el fuente ──────────────────────────────────────────────────────────────────
  const lector = await readFile(join(ROOT, 'lib/website/v2/lectorPublico.ts'), 'utf8')
  const usos = [...lector.matchAll(/depurarReferencias\(/g)].length
  igual(usos, 1, 'lectorPublico llama depurarReferencias una sola vez')
  const inicioBorrador = lector.indexOf('export async function getSitioBorradorV2')
  const uso = lector.indexOf('depurarReferencias(')
  const siguienteExport = lector.indexOf('\nexport ', inicioBorrador + 10)
  check(inicioBorrador > 0 && uso > inicioBorrador && (siguienteExport === -1 || uso < siguienteExport), 'solo dentro de getSitioBorradorV2 (vista previa), nunca en la revisión publicada')
  check(/if \(!validacion\.ok\) \{\s*console\.error\('\[sitio-v2\] Borrador ilegible/.test(lector), 'cualquier otro error sigue registrándose y devolviendo null')
} finally {
  await rm(tmp, { recursive: true, force: true })
}

console.log(fallos ? `✗ ${fallos} de ${total} comprobaciones fallaron` : `✓ ${total} comprobaciones`)
process.exit(fallos ? 1 : 0)
