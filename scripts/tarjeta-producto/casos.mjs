/**
 * Casos de la tarjeta de producto para `verify:tarjeta-producto` (datos sintéticos).
 *
 * - `CASOS_SIN_CLAVES`: estilos SIN ninguna clave nueva de las plantillas de tienda. Su HTML tiene
 *   que ser byte a byte el de `main`.
 * - `CASOS_NUEVOS`: las tarjetas de las 7 plantillas (PLANO §4) y cada clave nueva por separado.
 *   Solo se pintan en la rama; el verify revisa el marcado esperado.
 */

const img = (storage_path, is_primary) => ({ storage_path, is_primary })
const precio = (price, compare_price = null) => [{ id: 1, price, compare_price, effective_to: null }]

const base = {
  organization_id: 900,
  sku: 'SKU',
  created_at: '2020-01-01T00:00:00Z',
  category_id: 1,
  categories: { name: 'Sillas' },
  description: '<p>Roble macizo aceitado</p><p>Hecha a mano</p>',
  brand: 'Taller Norte',
  reference: 'RF-0101',
  length_cm: 45,
  width_cm: 50,
  height_cm: '82.5',
}

export const PRODUCTOS = {
  simple: { ...base, id: 1, uuid: 'u-1', name: 'Silla Terra', product_prices: precio(389000), product_images: [img('org/a.jpg', true)] },
  oferta: { ...base, id: 2, uuid: 'u-2', name: 'Sillón Nube de tres puestos con brazos anchos', product_prices: precio(2099000, 2990000), product_images: [img('org/b.jpg', true), img('org/b2.jpg', false)] },
  padre: { ...base, id: 3, uuid: 'u-3', name: 'Abrigo cruzado de lana doble', is_parent: true, variant_count: 4, product_prices: precio(1890000), product_images: [img('org/c.jpg', true), img('org/c2.jpg', false)] },
  padreSinVariantes: { ...base, id: 4, uuid: 'u-4', name: 'Jean recto', is_parent: true, variant_count: 0, product_prices: precio(180000), product_images: [img('org/d.jpg', true)] },
  agotado: { ...base, id: 5, uuid: 'u-5', name: 'Lámpara Luna', track_stock: true, stock_levels: [{ branch_id: 1, qty_on_hand: 0, qty_reserved: 0 }], product_prices: precio(289000), product_images: [img('org/e.jpg', true)] },
  sinFoto: { ...base, id: 6, uuid: 'u-6', name: 'Mesa auxiliar', category_id: 2, categories: { name: 'Mesas' }, brand: null, reference: '', length_cm: null, description: null, product_prices: precio(120000), product_images: [] },
  vendido: { ...base, id: 7, uuid: 'u-7', name: 'Sérum Luz', sales_count: 180, rating_avg: 4.9, reviews_count: 499, product_prices: precio(89900, 109900), product_images: [img('org/f.jpg', true), img('org/f2.jpg', false)] },
}

