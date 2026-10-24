/**
 * verify-constructor-header.mjs — sin constructor, el header y el buscador de hoy.
 *
 *   npm run verify:constructor-header
 */
import { readFileSync } from 'node:fs'
import { alineacionBuscador, buscadorEnBarra, contenedorDe, leerConstructor, radioForma, zonasConMenus } from '../lib/website/constructorEncabezado.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => { casos++; if (!cond) problemas.push(msg) }

check(leerConstructor(null) === null, 'sin ajustes no hay constructor')
check(leerConstructor({}) === null, 'vacío sigue el header de hoy')
check(leerConstructor({ search_style: 'icon' }) === null, 'ícono de hoy no es un cromo nuevo')
check(leerConstructor({ search_style: 'bar' }) === null, 'la barra de hoy no cambia')
check(leerConstructor({ search_style: 'hidden' }) === null, 'buscador oculto sigue oculto')
check(leerConstructor({ header_builder: null }) === null, 'builder nulo no pinta zonas')
check(leerConstructor({ header_builder: { zones: {} } }) === null, 'zonas vacías no reemplazan el header')

for (const tipo of ['mini', 'icon_overlay', 'mega', 'pill_floating']) {
  const c = leerConstructor({ search_style: tipo })
  check(c?.buscador?.tipo === tipo && c.zonas === null, `${tipo} solo cambia la presentación del buscador`)
}
check(buscadorEnBarra('mini') && !buscadorEnBarra('icon_overlay'), 'el overlay no ocupa el hueco de la barra')

const zonas = leerConstructor({
  header_builder: { zones: { header_left: [{ type: 'logo' }], header_right: [{ type: 'cart' }, { type: 'button', button_id: 'b1' }] } },
})
check(zonas?.zonas?.header_left?.[0].type === 'logo' && zonas.zonas.header_right?.length === 2, 'las zonas leen logo, carrito y botón')

const botones = leerConstructor({
  header_builder: { buttons: [{ id: 'b1', text: 'WhatsApp', action: 'whatsapp', style: 'solid', shape: 'pill' }, { text: '', style: 'solid' }] },
})
check(botones?.botones?.length === 1 && botones.botones[0].action === 'whatsapp', 'un botón sin texto no entra; WhatsApp sí')

const mega = leerConstructor({
  header_builder: {
    mega: [{ href: '/categorias', columns: 4, columns_data: [{ title: 'Perros', links: [{ label: 'Alimento', href: '/alimento' }] }] }],
  },
})
check(mega?.mega?.[0].columns === 4 && mega.mega[0].columnas[0].links[0].label === 'Alimento', 'el mega menú guarda columnas y enlaces')
const megaCat = leerConstructor({ header_builder: { mega: [{ href: '/c', columns_data: [{ title: 'Padre', category_id: 12, text: 'Nota', products: true }] }] } })
check(megaCat?.mega?.[0].columnas[0].categoryId === 12 && megaCat.mega[0].columnas[0].products === true && megaCat.mega[0].columnas[0].text === 'Nota', 'la columna puede salir de una categoría padre')
const hover = leerConstructor({ header_builder: { buttons: [{ text: 'Ir', hover: '#aabbcc', action: 'modal' }] } })
check(hover?.botones?.[0].hover === '#aabbcc' && hover.botones[0].action === 'modal', 'el botón guarda hover y modal')
check(leerConstructor({ header_builder: { mega: [{ href: '/x', columns: 9 }] } })?.mega?.[0].columns === 6, 'más de 6 columnas se recorta')

const icono = leerConstructor({ header_builder: { icons: { cart: { container: 'circle', color: '#112233', weight: 'relleno' } } } })
check(icono?.iconos?.cart?.container === 'circle' && icono.iconos.cart.color === '#112233', 'el ícono acepta contenedor y un hex')
check(leerConstructor({ header_builder: { icons: { cart: { color: 'rojo' } } } }) === null, 'un color inválido no crea constructor')
check(leerConstructor({ header_icons_circle: true }) === null, 'el círculo de acento sigue siendo el camino de hoy')
check(leerConstructor({ header_builder: { icon_container: { radius: 12 } } }) === null, 'sin forma no hay contenedor')

