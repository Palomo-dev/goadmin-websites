/**
 * verify-menu-movil.mjs — sin claves nuevas sigue la variante de hoy.
 *
 *   npm run verify:menu-movil
 */
import { leerPresentacionMovil, leerBarra } from '../lib/website/menuMovil.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}

check(leerPresentacionMovil(null) === null, 'sin ajustes no hay presentación nueva')
check(leerPresentacionMovil({}) === null, 'un objeto vacío sigue el drawer de hoy')
for (const estilo of ['drawer', 'fullscreen', 'bottom_sheet', 'tabs']) {
  check(leerPresentacionMovil({ mobile_menu_style: estilo }) === null, `${estilo} sigue en su componente`)
}
check(leerPresentacionMovil({ mobile_header: null }) === null, 'mobile_header nulo no cambia el header')
check(leerPresentacionMovil({ mobile_header: {} }) === null, 'un objeto vacío no cambia el header')
check(leerPresentacionMovil({ mobile_header: { layout: { logo: 'inherit' } } }) === null, 'logo heredado es el de hoy')

const izquierda = leerPresentacionMovil({ mobile_menu_style: 'drawer_left' })
check(izquierda?.usarHeaderNuevo === true && izquierda.estilo === 'drawer_left', 'el cajón izquierdo usa el cascarón')
check(leerPresentacionMovil({ mobile_menu_style: 'drawer_right' })?.estilo === 'drawer_right', 'el cajón derecho')
check(leerPresentacionMovil({ mobile_menu_style: 'top_dropdown' })?.estilo === 'top_dropdown', 'la cortina superior')
check(leerPresentacionMovil({ mobile_menu_style: 'none' })?.estilo === 'none', 'sin menú, solo la barra si se pide')

const soloBarra = leerPresentacionMovil({ mobile_header: { bottom_nav: { enabled: true } } })
check(soloBarra?.usarHeaderNuevo === false && soloBarra?.barra?.items.length === 4, 'la barra, sola, no reemplaza el header de hoy')
check(leerPresentacionMovil({ mobile_menu_style: 'tabs', mobile_header: { bottom_nav: { enabled: true } } })?.usarHeaderNuevo === true, 'con pestañas, la barra nueva reemplaza la de hoy para no duplicarla')
check(leerBarra({ enabled: false }) === null, 'la barra apagada no se pinta')
check(leerBarra({ enabled: true, items: [{ id: 'a', kind: 'home' }, { id: 'b', kind: 'search' }] })?.items.length === 4, 'menos de 3 ítems vuelve a los de inicio')

const panel = leerPresentacionMovil({ mobile_header: { panel: { width: 70, animation: 'fade', categories: 'list' } } })
check(panel?.usarHeaderNuevo === true && panel.panel?.width === 70 && panel.panel.animation === 'fade' && panel.panel.categories === 'list', 'el panel nuevo se lee')
check(leerPresentacionMovil({ mobile_header: { panel: { width: 10 } } })?.panel?.width === 85, 'un ancho fuera de 70–100 no se acepta')

const layout = leerPresentacionMovil({ mobile_header: { layout: { logo: 'center', hide_on_scroll: true, transparent_hero: true } } })
check(layout?.layout?.logo === 'center' && layout.layout.hideOnScroll && layout.layout.transparentHero, 'el logo centrado y el hero transparente')

if (problemas.length) {
  console.error(problemas.join('\n'))
  process.exit(1)
}
console.log(`ok ${casos} casos`)