// ── Estilos sin claves nuevas ─────────────────────────────────────────────────────────────
// Las tarjetas de las 7 plantillas con las claves nuevas quitadas (y `beside_title`/`soft`
// cambiados por el valor de hoy más cercano): lo que una tienda de hoy podría tener guardado.
const PANORAMA_HOY = { card_preset: 'boxed', add: { button_style: 'icon_only', button_shape: 'circle', button_size: 'md', button_width: 'auto', button_position: 'inline_price', button_visibility: 'always', icon: 'ArrowRight' }, label_shape: 'pill', label_style: 'soft', label_position: 'top_left', text_align: 'left', price_position: 'beside_button', price_size: 'lg', show_compare_price: false, show_reviews: false, title_lines: 2, title_weight: 'semibold', title_size: 'md', show_brand: false, show_category: true, card_layout: 'vertical', card_radius: 12, card_border_width: 0, card_shadow: 'none', card_padding: 20, image_ratio: '4:3', image_fit: 'contain', image_bg: 'transparent', image_padding: 0, image_radius: 0, hover_image: 'zoom' }
const ATELIER_HOY = { card_preset: 'minimal', add: { button_style: 'ghost', button_shape: 'square', button_size: 'sm', button_width: 'full', button_position: 'over_image_bottom', button_visibility: 'hover', icon: 'Plus', icon_side: 'right' }, choose: { button_style: 'ghost', button_shape: 'square', button_size: 'sm', button_width: 'full', button_position: 'over_image_bottom', button_visibility: 'hover', icon: 'Plus', icon_side: 'right' }, label_shape: 'square', label_style: 'outline', label_position: 'top_left', label_shipping: { show: false }, label_discount: { show: false }, text_align: 'left', price_size: 'sm', show_compare_price: false, show_reviews: false, title_lines: 1, title_weight: 'normal', title_size: 'lg', show_brand: false, show_category: false, card_radius: 0, card_border_width: 0, card_shadow: 'none', card_padding: 0, image_ratio: '3:4', image_fit: 'contain', image_bg: '#E6E1D9', image_padding: 32, image_radius: 0, hover_image: 'second' }
const RADIANTE_HOY = { card_preset: 'boxed', add: { button_style: 'solid', button_shape: 'pill', button_size: 'md', button_width: 'full', button_position: 'bottom', button_visibility: 'always', icon: '' }, label_shape: 'pill', label_style: 'solid', label_position: 'top_left', label_new: { bg: '#F2F06B', text: '#141414' }, text_align: 'left', price_position: 'below_title', price_size: 'md', show_compare_price: true, show_reviews: true, reviews_position: 'below_title', reviews_style: 'stars', title_lines: 2, title_weight: 'normal', title_size: 'md', show_category: true, card_radius: 24, card_border_width: 0, card_shadow: 'none', card_padding: 12, card_bg: '#F6F4F1', image_ratio: '1:1', image_fit: 'contain', image_bg: '#FFFFFF', image_padding: 24, image_radius: 12, hover_image: 'second' }
const ROBLE_HOY = { card_preset: 'minimal', add: { button_style: 'icon_only', button_shape: 'square', button_size: 'md', button_width: 'auto', button_position: 'over_image_corner', button_visibility: 'hover', icon: 'Plus' }, label_style: 'soft', label_shape: 'square', label_position: 'top_left', text_align: 'left', price_size: 'sm', show_compare_price: true, show_reviews: false, title_lines: 1, title_weight: 'normal', title_size: 'sm', show_category: false, card_radius: 0, card_padding: 0, image_ratio: '4:5', image_fit: 'cover', image_bg: '#E3E3DC', image_padding: 0, image_radius: 0, hover_image: 'second' }
const MAREA_HOY = { card_preset: 'minimal', card_layout: 'vertical', text_align: 'left', title_lines: 1, title_weight: 'medium', title_size: 'sm', price_size: 'sm', show_compare_price: true, show_reviews: false, show_brand: false, show_category: false, image_ratio: '4:5', image_fit: 'contain', image_bg: '#E2DACD', image_padding: 0, image_radius: 0, hover_image: 'second', card_radius: 0, card_border_width: 0, card_shadow: 'none', card_padding: 0, add: { button_style: 'icon_only', button_shape: 'circle', button_size: 'sm', button_width: 'auto', button_position: 'over_image_corner', button_visibility: 'hover', icon: 'Plus' }, label_shape: 'square', label_style: 'solid', label_position: 'top_left', label_shipping: { show: false } }
const CONTRASTE_HOY = { card_preset: 'boxed', add: { button_style: 'icon_only', button_shape: 'circle', button_size: 'md', button_width: 'auto', button_position: 'over_image_corner', button_visibility: 'hover', icon: 'ShoppingBag' }, label_shape: 'square', label_style: 'solid', label_position: 'top_left', label_shipping: { show: false }, text_align: 'left', price_position: 'below_title', price_size: 'md', show_compare_price: true, show_reviews: false, title_lines: 1, title_weight: 'semibold', title_size: 'lg', card_radius: 0, card_border_width: 1, card_shadow: 'none', card_padding: 20, image_ratio: '4:5', image_fit: 'contain', image_bg: '#F0F0F0', image_padding: 0, image_radius: 0, hover_image: 'zoom' }
const HOGAR_HOY = { card_preset: 'minimal', add: { button_style: 'solid', button_shape: 'pill', button_size: 'sm', button_width: 'full', button_position: 'over_image_bottom', button_visibility: 'hover', icon: 'ShoppingBag', icon_side: 'left' }, label_shape: 'pill', label_style: 'soft', label_position: 'top_left', text_align: 'left', price_position: 'below_title', price_size: 'md', show_compare_price: true, show_reviews: false, title_lines: 1, title_weight: 'medium', title_size: 'md', show_category: true, card_radius: 0, card_padding: 0, image_ratio: '1:1', image_fit: 'contain', image_bg: '#F3F0EB', image_padding: 24, image_radius: 12, hover_image: 'second' }

