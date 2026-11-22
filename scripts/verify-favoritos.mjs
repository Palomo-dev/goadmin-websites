/**
 * verify-favoritos.mjs — favoritos de la tienda y modos del botón del carrito (Figma «16 Sitio web»
 * 2762:61067 y 2773:62797–2777:64932, aprobados el 2026-11-22).
 *
 *   npm run verify:favoritos
 *
 * Qué comprueba:
 * 1. Lógica pura (lib/favoritos/logica.ts): lo guardado en el dispositivo con el código anterior
 *    (lista de ids) se sigue leyendo; juntar dispositivo + cuenta sin duplicar; ordenar; «Bajó de
 *    precio»; insignias y botón; sugerencias; ids de la consulta y token de lista compartida.
 * 2. Contrato (cabeceraTienda.ts): forma vieja del botón intacta, modo desconocido = lo de hoy,
 *    los cuatro modos, /carrito comparte o no, y `header_favoritos` con sus valores por defecto.
 * 3. En el fuente: la organización sale del host (nunca del body), /mi-cuenta/favoritos redirige
 *    a /favoritos antes del login, el corazón de la cabecera ya no enlaza a la ruta vieja y las
 *    tarjetas no consultan la sesión cada una.
 */
import { existsSync, readFileSync } from 'node:fs'
import {
  bajoDePrecio,
  elegirSugerencias,
  escribirDispositivo,
  estadoFavorito,
  fichasAgregables,
  idsDeConsulta,
  juntarFavoritos,
  leerDispositivo,
  ordenarFichas,
  resumenFavoritos,
  tokenListaValido,
} from '../lib/favoritos/logica.ts'
import {
  indiceAlAbrir,
  opcionesCarrito,
  opcionesFavoritos,
  reglaBotonCarrito,
  textoBotonCarrito,
  transicionBotonCarrito,
} from '../lib/website/v2/cabeceraTienda.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// ─── 1. Lógica ───────────────────────────────────────────────────────────────────────────────
const viejo = leerDispositivo([5, '7', 5, 'x', -1], null)
check(igual(viejo.map((f) => f.productId), [5, 7]), 'dispositivo: la lista vieja de ids se lee (sin repetidos ni basura)')
check(viejo[1].guardadoEn > viejo[0].guardadoEn, 'dispositivo: sin fecha, el último de la lista es el más reciente')
const ida = escribirDispositivo([{ productId: 9, variantId: null, guardadoEn: '2026-11-20T10:00:00.000Z', precioAlGuardar: 1000 }])
check(igual(ida.ids, [9]) && ida.meta['9'].p === 1000, 'dispositivo: escribe ids (formato de siempre) y meta con precio')
check(leerDispositivo(ida.ids, ida.meta)[0].precioAlGuardar === 1000, 'dispositivo: ida y vuelta conserva el precio al guardar')

const f = (productId, guardadoEn, precioAlGuardar = null) => ({ productId, variantId: null, guardadoEn, precioAlGuardar })
const cuenta = [f(1, '2026-11-01T00:00:00.000Z'), f(2, '2026-11-02T00:00:00.000Z')]
const dispositivo = [f(2, '2026-11-10T00:00:00.000Z'), f(3, '2026-11-11T00:00:00.000Z')]
const juntos = juntarFavoritos(cuenta, dispositivo)
check(igual(juntos.nuevos.map((x) => x.productId), [3]), 'juntar: solo se agregan los que la cuenta no tiene')
check(igual(juntos.todos.map((x) => x.productId), [3, 2, 1]), 'juntar: sin duplicar y los más recientes primero')
check(juntos.todos.find((x) => x.productId === 2).guardadoEn === '2026-11-02T00:00:00.000Z', 'juntar: si está en los dos, se queda el de la cuenta')

