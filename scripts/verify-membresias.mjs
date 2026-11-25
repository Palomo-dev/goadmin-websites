/**
 * verify-membresias.mjs — «Tienda — Membresías» (Figma «16 Sitio web», sección 3279-100508).
 *
 *   node scripts/verify-membresias.mjs
 *
 * Decisiones del dueño (2026-11-25) que comprueba, sin base de datos ni dependencias nuevas:
 *  1. Sin planes activos: /membresias responde 404 con la marca de la tienda (cabecera, pie y color;
 *     nada de GO Admin) y sale del menú, del pie, del mega menú, del menú inferior y del sitemap.
 *  2. «Tiene membresías» = al menos un plan activo.
 *  3. /membresias es la página «Membresías» del editor o su plantilla (la misma ruta comodín de
 *     todas las páginas, con el layout de la tienda).
 *  4. «Popular» solo si la tienda lo marcó (y con dos o más planes a la vista).
 *  5. Plan que no se vende en línea: WhatsApp con el mensaje listo; sin WhatsApp, Contacto.
 *  6. Plan con el producto pausado: «No disponible por ahora», ocultable con el ojo.
 *  7. Orden y visibilidad en el contenido de la sección.
 *  8. Sin planes, en el lienzo del editor: muestra marcada «Ejemplo»; nunca en la tienda.
 *  + Ningún plan ni pregunta de gimnasio escritos en el código.
 *
 * Pinta el componente REAL con react-dom/server (cargador: verify-membresias.cargador.mjs).
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
register(pathToFileURL(join(ROOT, 'scripts/verify-membresias.cargador.mjs')).href, import.meta.url, { data: { root: ROOT } })

const fallos = []
let casos = 0
function ok(cond, mensaje) {
  casos++
  if (!cond) fallos.push(mensaje)
}
const leer = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const C = await import('../lib/website/v2/contrato/paginaMembresias.ts')
const E = await import('../lib/memberships/enlacesMembresias.ts')
const { MembershipPlansPricing, hayPlanesMembresia } = await import('../components/sections/gym/MembershipPlansPricing.tsx')

// ─── 2 · regla «tiene membresías» y estado de venta ──────────────────────────────────────────
ok(C.tieneMembresias([]) === false && C.tieneMembresias(null) === false, 'sin planes activos no hay membresías')
ok(C.tieneMembresias([{ id: 1 }]) === true, 'un plan activo basta para tener membresías')
ok(C.estadoVentaPlan('active', true) === 'en_linea', 'producto activo con precio vigente: en línea')
ok(C.estadoVentaPlan('active', false) === 'consulta', 'producto activo sin precio: a consultar')
ok(C.estadoVentaPlan(null, false) === 'consulta' && C.estadoVentaPlan('deleted', true) === 'consulta', 'sin producto o borrado: a consultar')
ok(C.estadoVentaPlan('inactive', true) === 'pausado' && C.estadoVentaPlan('inactive', false) === 'pausado', 'producto inactivo: pausado')

// ─── 7 · orden y visibilidad ─────────────────────────────────────────────────────────────────
const tres = [{ id: 10 }, { id: 20 }, { id: 30 }]
const aj = (c) => C.leerAjustesPlanes(c)
ok(C.planesVisibles(tres, aj({})).map((p) => p.id).join() === '10,20,30', 'sin orden guardado: el de siempre')
ok(C.planesVisibles(tres, aj({ plan_order: [30, 10] })).map((p) => p.id).join() === '30,10,20', 'orden guardado y los nuevos al final')
ok(C.planesVisibles(tres, aj({ hidden_plan_ids: [20] })).map((p) => p.id).join() === '10,30', 'el ojo oculta el plan')
ok(C.planesVisibles(tres, aj({ plan_order: ['x', 30, 30, -1] })).map((p) => p.id).join() === '30,10,20', 'orden con basura: se limpia')
const editado = C.alternarPlanOculto(C.alternarPlanOculto({}, 20), 20)
ok(Array.isArray(editado.hidden_plan_ids) && editado.hidden_plan_ids.length === 0, 'el ojo dos veces vuelve a mostrar')
ok(C.alternarPlanPopular(C.alternarPlanPopular({}, 20), 20).popular_plan_id === null, 'la estrella dos veces desmarca')
ok(C.alternarPlanPopular({ popular_plan_id: 10 }, 20).popular_plan_id === 20, 'una sola estrella a la vez')

// ─── 4 · «Popular» ───────────────────────────────────────────────────────────────────────────
ok(C.popularVisible(tres, aj({})) === null, 'sin marca no hay Popular (se quitó la regla del plan del medio)')
ok(C.popularVisible(tres, aj({ popular_plan_id: 30 })) === 30, 'Popular el que marca la tienda')
ok(C.popularVisible([{ id: 30 }], aj({ popular_plan_id: 30 })) === null, 'con un solo plan no hay insignia')
ok(C.popularVisible(C.planesVisibles(tres, aj({ hidden_plan_ids: [30], popular_plan_id: 30 })), aj({ popular_plan_id: 30 })) === null, 'Popular oculto: sin insignia')

// ─── 5 · WhatsApp ────────────────────────────────────────────────────────────────────────────
ok(C.mensajeWhatsappPlan(C.TEXTOS_PLANES.mensajeWhatsapp, 'Club Plus') === 'Hola, quiero información del plan «Club Plus» que vi en la tienda.', 'mensaje con el plan elegido')
ok(C.mensajeWhatsappPlan('', 'A') .includes('«A»'), 'mensaje vacío: el de siempre')
ok(aj({ offline_action: 'contact' }).sinVenta === 'contacto' && aj({}).sinVenta === 'whatsapp', 'por defecto WhatsApp; la tienda puede elegir Contacto')

// ─── Plantilla neutra ────────────────────────────────────────────────────────────────────────
const plantilla = JSON.stringify(C.seccionesMembresiasPorDefecto())
ok(!/gimnasio|gym|entrenador|clases grupales|sauna|spa\b/i.test(plantilla), 'la plantilla no trae textos de gimnasio')
ok(C.seccionesMembresiasPorDefecto().map((s) => `${s.section_type}:${s.section_variant}`).join() === 'hero:page_header,membership_plans:pricing_table,faq:accordion', 'plantilla: encabezado, planes y preguntas')
ok(C.PLANES_EJEMPLO.every((p) => p.id < 0), 'los planes de muestra tienen ids negativos (nunca chocan con uno real)')

// ─── 1 · enlaces a /membresias ───────────────────────────────────────────────────────────────
for (const d of ['/membresias', 'membresias', '/membresias?x=1', '/membresias#planes', '/sede-norte/membresias', '/Membresias/']) {
  ok(E.apuntaAMembresias(d), `«${d}» apunta a membresías`)
}
for (const d of ['/', '/membresias-vip', 'https://otro.com/membresias', '/a/b/membresias', null, 7, '/mi-cuenta/membresia']) {
  ok(!E.apuntaAMembresias(d), `«${String(d)}» no apunta a membresías`)
}
const arbol = [{ slug: 'home', children: [] }, { slug: 'membresias', children: [] }, { slug: 'nosotros', children: [{ slug: 'membresias', children: [] }, { slug: 'equipo', children: [] }] }]
ok(JSON.stringify(E.sinNodosMembresias(arbol, (n) => n.slug)) === JSON.stringify([{ slug: 'home', children: [] }, { slug: 'nosotros', children: [{ slug: 'equipo', children: [] }] }]), 'menú de páginas sin /membresias (también en hijos)')
const menus = [{ id: 'm', items: [{ item_type: 'page', page: { slug: 'membresias' }, children: [] }, { item_type: 'custom_link', custom_url: '/membresias', children: [] }, { item_type: 'custom_link', custom_url: '/contacto', children: [] }, { item_type: 'category', category: { slug: 'membresias' }, children: [] }] }]
ok(E.menusSinMembresias(menus)[0].items.length === 2, 'menús nombrados (pie) sin la página ni el enlace a /membresias; una categoría no se toca')
const ajustesMenu = { mobile_header: { bottom_nav: { v: 2, items: [{ id: 'a', action: 'home' }, { id: 'b', action: 'trial' }, { id: 'c', action: 'page', target: '/membresias' }] } } }
ok(E.ajustesSinMembresias(ajustesMenu).mobile_header.bottom_nav.items.map((i) => i.id).join() === 'a', 'menú inferior sin «Prueba gratis» ni la página /membresias')
const sinNada = { mobile_header: { bottom_nav: { v: 2, items: [{ id: 'a', action: 'home' }] } } }
ok(E.ajustesSinMembresias(sinNada) === sinNada, 'sin botones a /membresias: el mismo objeto (los demás sitios no cambian)')
ok(!E.mencionaMembresias([{ slug: 'home' }], null, { items: [{ action: 'home' }] }), 'sin enlaces a /membresias no se consultan los planes')
ok(E.mencionaMembresias([{ slug: 'membresias' }]) && E.mencionaMembresias({ items: [{ action: 'trial' }] }), 'con enlaces sí')

// ─── Componente real ─────────────────────────────────────────────────────────────────────────
function pintar(props, vistaPrevia = false) {
  globalThis.__VISTA_PREVIA__ = vistaPrevia
  try {
    return renderToStaticMarkup(createElement(MembershipPlansPricing, { primaryColor: '#E8892B', ...props }))
  } catch (e) {
    fallos.push(`MembershipPlansPricing revienta al pintar — ${e instanceof Error ? e.message : String(e)}`)
    return ''
  }
}
const plan = (id, extra = {}) => ({ id, name: `Plan ${id}`, description: `DESC-${id}`, duration_days: 30, duration_unit: 'month', duration_value: 1, frequency: 'monthly', access_rules: { features: [`BEN-${id}`] }, product_id: 900 + id, price: 10000 * id, compare_price: null, estado: 'en_linea', ...extra })
const orgCon = { subdomain: 'demo', website_settings: { whatsapp_number: '300 123 4567' } }
const orgSin = { subdomain: 'demo', website_settings: {} }

// 8 · sin planes
ok(pintar({ content: {}, data: { membershipPlans: [] } }) === '', 'tienda sin planes: la sección no pinta nada (ni ejemplos)')
ok(!hayPlanesMembresia({ membershipPlans: [] }) && hayPlanesMembresia({ membershipPlans: [plan(1)] }), 'hayPlanesMembresia')
const muestra = pintar({ content: {}, data: { membershipPlans: [] } }, true)
ok(muestra.includes('Ejemplo · no visible para tus clientes') && muestra.includes('data-muestra'), 'lienzo sin planes: muestra marcada «Ejemplo»')
ok(pintar({ content: { show_sample_plans: false }, data: { membershipPlans: [] } }, true) === '', 'interruptor «Ver planes de ejemplo» apagado: nada en el lienzo')

// 4 · Popular
const tresPlanes = { membershipPlans: [plan(1), plan(2), plan(3)] }
ok(!pintar({ content: {}, data: tresPlanes, organization: orgCon }).includes('Popular'), 'tres planes sin marca: sin «Popular»')
const conEstrella = pintar({ content: { popular_plan_id: 3 }, data: tresPlanes, organization: orgCon })
ok((conEstrella.match(/>Popular</g) || []).length === 1 && /data-plan="3"[^>]*data-popular=""/.test(conEstrella), '«Popular» en el plan marcado y solo en él')
ok(!pintar({ content: { popular_plan_id: 1 }, data: { membershipPlans: [plan(1)] }, organization: orgCon }).includes('>Popular<'), 'un solo plan: sin insignia')

// 7 · orden y ojo
const ordenado = pintar({ content: { plan_order: [3, 1], hidden_plan_ids: [2] }, data: tresPlanes, organization: orgCon })
const ids = [...ordenado.matchAll(/data-plan="(\d+)"/g)].map((m) => m[1]).join()
ok(ids === '3,1', `orden y ocultos de la sección (salió ${ids})`)

// En línea: botón de compra (sin cambiar la lógica del carrito)
ok(conEstrella.includes('Comprar plan') && !conEstrella.includes('wa.me'), 'plan en línea: «Comprar plan»')
ok(pintar({ content: { cta_text: 'Unirme' }, data: tresPlanes, organization: orgCon }).includes('Unirme'), 'el texto del botón se edita')
ok(conEstrella.includes('Mi cuenta › Membresía'), 'nota de pago en línea')
ok(!pintar({ content: { show_payment_note: false }, data: tresPlanes, organization: orgCon }).includes('Mi cuenta › Membresía'), 'la nota se puede apagar')

// 5 · no se vende en línea
const consulta = { membershipPlans: [plan(1), plan(4, { name: 'Club Corporativo', product_id: null, price: null, estado: 'consulta' })] }
const conWa = pintar({ content: {}, data: consulta, organization: orgCon })
const mensaje = encodeURIComponent('Hola, quiero información del plan «Club Corporativo» que vi en la tienda.')
ok(conWa.includes('Precio a consultar') && conWa.includes('Consultar por WhatsApp'), 'sin venta en línea: «Precio a consultar» y WhatsApp')
ok(conWa.includes(`https://wa.me/573001234567?text=${mensaje}`), 'WhatsApp con el mensaje listo (plan elegido)')
const sinWa = pintar({ content: {}, data: consulta, organization: orgSin })
ok(!sinWa.includes('wa.me') && /href="\/contacto"[^>]*>Consultar</.test(sinWa), 'sin WhatsApp: «Consultar» lleva a Contacto')
const aContacto = pintar({ content: { offline_action: 'contact' }, data: consulta, organization: orgCon })
ok(!aContacto.includes('wa.me') && aContacto.includes('href="/contacto"'), 'la tienda eligió Contacto')
ok(pintar({ content: { whatsapp_message: 'Quiero {plan} ya' }, data: consulta, organization: orgCon }).includes(encodeURIComponent('Quiero Club Corporativo ya')), 'mensaje propio con {plan}')

// 6 · pausado
const pausa = { membershipPlans: [plan(1), plan(5, { name: 'Club Anual', product_id: null, price: 159900, estado: 'pausado' })] }
const pausado = pintar({ content: {}, data: pausa, organization: orgCon })
ok(pausado.includes('No disponible por ahora') && /<button[^>]*disabled=""[^>]*>No disponible</.test(pausado), 'pausado: «No disponible por ahora» y botón apagado')
ok(pausado.includes('Preguntar cuándo vuelve por WhatsApp'), 'pausado: preguntar por WhatsApp')
ok(!pintar({ content: { hidden_plan_ids: [5] }, data: pausa, organization: orgCon }).includes('No disponible por ahora'), 'pausado ocultable con el ojo')

// Caché anterior al campo `estado`: se deduce como antes
const viejo = pintar({ content: {}, data: { membershipPlans: [{ ...plan(1), estado: undefined }, { ...plan(2), estado: undefined, product_id: null, price: null }] }, organization: orgCon })
ok(viejo.includes('Comprar plan') && viejo.includes('Precio a consultar'), 'planes sin `estado` (caché vieja): se deduce')

// ─── Fuentes: ruta, 404 con marca, menús, sitemap, sin gimnasio en el código ─────────────────
const paginaRuta = leer('app/membresias/page.tsx')
ok(/import CatchAllPage[^\n]*from '@\/app\/\[\[\.\.\.slug\]\]\/page'/.test(paginaRuta) && /return CatchAllPage\(/.test(paginaRuta), '/membresias usa la página comodín (layout de la tienda, página del editor o plantilla)')
const comodin = leer('app/[[...slug]]/page.tsx')
ok(/currentSlug === SLUG_PAGINA_MEMBRESIAS\) \{\n[^\n]*enEditor[^\n]*\n\s*if \(!enEditor && !tieneMembresias\(await getPlanesDeSeccion\(organization\.id\)\)\) notFound\(\)/.test(comodin), 'sin planes: notFound() salvo en el lienzo del editor')
ok(/case SLUG_PAGINA_MEMBRESIAS: \{[\s\S]*?seccionesMembresiasPorDefecto\(\)[\s\S]*?<Layout>/.test(comodin), 'sin página del editor: la plantilla con el layout de la tienda')
ok(existsSync(join(ROOT, 'app/membresias/not-found.tsx')), 'existe el 404 propio de /membresias')
const noDisponible = leer('app/membresias/not-found.tsx')
ok(noDisponible.includes('<OrganizationLayout') && noDisponible.includes('Esta página no está disponible'), '404 con cabecera, pie y estilo de la tienda')
ok(!/GO Admin|>GO</.test(noDisponible.replace(/\/\*[\s\S]*?\*\//g, '')), 'el 404 no muestra la marca de GO Admin')
ok(/getPlanesDeSeccion[\s\S]*?robots: \{ index: false/.test(paginaRuta), 'sin planes: noindex en los metadatos')
const contexto = leer('lib/get-org-context.ts')
ok(/mencionaMembresias\([\s\S]*?!tieneMembresias\(await getPlanesDeSeccion\(organization\.id\)\)/.test(contexto) && /headerNav: navHeader/.test(contexto) && /websiteMenus: menusPie/.test(contexto) && /effectiveSettings: ajustesPublicos/.test(contexto), 'getOrgContext quita /membresias del menú, pie, mega menú y menú inferior')
ok(/menusSinMembresias\(pie\.menus\)/.test(leer('components/site/OrganizationLayout.tsx')), 'el pie que lee el layout también sale sin /membresias')
ok(/prueba: op\.barraMovil\.includes\('prueba'\) && tieneMembresias\(/.test(leer('lib/website/extrasEncabezadoPie.server.ts')), 'barra móvil: «Prueba gratis» solo con planes')
const sitemap = leer('app/sitemap.ts')
ok(/if \(tieneMembresias\(await getPlanesDeSeccion\(ctx\.organization\.id\)\)\) rutas\.add\(RUTA_MEMBRESIAS\)\n\s*else rutas\.delete\(/.test(sitemap), 'sitemap: /membresias solo con planes activos')
ok(!existsSync(join(ROOT, 'components/site/sections/gym/MembershipPlans.tsx')), 'se fue el componente con los planes de gimnasio de ejemplo')
const gimnasio = /Plan Básico|Plan Premium|Plan VIP|Acceso ilimitado al gimnasio|¿Cómo accedo al gimnasio\?|Consulta el precio en recepción|próximamente/
for (const rel of ['app/membresias/page.tsx', 'app/membresias/not-found.tsx', 'components/sections/gym/MembershipPlansPricing.tsx', 'lib/website/v2/contrato/paginaMembresias.ts']) {
  ok(!gimnasio.test(leer(rel)), `${rel}: sin planes ni preguntas de gimnasio fijos`)
}
const consultas = leer('lib/supabase/queries.ts')
ok(/estadoVentaPlan\(product\?\.status \?\? null, vigente !== null\)/.test(consultas) && /product_id: estado === 'en_linea' \? row\.product_id : null/.test(consultas), 'getMembershipPlans: estado compartido y solo se compra lo que está en línea')

// Copia idéntica del contrato del ERP (si está al lado).
const erp = join(ROOT, '..', 'CascadeProjects', 'go-admin-erp', 'src/lib/website/contrato/paginaMembresias.ts')
const erpVecino = join(ROOT, '..', 'go-admin-erp', 'src/lib/website/contrato/paginaMembresias.ts')
const original = process.env.ERP_REPO ? join(process.env.ERP_REPO, 'src/lib/website/contrato/paginaMembresias.ts') : existsSync(erpVecino) ? erpVecino : erp
if (existsSync(original)) {
  ok(readFileSync(original, 'utf8') === readFileSync(join(ROOT, 'lib/website/v2/contrato/paginaMembresias.ts'), 'utf8'), 'paginaMembresias.ts idéntico al del ERP')
} else {
  console.warn('verify-membresias: sin el ERP al lado, no se compara la copia del contrato')
}

if (fallos.length > 0) {
  console.error(`verify-membresias: ${fallos.length} de ${casos} casos fallan`)
  for (const f of fallos) console.error(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`verify-membresias: ${casos} casos OK`)