const ESTILOS_HOY = {
  ninguno: [null, null],
  actual: [{ card_preset: 'actual' }, null],
  minimal: [{ card_preset: 'minimal' }, null],
  boxed: [{ card_preset: 'boxed' }, null],
  overlay: [{ card_preset: 'overlay' }, null],
  compact: [{ card_preset: 'compact' }, null],
  rich: [{ card_preset: 'rich' }, null],
  panorama: [PANORAMA_HOY, null],
  atelier: [ATELIER_HOY, null],
  radiante: [RADIANTE_HOY, null],
  roble: [ROBLE_HOY, null],
  marea: [MAREA_HOY, null],
  contraste: [CONTRASTE_HOY, null],
  hogar: [HOGAR_HOY, null],
  seccionPisa: [{ card_preset: 'boxed' }, { add: { button_style: 'outline', button_shape: 'semi' }, price_position: 'above_title' }],
  soloSeccion: [null, { card_preset: 'rich', reviews_position: 'over_image', price_position: 'over_image' }],
  contador: [{ add: { button_style: 'icon_only', button_shape: 'circle', quantity_stepper: true } }, null],
  vendidosPropias: [{ show_sales_count: true, labels_custom: [{ id: 'o', label: 'Originales', bg: '#FACC15' }] }, null],
  horizontal: [{ card_layout: 'horizontal', label_style: 'soft', label_position: 'over_title', show_brand: true, show_category: true }, null],
  gradiente: [{ card_bg: '#FFFFFF', card_bg_2: '#F3F0EB', add: { button_style: 'gradient', gradient_1: '#111111', gradient_2: '#555555', hover: '#000000' } }, null],
}

const BOTONES_SECCION = [
  { action: 'add_to_cart', label: 'Agregar' },
  { action: 'wishlist', icon_only: true, position: 'overlay_top_right' },
  { action: 'quick_view', position: 'below' },
]

const LEGADO_SECCION = { card_radius: 4, show_description: true, choose_button_label: 'Ver tallas', add_button_label: 'Sumar', price_color: '#B4583A' }

