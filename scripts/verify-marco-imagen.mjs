/**
 * verify-marco-imagen.mjs — la foto no cambia si las claves nuevas no vienen.
 *
 *   npm run verify:marco-imagen
 */
import { claseAjusteImagen, claseProporcionImagen, clasesImagenBeneficio, estiloMarcoImagen } from '../lib/website/marcoImagen.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(claseAjusteImagen(undefined) === 'object-cover', 'sin ajuste sigue cubriendo')
check(claseAjusteImagen('contain') === 'object-contain', 'contener no recorta')
check(claseProporcionImagen(undefined) === '', 'sin proporción no hay aspect')
check(claseProporcionImagen('4:3') === 'aspect-[4/3]', '4:3 tiene su clase')
check(clasesImagenBeneficio({}) === 'mb-4 w-full max-h-48 rounded-xl object-cover', 'beneficios sin claves = la foto de hoy')
check(clasesImagenBeneficio({ image_fit: 'contain' }).includes('object-contain'), 'beneficios puede contener')
check(clasesImagenBeneficio({ image_ratio: '1:1' }).includes('aspect-square'), 'beneficios lee la proporción')
check(Object.keys(estiloMarcoImagen({})).length === 0, 'sin margen ni fondo no hay estilo')
check(estiloMarcoImagen({ image_padding: 0 }).padding == null, 'margen 0 no pinta padding')
check(estiloMarcoImagen({ image_padding: 12, image_bg: '#fff' }).backgroundColor === '#fff', 'el fondo solo si viene')
check(estiloMarcoImagen({ image_max_size: 120 }).maxHeight === 120, 'el tope es en px')

if (problemas.length) {
  console.error(`verify-marco-imagen: ${problemas.length} fallo(s) de ${casos}`)
  for (const p of problemas) console.error(' -', p)
  process.exit(1)
}
console.log(`verify-marco-imagen: ${casos} casos`)
