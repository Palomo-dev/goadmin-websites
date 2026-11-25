/**
 * verify-etiquetas-ficha.mjs — etiquetas en la ficha y promociones reales en la tienda (Figma «16
 * Sitio web» 3036:78040, aprobado el 2026-11-24).
 *
 *   npm run verify:etiquetas-ficha
 *
 * Sin base de datos. Importa los módulos reales:
 *  - lib/website/v2/seccionesFicha.ts: sin `labels_show` la ficha queda como hoy; orden y esquinas.
 *  - lib/promociones/etiquetasPromocion.ts: texto («2 X 1», «−20 %»), vigencia, compra mínima, grupo
 *    de clientes (no viaja sin sesión; con sesión solo si pertenece) y que el ejemplo sale del motor
 *    del cobro.
 *  - lib/website/etiquetasProducto.ts: la misma regla de la tarjeta (cuándo sale, color) en la ficha.
 *  - lib/website/tarjetaProducto.ts: la promoción en la tarjeta es opcional (sin opciones, la de hoy).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leerOpcionesEtiquetasFicha, itemsEtiquetasParaGuardar, TIPOS_ETIQUETA_FICHA, RADIO_FORMA_ETIQUETA, FORMAS_ETIQUETA_FICHA, cabeEnCirculo } from '../lib/website/v2/seccionesFicha.ts'
import { explicarPromo, llevaPaga, prepararEtiquetasPromo, promoParaProducto, separarPublicas, textoEtiquetaPromo } from '../lib/promociones/etiquetasPromocion.ts'
import { etiquetasFicha, colorDescuentoFicha, valorEtiqueta, textoComparableEtiqueta } from '../lib/website/etiquetasProducto.ts'
import { etiquetasDeEstilo } from '../lib/website/tarjetaProducto.ts'

let ok = 0
const caso = (nombre, fn) => { fn(); ok += 1; console.log(`  ok ${nombre}`) }
const fmt = (n) => `$ ${Math.round(n).toLocaleString('es-CO')}`

const promo = (extra) => ({
  id: extra.id ?? 'p1', name: 'P', description: null, promotion_type: 'buy_x_get_y', discount_value: 0,
  buy_quantity: 2, get_quantity: 1, min_purchase_amount: null, max_discount_amount: null, applies_to: 'products',
  start_date: '2026-01-01T00:00:00Z', end_date: null, is_active: true, usage_limit: null, usage_count: 0,
  is_combinable: false, priority: 0, created_at: '2026-01-01T00:00:00Z', branches: null, applies_to_web: true,
  applicable_days: null, promotion_rules: [{ rule_type: 'include_product', product_id: 10, category_id: null }], ...extra,
})
const prod = { id: 10, parent_product_id: null, category_id: 3, brand: null }
const fecha = new Date('2026-11-24T15:00:00Z')

caso('sin labels_show la ficha no pinta nada', () => {
  const o = leerOpcionesEtiquetasFicha({})
  assert.equal(o.mostrar, false)
  assert.equal(o.items.length, TIPOS_ETIQUETA_FICHA.length)
  const datos = { discount: 50, outOfStock: false, isParent: false, padreSinVariantes: false, variantCount: 0, salesCount: 9 }
  assert.deepEqual(etiquetasFicha(o, null, null, datos, '#EA8A2E', 'foto'), [])
  assert.equal(colorDescuentoFicha(o, null), null)
})

caso('orden guardado, faltantes al final, ida y vuelta', () => {
  const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_items: [{ id: 'promotion', corner: 'bottom_right' }, { id: 'discount', visible: false }, { id: 'x' }] })
  assert.deepEqual(o.items.slice(0, 2).map((i) => i.id), ['promotion', 'discount'])
  assert.equal(o.items[0].esquina, 'bottom_right')
  assert.equal(o.items[1].visible, false)
  const otra = leerOpcionesEtiquetasFicha({ labels_show: true, labels_items: itemsEtiquetasParaGuardar(o.items) })
  assert.deepEqual(otra.items, o.items)
})

caso('texto de cada tipo de promoción', () => {
  assert.deepEqual(llevaPaga(2, 1), { lleva: 2, paga: 1 })
  assert.deepEqual(llevaPaga(1, 1), { lleva: 2, paga: 1 })
  const [p] = prepararEtiquetasPromo([promo({})], { date: fecha })
  assert.equal(textoEtiquetaPromo(p, fmt), '2 X 1')
  const [q] = prepararEtiquetasPromo([promo({ promotion_type: 'percentage', discount_value: 20, min_quantity: 3 })], { date: fecha })
  assert.equal(textoEtiquetaPromo(q, fmt), 'Desde 3: −20 %')
})

caso('compra mínima, método de pago y vencidas no se prometen', () => {
  assert.equal(prepararEtiquetasPromo([promo({ min_purchase_amount: 100000 })], { date: fecha }).length, 0)
  assert.equal(prepararEtiquetasPromo([promo({ payment_method_codes: ['nequi'] })], { date: fecha }).length, 0)
  assert.equal(prepararEtiquetasPromo([promo({ end_date: '2026-11-01T00:00:00Z' })], { date: fecha }).length, 0)
})

caso('grupo de clientes: no viaja sin sesión; con sesión, solo si pertenece', () => {
  const fila = promo({ customer_segment_id: 'seg-1' })
  const { publicas, hayDeCliente } = separarPublicas(prepararEtiquetasPromo([fila], { date: fecha }))
  assert.equal(publicas.length, 0)
  assert.equal(hayDeCliente, true)
  assert.equal(prepararEtiquetasPromo([fila], { date: fecha, cliente: { id: 'c', segmentos: [], usos: {} } }).length, 0)
  assert.equal(prepararEtiquetasPromo([fila], { date: fecha, cliente: { id: 'c', segmentos: ['seg-1'], usos: {} } }).length, 1)
})

caso('el ejemplo del 2 X 1 sale del motor del cobro', () => {
  const [p] = prepararEtiquetasPromo([promo({})], { date: fecha })
  assert.equal(promoParaProducto([p], prod)?.id, 'p1')
  assert.equal(promoParaProducto([p], { ...prod, id: 11 }), null)
  const x = explicarPromo(p, prod, 44900, fmt)
  assert.equal(x.titulo, 'Lleva 2, paga 1')
  assert.equal(x.cantidad, 2)
  assert.equal(x.total, 44900)
})

caso('la ficha sigue la regla de la tarjeta', () => {
  const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'ambas' })
  const datos = { discount: 92, outOfStock: false, isParent: false, padreSinVariantes: false, variantCount: 0, salesCount: 776, createdAt: '2026-01-01T00:00:00Z', promoTexto: '2 X 1', volumenTexto: 'Desde 3: −10 %' }
  const foto = etiquetasFicha(o, null, null, datos, '#EA8A2E', 'foto').map((e) => e.tipo)
  // Envío gratis: promesa de la tienda, pide la tarjeta encendida. Nuevo: el producto no es nuevo.
  assert.deepEqual(foto, ['discount', 'promotion', 'volume', 'sales_count'])
  const titulo = etiquetasFicha(o, null, null, datos, '#EA8A2E', 'titulo')
  assert.ok(!titulo.some((e) => e.tipo === 'discount'))
  assert.equal(titulo.find((e) => e.tipo === 'volume').texto, 'Precio por volumen')
  assert.ok(colorDescuentoFicha(o, null))
  const conEnvio = etiquetasFicha(o, { label_shipping: { show: true }, label_discount: { show: false } }, null, datos, '#EA8A2E', 'foto').map((e) => e.tipo)
  assert.ok(conEnvio.includes('free_shipping') && !conEnvio.includes('discount'))
  assert.equal(valorEtiqueta('out_of_stock', { ...datos, discount: null, outOfStock: true }).mostrar, true)
})

caso('la promoción en la tarjeta es opcional', () => {
  const sin = etiquetasDeEstilo({ label_discount: { show: true } }).map((e) => e.type)
  assert.ok(!sin.includes('promotion'))
  const con = etiquetasDeEstilo({ label_promotion: { show: true } }).map((e) => e.type)
  assert.ok(con.includes('promotion'))
})

caso('sin huecos: migas cerca de la cabecera y etiquetas vacías sin alto', () => {
  // Hueco del dueño (org 358, 2026-11-25): entre la barra del contador y las migas quedaban los
  // 48 px del relleno de la ficha en el computador. Las migas suben como en el celular.
  for (const ruta of ['components/sections/product-detail/ProductDetailRenderer.tsx', 'app/productos/[id]/page.tsx']) {
    const fuente = readFileSync(ruta, 'utf8')
    assert.ok(!fuente.includes('md:mt-0 md:mb-8'), `${ruta}: las migas vuelven a dejar el hueco de 48 px`)
    assert.ok(fuente.includes('-mt-7 mb-5 md:-mt-6 md:mb-8'), `${ruta}: migas sin subir en el computador`)
  }
  const etiquetas = readFileSync('components/site/etiquetas/EtiquetasFicha.tsx', 'utf8')
  // Fila junto al título: sin etiquetas (o con la ubicación «Sobre la foto») no pinta nada.
  assert.match(etiquetas, /if \(!ctx \|\| lista\.length === 0\) return null/)
  // Sobre la foto: capas absolutas (no empujan nada) y solo las esquinas con etiquetas.
  assert.match(etiquetas, /pointer-events-none absolute z-20/)
  assert.match(etiquetas, /if \(propias\.length === 0\) return null/)
})

// ── Ronda 2026-11-25 (org 358): promoción una sola vez, formas, cada tipo con datos, muestras ──────

const AHORA = Date.now()
const base = { discount: null, outOfStock: false, isParent: false, padreSinVariantes: false, variantCount: 0, salesCount: 0, createdAt: '2020-01-01T00:00:00Z' }
const sitio2x1 = { labels_custom: [{ id: 'et1', label: '2 X 1', bg: '#E11D2E', text: '#FFFFFF' }] }
const tipos = (l) => l.map((e) => `${e.tipo}:${e.texto}`)

caso('promoción una sola vez: la propia «2 X 1» reemplaza a la automática y la explica', () => {
  const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'ambas' })
  const d = { ...base, discount: 92, promoTexto: '2 X 1' }
  const foto = etiquetasFicha(o, null, sitio2x1, d, '#E8892B', 'foto')
  assert.equal(foto.filter((e) => textoComparableEtiqueta(e.texto) === '2x1').length, 1)
  assert.equal(foto.find((e) => e.texto === '2 X 1').tipo, 'custom')
  assert.equal(foto.find((e) => e.texto === '2 X 1').bg_color, '#E11D2E')
  const titulo = etiquetasFicha(o, null, sitio2x1, d, '#E8892B', 'titulo')
  assert.equal(titulo.filter((e) => e.texto === '2 X 1').length, 1)
  assert.equal(titulo.find((e) => e.texto === '2 X 1').accion, 'promocion')
  // «2x1» escrito distinto también cuenta como la misma.
  assert.equal(etiquetasFicha(o, null, { labels_custom: [{ id: 'a', label: '2x1' }] }, d, '#E8892B', 'foto').filter((e) => textoComparableEtiqueta(e.texto) === '2x1').length, 1)
})

caso('promoción: respeta su interruptor (y el de las propias)', () => {
  const d = { ...base, promoTexto: '2 X 1' }
  const apagada = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'foto', labels_items: [{ id: 'promotion', visible: false }, { id: 'custom', visible: false }] })
  assert.deepEqual(etiquetasFicha(apagada, null, sitio2x1, d, '#E8892B', 'foto').filter((e) => e.texto === '2 X 1'), [])
  const soloPromo = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'foto', labels_items: [{ id: 'custom', visible: false }] })
  assert.deepEqual(tipos(etiquetasFicha(soloPromo, null, sitio2x1, d, '#E8892B', 'foto')), ['promotion:2 X 1'])
  // Con la promoción apagada, la etiqueta PROPIA «2 X 1» sigue (es la que la tienda creó).
  const soloPropia = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'foto', labels_items: [{ id: 'promotion', visible: false }] })
  assert.deepEqual(tipos(etiquetasFicha(soloPropia, null, sitio2x1, d, '#E8892B', 'foto')), ['custom:2 X 1'])
  // Sin promoción real, la automática no sale.
  assert.deepEqual(etiquetasFicha(soloPromo, null, null, base, '#E8892B', 'foto'), [])
})

caso('formas: redonda, semi, cuadrada y círculo se aplican y se distinguen', () => {
  assert.ok(FORMAS_ETIQUETA_FICHA.includes('circle'))
  const radios = new Set(['pill', 'rounded', 'semi', 'square'].map((f) => RADIO_FORMA_ETIQUETA[f]))
  assert.equal(radios.size, 4)
  const d = { ...base, discount: 83, salesCount: 776 }
  for (const forma of ['pill', 'rounded', 'semi', 'square']) {
    const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'ambas', labels_shape: forma })
    for (const donde of ['foto', 'titulo']) assert.ok(etiquetasFicha(o, null, null, d, '#E8892B', donde).every((e) => e.forma === forma), `${forma} en ${donde}`)
  }
  // «Redonda» elegida en la ficha gana a la forma de la tarjeta («semi»).
  const redonda = leerOpcionesEtiquetasFicha({ labels_show: true, labels_shape: 'rounded', labels_placement: 'foto' })
  assert.ok(etiquetasFicha(redonda, { label_shape: 'semi' }, null, d, '#E8892B', 'foto').every((e) => e.forma === 'rounded'))
  // Círculo: textos cortos en círculo; «776 vendidos» no cabe y sale como píldora.
  const circulo = leerOpcionesEtiquetasFicha({ labels_show: true, labels_shape: 'circle', labels_placement: 'foto' })
  const l = etiquetasFicha(circulo, null, sitio2x1, { ...d, createdAt: new Date(AHORA).toISOString() }, '#E8892B', 'foto')
  assert.equal(l.find((e) => e.texto === '-83 %').forma, 'circle')
  assert.equal(l.find((e) => e.texto === '2 X 1').forma, 'circle')
  assert.equal(l.find((e) => e.texto === 'Nuevo').forma, 'circle')
  assert.equal(l.find((e) => e.texto === '776 vendidos').forma, 'pill')
  assert.equal(cabeEnCirculo('Agotado'), false)
  // «De la tarjeta» con círculo: solo el descuento (como en la tarjeta).
  const tarjeta = etiquetasFicha(leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'foto' }), { label_shape: 'circle' }, null, d, '#E8892B', 'foto')
  assert.equal(tarjeta.find((e) => e.tipo === 'discount').forma, 'circle')
  assert.equal(tarjeta.find((e) => e.tipo === 'sales_count').forma, 'pill')
  // La tienda pinta la forma con el radio compartido, en la foto y junto al título.
  const fuente = readFileSync('components/site/etiquetas/EtiquetasFicha.tsx', 'utf8')
  assert.match(fuente, /borderRadius: RADIO_FORMA_ETIQUETA\[e\.forma\]/)
  assert.match(fuente, /e\.forma === 'circle'/)
})

caso('cada tipo sale cuando el producto tiene el dato, en el orden de «Cuáles»', () => {
  const orden = ['sold_out', 'new', 'sales_count', 'volume', 'custom', 'discount', 'promotion', 'free_shipping'].map((id) => ({ id }))
  const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'foto', labels_items: orden })
  const d = { ...base, outOfStock: true, salesCount: 776, createdAt: new Date(AHORA - 3 * 86400000).toISOString(), volumenTexto: 'Desde 3: −10 %' }
  assert.deepEqual(tipos(etiquetasFicha(o, null, { labels_custom: [{ id: 'o', label: 'Originales' }] }, d, '#E8892B', 'foto')),
    ['sold_out:Agotado', 'new:Nuevo', 'sales_count:776 vendidos', 'volume:Desde 3: −10 %', 'custom:Originales'])
  // «Nuevo» ya no lo apaga la tarjeta de fábrica; solo un «no» explícito.
  assert.ok(!etiquetasFicha(o, { label_new: { show: false } }, null, d, '#E8892B', 'foto').some((e) => e.tipo === 'new'))
  // Envío gratis sigue pidiendo la tarjeta encendida (no es un dato del producto).
  assert.ok(!etiquetasFicha(o, null, null, d, '#E8892B', 'foto').some((e) => e.tipo === 'free_shipping'))
  assert.ok(etiquetasFicha(o, { label_shipping: { show: true } }, null, d, '#E8892B', 'foto').some((e) => e.tipo === 'free_shipping'))
  // Sin datos (producto viejo, con stock, sin ventas): no sale ninguna de esas, y ninguna muestra.
  assert.deepEqual(etiquetasFicha(o, null, null, base, '#E8892B', 'foto'), [])
})

caso('vista previa del editor: muestras de lo que el producto no cumple; la tienda nunca', () => {
  const o = leerOpcionesEtiquetasFicha({ labels_show: true, labels_placement: 'ambas' })
  const vista = etiquetasFicha(o, null, null, base, '#E8892B', 'foto', true)
  assert.deepEqual(vista.map((e) => e.tipo), ['discount', 'promotion', 'volume', 'sales_count', 'new', 'sold_out', 'custom'])
  assert.ok(vista.every((e) => e.muestra === true))
  // Lo que sí cumple sale real (sin marca de muestra), y la promoción sigue saliendo una vez.
  const mixta = etiquetasFicha(o, null, sitio2x1, { ...base, salesCount: 776, promoTexto: '2 X 1' }, '#E8892B', 'foto', true)
  assert.equal(mixta.find((e) => e.tipo === 'sales_count').muestra, undefined)
  assert.equal(mixta.filter((e) => textoComparableEtiqueta(e.texto) === '2x1').length, 1)
  const fichaPublica = readFileSync('app/productos/[id]/page.tsx', 'utf8')
  assert.ok(!fichaPublica.includes('muestrasEtiquetas'), 'la ficha pública no pinta muestras')
  assert.match(readFileSync('components/sections/product-detail/FichaEnVivo.tsx', 'utf8'), /muestrasEtiquetas/)
})

caso('«Unidades vendidas»: la ficha recibe las ventas web de la tarjeta', () => {
  const pagina = readFileSync('app/productos/[id]/page.tsx', 'utf8')
  assert.match(pagina, /getWebSalesByProduct\(organization\.id\)/)
  assert.match(pagina, /product: productoFicha,/)
})

caso('la tarjeta tampoco repite la promoción si una propia dice lo mismo', () => {
  assert.match(readFileSync('components/sections/products/ProductCard.tsx', 'utf8'), /promoEnPropia/)
})

console.log(`verify:etiquetas-ficha OK (${ok} casos)`)