const caja = leerConstructor({
  header_builder: {
    icon_container: {
      shape: 'rounded', radius: 10, background: 'accent', scope: 'each', opacity: 80,
      targets: { cart: { shape: 'square', badge_shape: 'pill', badge_position: 'top-left', badge_color: '#112233' } },
    },
  },
})
check(caja?.contenedor?.shape === 'rounded' && caja.contenedor.background === 'accent', 'el contenedor común guarda forma y token')
check(caja?.contenedor?.targets?.cart?.shape === 'square' && caja.contenedor.targets.cart.badgeShape === 'pill', 'el carrito puede tener caja y contador propios')
const delCarrito = contenedorDe(caja.contenedor, 'cart')
check(delCarrito.shape === 'square' && delCarrito.radius === 10 && delCarrito.badgePosition === 'top-left', 'lo que el ícono no pisa se hereda')
check(contenedorDe(caja.contenedor, 'account').shape === 'rounded', 'el resto de íconos usa la caja común')
check(leerConstructor({ header_builder: { icon_container: { shape: 'rounded', radius: 3 } } })?.contenedor?.radius === undefined, 'un radio menor a 4 se descarta')
check(leerConstructor({ header_builder: { icon_container: { shape: 'rounded', radius: 16 } } })?.contenedor?.radius === 16, 'el radio 16 entra')
check(radioForma('square') === '0px' && radioForma('squircle') === '30%' && radioForma('semi') === '14px' && radioForma('rounded') === '8px' && radioForma('circle') === '9999px', 'cada forma tiene su radio')
check(leerConstructor({ header_builder: { icon_container: { shape: 'circle', background: 'rojo' } } })?.contenedor?.background === undefined, 'un fondo que no es token ni hex se descarta')

const menus = leerConstructor({
  header_builder: {
    menus: [
      { name: 'Categorías', zone: 'menu_center', type: 'mega', mobile_order: 0, items: [{ label: 'Perros', href: '/perros', kind: 'mega' }] },
      { name: 'Sin zona' },
      { id: 'enlaces', name: 'Enlaces', zone: 'topbar_right', type: 'links', mobile: true, mobile_order: 1, uppercase: true, indicator: 'underline', font: 'serif', items: [{ label: 'Ofertas', href: '/ofertas', badge: '-20%' }] },
    ],
  },
})
check(menus?.menus?.length === 2 && menus.menus[0].type === 'mega' && menus.menus[0].items[0].kind === 'mega', 'un menú sin zona no entra; el mega sí')
check(menus?.menus?.[1]?.uppercase === true && menus.menus[1].font === 'serif' && menus.menus[1].items[0].badge === '-20%', 'el menú de enlaces guarda estilo y etiqueta')
check(menus?.zonas == null, 'los menús no inventan zonas dentro del lector')
const armado = menus ? zonasConMenus(menus) : null
check(armado?.header_left?.[0].type === 'logo' && armado.header_right?.some((el) => el.type === 'cart'), 'sin zonas, el header conserva logo y carrito')
check(armado?.menu_center?.some((el) => el.menuId === menus.menus[0].id) && armado.topbar_right?.some((el) => el.menuId === 'enlaces'), 'cada menú cae en su zona')
check(armado?.mobile_header?.some((el) => el.menuId === '__movil__'), 'el celular tiene un solo botón de menú')
check(zonasConMenus({ zonas: null, menus: null }) === null, 'sin menús no se reescribe el header')
check(alineacionBuscador(null) === null && alineacionBuscador({ header_builder: { search: { align: 'arriba' } } }) === null, 'sin lado elegido la barra queda donde está')
check(alineacionBuscador({ header_builder: { search: { align: 'left' } } }) === 'left', 'la barra puede ir a la izquierda')
check(alineacionBuscador({ header_builder: { search: { align: 'center' } } }) === 'center' && alineacionBuscador({ header_builder: { search: { align: 'right' } } }) === 'right', 'centro y derecha también')
check(leerConstructor({ header_builder: { search: { align: 'left' } } }) === null, 'elegir el lado no cambia el cromo de la barra de hoy')
for (const archivo of ['HeaderClassic.tsx', 'HeaderCentered.tsx', 'HeaderSplit.tsx', 'HeaderMinimal.tsx', 'HeaderMega.tsx']) {
  const src = readFileSync(new URL(`../components/site/header/${archivo}`, import.meta.url), 'utf8')
  check(src.includes('alineacionBuscador') && src.includes('data-busqueda'), `${archivo} mueve la barra cuando hay un lado`)
}

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