const ficha = (id, extra = {}) => ({
  id, uuid: null, nombre: `P${id}`, categoriaId: 1, categoria: 'Audio', precio: 100, precioAnterior: null, imagen: null, sku: null,
  esPadre: false, variantes: null, requiereElegir: false, stock: null, ventas: 0, ...extra,
})
check(bajoDePrecio(229900, 189900) && !bajoDePrecio(100, 100) && !bajoDePrecio(null, 50), '«Bajó de precio»: solo si el de hoy es menor que el guardado')
check(estadoFavorito(ficha(1, { stock: 0 }), { precioAlGuardar: 500 }).insignia === 'agotado', 'insignia: Agotado gana')
check(estadoFavorito(ficha(1, { stock: 2 }), { precioAlGuardar: 500 }).insignia === 'bajo_precio', 'insignia: Bajó de precio sobre Pocas unidades')
check(estadoFavorito(ficha(1, { stock: 2 })).quedan === 2, '«Quedan 2» con pocas unidades')
check(estadoFavorito(ficha(1, { esPadre: true, variantes: 3 })).accion === 'elegir', 'padre con variantes: Elegir')
check(estadoFavorito(ficha(1, { esPadre: true, variantes: 0 })).accion === 'no_disponible', 'padre sin variantes: No disponible')
const lista = [ficha(1, { precio: 300, nombre: 'Zeta' }), ficha(2, { precio: null, nombre: 'alfa' }), ficha(3, { precio: 100, nombre: 'Beta', stock: 0 })]
check(igual(ordenarFichas(lista, 'precio_asc').map((x) => x.id), [3, 1, 2]), 'ordenar: precio menor a mayor (sin precio al final)')
check(igual(ordenarFichas(lista, 'precio_desc').map((x) => x.id), [1, 3, 2]), 'ordenar: precio mayor a menor')
check(igual(ordenarFichas(lista, 'nombre').map((x) => x.id), [2, 3, 1]), 'ordenar: nombre A–Z sin mayúsculas')
check(igual(ordenarFichas(lista, 'recientes', [f(1, '2026-01-01T00:00:00Z'), f(2, '2026-03-01T00:00:00Z'), f(3, '2026-02-01T00:00:00Z')]).map((x) => x.id), [2, 3, 1]), 'ordenar: recientes')
const res = resumenFavoritos(lista)
check(res.productos === 3 && res.disponibles === 1 && res.agregables === 1 && fichasAgregables(lista).length === 1, 'resumen: productos, disponibles y agregables')
const catalogo = [ficha(10, { categoriaId: 1, ventas: 5 }), ficha(11, { categoriaId: 2, ventas: 50 }), ficha(12, { categoriaId: 1, ventas: 9, stock: 0 }), ficha(13, { categoriaId: 2, precioAnterior: 200, ventas: 1 })]
check(igual(elegirSugerencias(catalogo, [ficha(1)], 'categorias').map((x) => x.id), [10]), 'sugerencias: mismas categorías, sin agotados ni favoritos')
check(elegirSugerencias(catalogo, [], 'categorias')[0].id === 11, 'sugerencias: sin favoritos caen a más vendidos')
check(elegirSugerencias(catalogo, [], 'destacados')[0].id === 13, 'sugerencias: destacados empiezan por las ofertas')
check(igual(idsDeConsulta('3,1,3,x,0,2'), [3, 1, 2]), '?ids= se limpia')
check(tokenListaValido('abcDEF123_-xy') && !tokenListaValido('corto') && !tokenListaValido("a'; drop"), 'token de lista compartida')

