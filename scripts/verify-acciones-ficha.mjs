/**
 * verify-acciones-ficha.mjs — botones de compra configurables de la ficha (Figma «16 Sitio web»,
 * sección 2779:65038, aprobada el 2026-11-22).
 *
 *   npm run verify:acciones-ficha
 *
 * 1. Contrato (lib/website/v2/accionesFicha.ts, copia idéntica del ERP): sin configuración =
 *    «Clásica»; `buttons_layout: 'inline'` = «Dos a la mitad»; regla de filas; sin corazón o sin
 *    número de WhatsApp, los demás ocupan la fila.
 * 2. En el fuente: el bloque lee `actions` con el contrato; el producto simple y el padre con
 *    variantes pintan las mismas filas (sin otra lógica de carrito); el restaurante sigue sin
 *    corazón; la barra fija lleva el corazón y respeta `sticky_mobile` y el precio en el botón;
 *    el favorito sigue siendo BotonGuardarFicha (su lógica, su interruptor «Corazón en la ficha»).
 */
import { readFileSync } from 'node:fs'
import {
  DISTRIBUCIONES,
  accionesVisibles,
  armarFilas,
  enlaceWhatsappFicha,
  leerAccionesFicha,
  mensajeWhatsappFicha,
} from '../lib/website/v2/accionesFicha.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const filas = (acciones, disp = {}) => armarFilas(accionesVisibles(acciones, disp)).map((f) => f.map((x) => x.tipo))
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8')

// ── 1. Contrato ──
const clasica = leerAccionesFicha({})
check(clasica.preset === 'clasica' && !clasica.configurado, 'sin claves: «Clásica», sin marcar configurado')
check(igual(filas(clasica.acciones), [['cantidad'], ['agregar', 'favorito'], ['comprar']]), 'Clásica: cantidad · Agregar + corazón · Comprar ahora')
check(clasica.acciones.find((x) => x.tipo === 'comprar').estilo === 'borde', 'Clásica: Comprar ahora con borde')
check(leerAccionesFicha({ buttons_layout: 'inline' }).preset === 'dos_mitad', 'buttons_layout inline = «Dos a la mitad»')
check(leerAccionesFicha({ buttons_layout: 'split' }).preset === 'clasica', 'buttons_layout split = «Clásica»')
check(igual(filas(DISTRIBUCIONES.compacta), [['cantidad', 'agregar', 'favorito'], ['comprar']]), 'Compacta: una fila con cantidad + Agregar + corazón')
check(igual(filas(DISTRIBUCIONES.clasica, { favorito: false }), [['cantidad'], ['agregar'], ['comprar']]), 'sin corazón, Agregar ocupa la fila')
check(igual(filas(DISTRIBUCIONES.con_whatsapp, { whatsapp: false }), [['cantidad'], ['agregar', 'favorito'], ['comprar']]), 'sin número, WhatsApp no sale')
check(enlaceWhatsappFicha('', 'x') === null, 'WhatsApp sin número: sin enlace')
check(
  enlaceWhatsappFicha('3001234567', mensajeWhatsappFicha('Gorra', 'Color: Rojo', 'https://t.test/p/1'))
    === `https://wa.me/573001234567?text=${encodeURIComponent('Hola, me interesa Gorra (Color: Rojo). https://t.test/p/1')}`,
  'WhatsApp: mensaje con producto, variante y enlace',
)
const agregarOculto = leerAccionesFicha({ actions: [{ tipo: 'agregar', visible: false }] })
check(agregarOculto.acciones.find((x) => x.tipo === 'agregar').visible === true, '«Agregar al carrito» no se puede ocultar')

// ── 2. Fuente ──
const bloque = leer('components/sections/product-detail/ProductActions.tsx')
check(bloque.includes('leerAccionesFicha(content as Record<string, unknown>)') && bloque.includes('acciones={acciones}'), 'el bloque lee `actions` con el contrato')
check(bloque.includes("'actions', 'preset'"), 'CONTENT_KEYS declara actions y preset')

const acciones = leer('app/productos/[id]/ProductDetailActions.tsx')
check((acciones.match(/<FilasAccionesFicha/g) || []).length === 2, 'producto simple y padre con variantes usan las mismas filas')
check(acciones.includes('pintarAcciones={(a) => ('), 'el padre con variantes pinta las filas desde VariantSelector (su carrito y su stock)')
check(acciones.includes('const favorito = restaurante ? null :'), 'el restaurante sigue sin corazón')
check(!acciones.includes('localStorage'), 'las acciones no escriben el carrito a mano')
check(acciones.includes('leerAccionesFicha({ buttons_layout: buttonsLayout })'), 'sin `acciones`, la compatibilidad con buttons_layout')

const selector = leer('components/site/VariantSelector.tsx')
check(selector.includes('pintarAcciones ? (') && selector.includes('onClick: handleAddToCart,'), 'VariantSelector: las filas usan su mismo «Agregar»')

const filasFuente = leer('components/site/ficha/FilasAccionesFicha.tsx')
check(filasFuente.includes('<BotonGuardarFicha'), 'el favorito es BotonGuardarFicha (sin otra lógica de favoritos)')
check(filasFuente.includes('favorito: !!favorito && favoritos.corazonFicha'), '«Corazón en la ficha» apagado: el corazón no cuenta para las filas')
check(filasFuente.includes('navigator.share') && filasFuente.includes('navigator.clipboard.writeText'), 'Compartir: Web Share con respaldo «copiar enlace»')

const guardar = leer('components/site/favoritos/BotonGuardarFicha.tsx')
check(guardar.includes('if (!favoritos.corazonFicha) return null') && guardar.includes('alternarFavoritoTienda('), 'BotonGuardarFicha conserva su interruptor y su lógica')
check(guardar.includes("tamano = 'pequeno'"), 'el corazón de la ficha es pequeño por defecto')

const boton = leer('components/site/ficha/BotonAccionFicha.tsx')
check(boton.includes("tamano === 'pequeno' ? 'w-12 shrink-0 px-0'") && boton.includes('h-12'), 'Pequeño: cuadrado de 48 px')

const barra = leer('components/site/StickyAddToCart.tsx')
check(barra.includes('{conFavorito && <BotonGuardarFicha'), 'barra fija: corazón al lado de Agregar')
const pagina = leer('app/productos/[id]/page.tsx')
check(pagina.includes('conFavorito={!esRestaurante}'), 'barra fija: sin corazón en el restaurante')
check(pagina.includes('const barraFija = contenidoAcciones.sticky_mobile !== false'), 'barra fija: respeta «Barra fija en el celular»')
check(pagina.includes('(await getAjustesSitio(organization.id)).whatsapp?.numero'), 'WhatsApp: número del sitio, de la lectura en caché')

if (problemas.length > 0) {
  console.error(`✗ verify-acciones-ficha: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-acciones-ficha: ${casos} comprobaciones`)