export const CASOS_SIN_CLAVES = []
for (const [nombreEstilo, [sitio, seccion]] of Object.entries(ESTILOS_HOY)) {
  for (const [nombreProducto, product] of Object.entries(PRODUCTOS)) {
    const cardStyle = seccion ? { product_card_style: seccion } : undefined
    CASOS_SIN_CLAVES.push({ id: `${nombreEstilo}·${nombreProducto}·grid`, sitio, props: { product, cardStyle, variant: 'grid' } })
  }
  for (const variant of ['list', 'compact', 'overlay']) {
    for (const nombreProducto of ['oferta', 'padre']) {
      CASOS_SIN_CLAVES.push({ id: `${nombreEstilo}·${nombreProducto}·${variant}`, sitio, props: { product: PRODUCTOS[nombreProducto], cardStyle: seccion ? { product_card_style: seccion } : undefined, variant } })
    }
  }
  for (const nombreProducto of ['simple', 'padre', 'vendido']) {
    CASOS_SIN_CLAVES.push({
      id: `${nombreEstilo}·${nombreProducto}·botones-legado`,
      sitio,
      props: { product: PRODUCTOS[nombreProducto], cardStyle: { ...LEGADO_SECCION, ...(seccion ? { product_card_style: seccion } : {}) }, cardButtons: BOTONES_SECCION, buttonsLayout: 'row', showBuyNow: false },
    })
  }
}

// ── Claves nuevas (solo en la rama) ───────────────────────────────────────────────────────
export const TARJETAS_PLANTILLA = {
  panorama: { ...PANORAMA_HOY, price_prefix: 'desde', card_subtitle: 'description' },
  atelier: { ...ATELIER_HOY, price_position: 'beside_title', title_font: 'heading' },
  radiante: { ...RADIANTE_HOY, add: { ...RADIANTE_HOY.add, button_style: 'soft' }, price_position: 'beside_title', title_font: 'heading', wishlist_style: 'circle', wishlist_position: 'top_right' },
  roble: { ...ROBLE_HOY, price_position: 'beside_title', card_subtitle: 'dimensions' },
  marea: { ...MAREA_HOY, price_position: 'beside_title' },
  contraste: { ...CONTRASTE_HOY, title_font: 'heading', card_grid_lines: true },
  hogar: { ...HOGAR_HOY, wishlist_style: 'circle', wishlist_position: 'top_right', choose_label: 'Elige una opción' },
}

export const CASOS_NUEVOS = []
for (const [plantilla, sitio] of Object.entries(TARJETAS_PLANTILLA)) {
  for (const [nombreProducto, product] of Object.entries(PRODUCTOS)) {
    CASOS_NUEVOS.push({ id: `plantilla:${plantilla}·${nombreProducto}`, sitio, props: { product, variant: 'grid' } })
  }
}
const sueltas = {
  subtituloMarca: { card_subtitle: 'brand' },
  subtituloReferencia: { card_subtitle: 'reference' },
  subtituloMedidas: { card_subtitle: 'dimensions' },
  subtituloDescripcion: { card_subtitle: 'description' },
  subtituloNada: { card_subtitle: 'none', card_radius: 12 },
  desde: { price_prefix: 'desde' },
  desdeArriba: { price_prefix: 'desde', price_position: 'above_title' },
  desdeBoton: { price_prefix: 'desde', price_position: 'beside_button', add: { button_position: 'inline_price', button_style: 'icon_only', button_shape: 'circle' } },
  junto: { price_position: 'beside_title' },
  fuente: { title_font: 'heading' },
  lineas: { card_grid_lines: true, card_radius: 16, card_shadow: 'lg' },
  favCirculo: { wishlist_style: 'circle' },
  favGhostIzq: { wishlist_style: 'ghost', wishlist_position: 'top_left' },
  favNinguno: { wishlist_style: 'none' },
  desliza: { hover_image: 'second', hover_image_transition: 'slide' },
  elegir: { choose_label: '  Elige   tu talla  ' },
  suave: { add: { button_style: 'soft' }, choose: { button_style: 'soft' } },
}
for (const [nombre, sitio] of Object.entries(sueltas)) {
  for (const nombreProducto of ['simple', 'oferta', 'padre', 'sinFoto']) {
    CASOS_NUEVOS.push({ id: `suelta:${nombre}·${nombreProducto}`, sitio, props: { product: PRODUCTOS[nombreProducto], variant: 'grid', cardButtons: nombre.startsWith('fav') ? BOTONES_SECCION : undefined } })
  }
}