// ─── 2. Contrato ─────────────────────────────────────────────────────────────────────────────
check(opcionesCarrito({ header_carrito: { boton: { modo: 'al_abrir', textos: ['X', 'Y'], orden: 'azar' } } }).boton.modo === 'al_abrir', 'forma vieja del botón: intacta')
check(opcionesCarrito({ cart_button_mode: 'fixed', cart_button_texts: ['Pagar'], header_carrito: { boton: { modo: 'otro' } } }).boton.modo === 'fijo', 'modo desconocido: la fila legacy (lo de hoy)')
check(opcionesCarrito({}).botonPagina === null, '/carrito sin configuración: el botón de hoy')
check(igual([0, 1, 2, 0].map((_, i, a) => a.slice(0, i).reduce((ant) => indiceAlAbrir({ modo: 'al_abrir', textos: ['a', 'b', 'c'], orden: 'orden' }, ant), null)), [null, 0, 1, 2]), 'al abrir en orden: 1.º, 2.º, 3.º')
check(indiceAlAbrir({ modo: 'al_abrir', textos: ['a', 'b'], orden: 'azar' }, 0, () => 0) === 1, 'al abrir al azar: no repite el anterior')
check(transicionBotonCarrito({ modo: 'mientras_abierto', textos: ['a'], transicion: 'deslizar' }, true) === 'ninguna', '«reducir movimiento»: sin efecto')
check(reglaBotonCarrito({}, { subtotal: 50, topeEnvioGratis: 100, hayOferta: true }).regla === 'faltaEnvio', 'según el carrito: falta para envío gratis primero')
check(reglaBotonCarrito({ reglas: { faltaEnvio: '' } }, { subtotal: 50, topeEnvioGratis: 100, hayOferta: false }).regla === 'porDefecto', 'según el carrito: vacío salta')
check(textoBotonCarrito({ modo: 'segun_carrito', textos: [] }) === 'Comprar ahora', 'según el carrito sin datos: por defecto')
const fav = opcionesFavoritos(null)
check(!fav.configurado && fav.alTocar === 'panel' && fav.contador && fav.compartir && fav.corazonTarjetas, 'favoritos sin configurar: valores del diseño')

// ─── 3. Fuente ───────────────────────────────────────────────────────────────────────────────
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')
const api = leer('app/api/favorites/route.ts')
check(api.includes('contextoFavoritos()') && api.includes('Organización no permitida') && !/\.eq\('organization_id', Number\(organizationId\)\)/.test(api), '/api/favorites: organización del host; la del body solo se rechaza')
const servidor = leer('lib/favoritos/servidor.ts')
check(servidor.includes('getOrgIdDelHost()') && servidor.includes(".eq('user_id', user.id)"), 'servidor: organización del host y cliente de la sesión')
check(servidor.includes('esTablaFaltante(error)'), 'servidor: sin la tabla, respaldo en customers.metadata')
const mw = leer('middleware.ts')
check(/\\\/mi-cuenta\\\/favoritos/.test(mw) && mw.includes("'/favoritos'"), 'middleware: /mi-cuenta/favoritos → /favoritos antes del login')
check(existsSync(new URL('../app/favoritos/page.tsx', import.meta.url)), 'existe la página pública /favoritos')
const cabecera = leer('components/site/header/HeaderShared.tsx')
check(!cabecera.includes('href="/mi-cuenta/favoritos"') && cabecera.includes('<AccesoFavoritosCabecera'), 'el corazón de la cabecera abre el panel o /favoritos')
const tarjeta = leer('components/sections/products/ProductCard.tsx')
check(!tarjeta.includes('useAuthCustomer(') && tarjeta.includes('useFavorites()'), 'las tarjetas leen el almacén único (no consultan la sesión cada una)')
const layout = leer('components/site/OrganizationLayoutCliente.tsx')
check(layout.includes('<FavoritosDrawer') && layout.includes('<AvisoFavoritos />') && layout.includes('favoritosAbiertoRef.current'), 'panel y avisos montados; «Agregar» en el panel no abre el carrito encima')
const pagina = leer('app/carrito/CartPageClient.tsx')
check(pagina.includes('<TextoBotonCarrito boton={botonPagina}') && pagina.includes('checkoutButtonText'), '/carrito usa la configuración (o el texto de hoy sin ella)')

if (problemas.length) {
  console.error(`✗ verify-favoritos: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-favoritos: ${casos} comprobaciones`)
