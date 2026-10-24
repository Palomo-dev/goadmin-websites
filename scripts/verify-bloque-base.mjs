/**
 * verify-bloque-base.mjs — producto y categoría conservan su bloque base
 * cuando la página ya tiene otras secciones. Una lista vacía no se toca.
 *
 *   npm run verify:bloque-base
 */
import { completarBloqueBase, TIPOS_BASE_PRODUCTO, TIPO_BASE_CATEGORIA, TIPOS_ENCIMA_CATEGORIA } from '../lib/website/bloqueBase.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

const seccion = (tipo, id = tipo) => ({
  id,
  page_id: 'p',
  organization_id: 1,
  section_type: tipo,
  section_variant: 'default',
  content: {},
  settings: {},
  sort_order: 0,
  is_visible: true,
  created_at: '',
  updated_at: '',
})

check(completarBloqueBase([], TIPOS_BASE_PRODUCTO).length === 0, 'sin secciones sigue el layout de hoy')

const soloBeneficios = completarBloqueBase([seccion('product_benefits')], TIPOS_BASE_PRODUCTO)
check(
  soloBeneficios.map((s) => s.section_type).join(',') === 'product_gallery,product_info,product_actions,product_benefits',
  'beneficios solos dejan la ficha y se suman abajo',
)
check(soloBeneficios[0].id === 'default_product_gallery', 'la galería virtual lleva id estable')

const encabezado = completarBloqueBase(
  [seccion('category_header'), seccion('product_benefits', 'extra')],
  [TIPO_BASE_CATEGORIA],
  TIPOS_ENCIMA_CATEGORIA,
)
check(
  encabezado.map((s) => s.section_type).join(',') === 'category_header,category_products,product_benefits',
  'la cabecera queda arriba de la grilla y el resto abajo',
)

const completas = [seccion('product_gallery'), seccion('product_info'), seccion('product_actions'), seccion('product_benefits')]
const mismas = completarBloqueBase(completas, TIPOS_BASE_PRODUCTO)
check(mismas === completas, 'si el bloque base ya está, la lista no se copia')

const parcial = completarBloqueBase(
  [seccion('category_header'), seccion('product_info', 'info'), seccion('product_benefits', 'ben')],
  TIPOS_BASE_PRODUCTO,
)
check(
  parcial.map((s) => s.section_type).join(',') === 'category_header,product_gallery,product_info,product_actions,product_benefits',
  'un base a medias inserta los que faltan en orden',
)
check(parcial.find((s) => s.section_type === 'product_info')?.id === 'info', 'el base que ya existía se conserva')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`bloque base ok (${casos})`)