// Valores por defecto o inválidos de las claves nuevas sobre un estilo de hoy: el HTML es el de
// `main` (inválido = no se escribe; por defecto = lo de hoy).
const POR_DEFECTO = { card_subtitle: 'none', price_prefix: 'none', title_font: 'body', hover_image_transition: 'fade', wishlist_position: 'top_right' }
const INVALIDOS = { card_subtitle: 'specs', price_prefix: 'si', title_font: 'serif', card_grid_lines: 'true', wishlist_style: 'square', wishlist_position: 'abajo', hover_image_transition: 'zoom', choose_label: '    ', price_position: 'inline_title' }
for (const [nombreEstilo, [sitio, seccion]] of Object.entries(ESTILOS_HOY)) {
  if (!sitio && !seccion) continue
  if (nombreEstilo === 'actual') continue
  for (const [nombreExtra, extra] of Object.entries({ porDefecto: POR_DEFECTO, invalidos: INVALIDOS })) {
    for (const nombreProducto of ['oferta', 'padre', 'sinFoto']) {
      CASOS_SIN_CLAVES.push({
        id: `${nombreEstilo}+${nombreExtra}·${nombreProducto}·grid`,
        sitio: sitio ? { ...sitio, ...extra } : sitio,
        props: { product: PRODUCTOS[nombreProducto], cardStyle: seccion ? { product_card_style: { ...seccion, ...extra } } : undefined, variant: 'grid' },
      })
    }
  }
}

// ── Rejilla de productos (ProductsGrid) ───────────────────────────────────────────────────
export const CATEGORIAS = [{ id: 1, name: 'Sillas' }, { id: 2, name: 'Mesas' }]
export const CASOS_REJILLA_SIN_CLAVES = [
  { id: 'rejilla:vacia', sitio: null, content: {} },
  { id: 'rejilla:titulo-columnas', sitio: null, content: { title: 'Lo más pedido', columns: 3, show_search: true } },
  { id: 'rejilla:estilo-sitio', sitio: { card_preset: 'boxed', card_gap: 20 }, content: { title: 'Más vendidos' } },
  { id: 'rejilla:estilo-seccion', sitio: null, content: { product_card_style: { card_preset: 'minimal' }, filter_active_bg: '#111111' } },
  { id: 'rejilla:barra-nueva', sitio: null, content: { chip_style: 'square', show_count: false } },
  { id: 'rejilla:carrusel', sitio: { card_preset: 'boxed' }, content: { display_mode: 'carousel' } },
  { id: 'rejilla:sin-filtros', sitio: null, content: { show_filters: false } },
  { id: 'rejilla:pestanas-chips', sitio: null, content: { tabs_style: 'chips' } },
  { id: 'rejilla:pestanas-invalidas', sitio: null, content: { tabs_style: 'texto_subrayado' } },
  { id: 'rejilla:lineas-falso', sitio: { card_grid_lines: false, card_preset: 'boxed' }, content: { product_card_style: { card_grid_lines: 'si' } } },
]
export const CASOS_REJILLA_NUEVOS = [
  { id: 'rejilla:lineas-sitio', sitio: { card_grid_lines: true }, content: { title: 'Rejilla' } },
  { id: 'rejilla:lineas-seccion', sitio: null, content: { product_card_style: { card_grid_lines: true, card_gap: 24 } } },
  { id: 'rejilla:lineas-carrusel', sitio: { card_grid_lines: true }, content: { display_mode: 'carousel' } },
  { id: 'rejilla:subrayado', sitio: null, content: { tabs_style: 'underline' } },
  { id: 'rejilla:subrayado-colores', sitio: null, content: { tabs_style: 'underline', filter_active_text: '#2E2E2A' } },
  { id: 'rejilla:subrayado-barra-nueva', sitio: null, content: { tabs_style: 'underline', chip_style: 'square' } },
]
