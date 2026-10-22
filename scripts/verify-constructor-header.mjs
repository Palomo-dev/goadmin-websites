/**
 * verify-constructor-header.mjs — sin constructor, el header y el buscador de hoy.
 *
 *   npm run verify:constructor-header
 */
import { buscadorEnBarra, leerConstructor } from '../lib/website/constructorEncabezado.ts'

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

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
