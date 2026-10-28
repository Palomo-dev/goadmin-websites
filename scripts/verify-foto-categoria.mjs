/**
 * verify-foto-categoria.mjs — foto de respaldo de categorías: propia → producto directo → descendientes.
 *
 *   npm run verify:foto-categoria
 */
import { descendientesPorNivel, fotosDeRespaldo, hijasPorPadre } from '../lib/website/fotoCategoria.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

// Árbol: 1 Joyería → 2 Joyería Hombre (foto) ; 3 Niños → 4 Ropa Niños → 5 Bebé (foto)
// 6 ↔ 7 ciclo sin fotos ; 8 con image_url propia y una hija con foto ; 10 con producto directo y una hija con foto
const arbol = [
  { id: 1, parent_id: null }, { id: 2, parent_id: 1 },
  { id: 3, parent_id: null }, { id: 4, parent_id: 3 }, { id: 5, parent_id: 4 },
  { id: 6, parent_id: 7 }, { id: 7, parent_id: 6 }, { id: 11, parent_id: 11 },
  { id: 8, parent_id: null }, { id: 9, parent_id: 8 },
  { id: 10, parent_id: null }, { id: 12, parent_id: 10 },
  { id: 13, parent_id: null }, { id: 14, parent_id: 13 }, { id: 15, parent_id: 13 }, { id: 16, parent_id: 14 },
]
const hijas = hijasPorPadre(arbol)
const directa = { 2: 'f2', 5: 'f5', 9: 'f9', 10: 'f10', 12: 'f12', 15: 'f15', 16: 'f16' }
const cats = [1, 3, 6, 7, 11, 8, 10, 13, 2].map(id => ({ id, image_url: id === 8 ? 'propia8' : null }))
const r = fotosDeRespaldo(cats, directa, hijas)

check(r[1] === 'f2', 'padre sin productos toma la foto de la hija')
check(r[3] === 'f5', 'abuelo sin productos toma la foto de la nieta')
check(!(6 in r) && !(7 in r) && !(11 in r), 'un ciclo sin fotos termina y no inventa foto')
check(!(8 in r), 'categoría con image_url queda intacta (no se le asigna respaldo)')
check(r[10] === 'f10', 'el producto directo gana sobre las subcategorías')
check(r[13] === 'f15', 'por niveles: la hija con foto gana sobre la nieta')
check(r[2] === 'f2', 'la hija con foto directa conserva la suya')
check(JSON.stringify(descendientesPorNivel(hijas, 6)) === '[7]', 'ciclo: descendientes sin repetir ni incluir la raíz')
check(JSON.stringify(descendientesPorNivel(hijas, 13)) === '[14,15,16]', 'orden por niveles')
check(Object.keys(fotosDeRespaldo([{ id: 1 }], {}, hijas)).length === 0, 'sin fotos no hay respaldo')

if (problemas.length) {
  console.error(`verify-foto-categoria: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-foto-categoria: ${casos} casos OK`)
