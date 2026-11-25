/**
 * verify-acceso-cuenta.mjs — iniciar sesión desde el ícono de cuenta: página, panel, ventana o
 * diálogo (Figma «16 Sitio web» 2834:68670, aprobado 2026-11-22).
 *
 *   npm run verify:acceso-cuenta
 *
 * Qué comprueba:
 * 1. Contrato: sin `header_cuenta` el modo es «Página» (lo de hoy); desde la ventana, crear
 *    cuenta y recuperar van al panel o a la página; error de ingreso sin pistas.
 * 2. Modo: con «Página» el ícono sigue siendo el enlace a /auth y el acceso no se monta; con los
 *    demás, el ícono es un botón que abre el acceso; en el celular es la hoja inferior.
 * 3. Portal y accesibilidad: Radix Dialog en un portal al body, foco al primer campo y de vuelta
 *    al ícono, chat escondido mientras está abierto (`data-cuenta-abierta`).
 * 4. Una sola lógica de sesión (useAcceso) para la página y los demás modos; favoritos que se
 *    juntan al ingresar; las filas del menú del celular abren la misma hoja.
 * 8. Regla única modo × pantalla (2026-11-25, reglaAcceso.ts): en el celular se respeta el modo
 *    (diálogo → diálogo, panel → cajón, página → página) y SOLO la ventana pasa a hoja inferior;
 *    encaje con el teclado; todos los «Iniciar sesión» de la tienda (cabecera, menú inferior,
 *    checkout, favoritos, consultar pedido, reseñas, precios por volumen, Mi cuenta) usan la regla
 *    y vuelven a donde estaban.
 */
import { readFileSync } from 'node:fs'
import {
  ERROR_INGRESO_GENERICO,
  MENU_CUENTA,
  destinoVistaAcceso,
  opcionesCuenta,
  rutaAcceso,
} from '../lib/website/v2/cabeceraTienda.ts'
import { OPCIONES_SHELL } from '../lib/website/v2/mapeoAjustes.ts'
import {
  BENEFICIOS_CUENTA_POR_DEFECTO,
  TEXTO_SESION_CUENTA_POR_DEFECTO,
  primerNombreIcono,
  textoCuentaConSesion,
} from '../lib/website/v2/cabeceraTienda.ts'
import { MARCA_SESION_CORTA, hayMarcaSesionCorta, opcionesCookieSesion, opcionesMarcaSesionCorta } from '../lib/auth/sesionCorta.ts'
import { CONSULTA_CELULAR, MARGEN_DIALOGO_ACCESO, encuadreVisible, formatoAcceso, rutaIniciarSesion } from '../components/site/cuenta/reglaAcceso.ts'

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// 1. Contrato.
for (const a of [null, {}, { header_cuenta: null }, { header_cuenta: { modo: 'raro' } }]) {
  const op = opcionesCuenta(a)
  check(op.modo === 'pagina', `sin modo válido → «Página» (${JSON.stringify(a)})`)
}
check(opcionesCuenta({}).configurado === false, 'sin header_cuenta no hay configuración nueva')
check(OPCIONES_SHELL.header_cuenta?.porDefecto === null && OPCIONES_SHELL.header_cuenta?.nueva === true, 'header_cuenta en el contrato, sin columna')
check(destinoVistaAcceso({ modo: 'ventana', ventanaDestino: 'pagina' }, 'registro') === 'pagina', 'ventana → crear cuenta en la página')
check(destinoVistaAcceso({ modo: 'ventana', ventanaDestino: 'panel' }, 'recuperar') === 'panel', 'ventana → recuperar en el panel')
check(rutaAcceso('registro') === '/auth?tab=register' && rutaAcceso('ingresar') === '/auth', 'rutas de hoy')
check(!/correo no|contraseña no|no existe/i.test(ERROR_INGRESO_GENERICO), 'el error de ingreso no dice qué falló')
check(MENU_CUENTA.every((m) => m.href.startsWith('/mi-cuenta/')), 'el menú de cuenta usa las rutas de /mi-cuenta')
for (const m of MENU_CUENTA) {
  let existe = true
  try {
    readFileSync(new URL(`../app${m.href}/page.tsx`, import.meta.url))
  } catch {
    existe = false
  }
  check(existe, `${m.href} existe`)
}

// 2. Modo.
const acceso = leer('components/site/cuenta/AccesoCuenta.tsx')
check(/if \(modo === 'pagina'\) \{\s*return \(\s*<Link href=\{href\}/.test(acceso), 'con «Página», EnlaceCuenta es el enlace de siempre')
check(acceso.includes("aria-haspopup=\"dialog\"") && acceso.includes('aria-expanded={abierto}'), 'el ícono dice si el acceso está abierto')
check(CONSULTA_CELULAR === '(max-width: 767px)' && acceso.includes('const celular = window.matchMedia(CONSULTA_CELULAR).matches') && acceso.includes('const fmt = formatoAcceso(modo, celular)'), 'el formato sale de la regla única (reglaAcceso.ts)')
const layout = leer('components/site/OrganizationLayoutCliente.tsx')
check(layout.includes("opCuenta.modo !== 'pagina' && (") && layout.includes('<AccesoCuenta opciones={opCuenta}'), 'el layout monta el acceso solo con un modo distinto de «Página»')
const cabecera = leer('components/site/header/HeaderShared.tsx')
check((cabecera.match(/<EnlaceCuenta key="auth" modo=\{modoCuenta\}/g) ?? []).length === 3, 'los tres íconos de cuenta de la cabecera usan EnlaceCuenta')
check(!cabecera.includes('<Link key="auth"'), 'no queda un enlace de cuenta fijo en la cabecera')

// 3. Portal y accesibilidad.
check(acceso.includes('<Dialogo.Portal>'), 'el acceso va en un portal (fuera de la cabecera)')
check(acceso.includes('onCloseAutoFocus') && acceso.includes('origen.current.focus('), 'al cerrar, el foco vuelve al ícono')
check(acceso.includes('[data-primer-campo]'), 'al abrir, el foco va al primer campo')
check(acceso.includes("raiz.setAttribute('data-cuenta-abierta', '')"), 'marca la raíz mientras está abierto')
check(/html\[data-cuenta-abierta\] \[data-gochat-widget\]/.test(leer('app/globals.css')), 'el chat flotante se esconde mientras está abierto')
check(acceso.includes("addEventListener('popstate'"), 'celular: el botón atrás cierra la hoja')

// 4. Una sola lógica.
const hook = leer('components/site/cuenta/useAcceso.ts')
for (const api of ['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password']) {
  check(hook.includes(`'${api}'`), `useAcceso usa ${api}`)
}
const pagina = leer('app/auth/AuthForm.tsx')
check(pagina.includes('useAcceso({') && !pagina.includes("fetch('/api/auth"), 'la página /auth usa la misma lógica (sin fetch propio)')
const formulario = leer('components/site/cuenta/FormularioAcceso.tsx')
check(formulario.includes('useAcceso({') && !formulario.includes("fetch('/api/auth"), 'el formulario de los modos usa la misma lógica')
check(acceso.includes('void iniciarFavoritos(true)'), 'al ingresar, los favoritos del dispositivo se juntan con los de la cuenta')
check(acceso.includes('router.refresh()') && !/location\.reload\(\)/.test(acceso), '«Quedarse» no recarga: el carrito y el pago se conservan')
for (const menu of ['components/site/header/mobile/MobileDrawer.tsx', 'components/site/header/HeaderShared.tsx', 'components/site/header/HeaderMinimal.tsx']) {
  check(/<EnlaceAccesoMenu[\s\S]*?href="\/auth"/.test(leer(menu)), `${menu}: «Iniciar sesión» abre la misma hoja`)
}

// 5. Beneficios editables (Figma E-A1 2839:69662, M2 2835:69308): vacío = el texto de siempre.
const sinTextos = opcionesCuenta({})
check(
  sinTextos.textosBeneficios.titulo === 'Con tu cuenta puedes' &&
    sinTextos.textosBeneficios.lineas.join('|') === BENEFICIOS_CUENTA_POR_DEFECTO.lineas.join('|'),
  'sin textos propios, los beneficios de siempre',
)
const conTextos = opcionesCuenta({ header_cuenta: { beneficiosTitulo: '  Ventajas  ', beneficio2: 'Lista de deseos', beneficio3: '   ', beneficio1: 'x'.repeat(200) } })
check(conTextos.configurado && conTextos.textosBeneficios.titulo === 'Ventajas', 'título propio recortado')
check(conTextos.textosBeneficios.lineas[1] === 'Lista de deseos' && conTextos.textosBeneficios.lineas[2] === BENEFICIOS_CUENTA_POR_DEFECTO.lineas[2], 'línea vacía = la de siempre')
check(conTextos.textosBeneficios.lineas[0].length === 80, 'cada línea, máximo 80 caracteres')
check(formulario.includes('<BeneficiosCuenta textos={textosBeneficios} />') && formulario.includes('{textos.titulo}'), 'el panel pinta los textos del editor')
check(acceso.includes('textosBeneficios={opciones.textosBeneficios}'), 'AccesoCuenta pasa los textos de los beneficios')

// 6. «Hola, {nombre}» con sesión (solo en los estilos con texto).
check(opcionesCuenta({}).textoSesion === TEXTO_SESION_CUENTA_POR_DEFECTO && TEXTO_SESION_CUENTA_POR_DEFECTO === 'Hola, {nombre}', 'sin opción, «Hola, {nombre}»')
check(textoCuentaConSesion('Hola, {nombre}', 'Ana María', 'Mi cuenta') === 'Hola, Ana', 'primer nombre')
check(textoCuentaConSesion('Hola, {nombre}', null, 'Mi cuenta') === 'Mi cuenta' && textoCuentaConSesion('Hola, {nombre}', '  ', 'Ingresar') === 'Ingresar', 'sin nombre, el texto sin sesión')
check(textoCuentaConSesion('Mi perfil', null, 'Mi cuenta') === 'Mi perfil', 'plantilla sin {nombre} tal cual')
check(primerNombreIcono('Maximilianoooooo') === 'Maximilianooo…', 'nombre largo cortado')
check(opcionesCuenta({ header_cuenta: { textoSesion: 'Bienvenida, {nombre}' } }).textoSesion === 'Bienvenida, {nombre}', 'texto con sesión propio')
check(/clave === 'cuenta' && isLoggedIn \? textoCuentaConSesion\(opCuenta\.textoSesion, nombreCliente, textoIcono\(opIconos, 'cuenta'\)\)/.test(cabecera), 'la cabecera usa el texto con sesión solo con sesión')
check(cabecera.includes('meta.first_name') && !/from\('customers'\)/.test(cabecera), 'el nombre sale de la sesión, sin consulta')

// 7. «Recordarme»: sin marcar = cookies de sesión; marcada = la sesión larga de siempre.
const larga = { path: '/', sameSite: 'lax', httpOnly: false, maxAge: 400 * 24 * 60 * 60 }
check(opcionesCookieSesion('token', larga, false) === larga, 'marcada: las opciones de siempre')
const corta = opcionesCookieSesion('token', larga, true)
check(!('maxAge' in corta) && !('expires' in corta) && corta.path === '/' && corta.sameSite === 'lax' && corta.httpOnly === false, 'sin marcar: sin vencimiento, mismos path, sameSite y httpOnly')
check(opcionesCookieSesion('', { ...larga, maxAge: 0 }, true).maxAge === 0, 'un borrado se deja como está')
check(hayMarcaSesionCorta(`a=1; ${MARCA_SESION_CORTA}=1; b=2`) && !hayMarcaSesionCorta('a=1') && !hayMarcaSesionCorta(`${MARCA_SESION_CORTA}=0`), 'lee la marca de la cabecera Cookie')
const marca = opcionesMarcaSesionCorta(true)
check(!('maxAge' in marca) && marca.secure === true && marca.sameSite === 'lax', 'la marca es cookie de sesión, secure en https')
const login = leer('app/api/auth/login/route.ts')
check(login.includes('body.recordarme !== false') && login.includes('createAuthClient({ sesionCorta: !recordarme })'), 'el login lee «Recordarme» (sin el campo, sesión larga)')
check(login.includes('cookieStore.delete(MARCA_SESION_CORTA)') && login.includes('cookieStore.set(MARCA_SESION_CORTA'), 'el login pone o quita la marca')
check(leer('app/api/auth/logout/route.ts').includes('.delete(MARCA_SESION_CORTA)'), 'cerrar sesión borra la marca')
check(leer('middleware.ts').includes('opcionesCookieSesion(value, options, sesionCorta)'), 'el refresco del middleware respeta la sesión corta')
check(leer('lib/supabase/client.ts').includes('opcionesCookieSesion(value, options, corta)'), 'el navegador respeta la sesión corta')
check((leer('lib/supabase/server.ts').match(/opcionesCookieSesion\(value, options, corta\)/g) ?? []).length === 2, 'los clientes de servidor respetan la sesión corta')
check(formulario.includes('checked={recordarme}') && pagina.includes('checked={recordarme}'), 'la casilla ya no es decorativa (panel y /auth)')
check(formulario.includes('recordarme: compacto ? true : recordarme'), 'la ventana, sin casilla, deja la sesión larga')
check(leer('components/site/cuenta/useAcceso.ts').includes('recordarme: datos.recordarme !== false'), 'useAcceso manda «Recordarme»')

// 8. Regla única modo × pantalla (pedido del dueño 2026-11-25).
const esperado = {
  pagina: { computador: null, celular: null },
  panel: { computador: 'panel', celular: 'panel' },
  dialogo: { computador: 'dialogo', celular: 'dialogo' },
  ventana: { computador: 'ventana', celular: 'hoja' },
}
for (const [modo, porPantalla] of Object.entries(esperado)) {
  for (const [pantalla, formato] of Object.entries(porPantalla)) {
    check(formatoAcceso(modo, pantalla === 'celular') === formato, `${modo} en ${pantalla} → ${formato ?? 'página'}`)
  }
}
check(formatoAcceso(opcionesCuenta({ header_cuenta: { modo: 'dialogo' } }).modo, true) === 'dialogo', 'tienda en «diálogo» (como la org 338): en el celular, diálogo y no hoja')
check(formatoAcceso(opcionesCuenta({}).modo, true) === null, 'sin opción: la página, también en el celular')
check(!/movil|celular/i.test(Object.keys(opcionesCuenta({ header_cuenta: { modo: 'panel' } })).join(' ')), 'no hay ajuste propio del celular: manda el del computador')
const regla = leer('components/site/cuenta/reglaAcceso.ts')
check(!/from 'react'|'use client'/.test(regla), 'la regla es pura (sin React)')
check(acceso.includes('export { formatoAcceso, type FormatoAcceso }') && !/function formatoAcceso\(/.test(acceso), 'AccesoCuenta no tiene su propia copia de la regla')
check(!/return celular \? 'hoja' : modo/.test(acceso + regla), 'ya no se fuerza la hoja en el celular')
// Presentación de cada formato en el celular.
check(/panel: 'fixed inset-y-0 right-0 flex w-\[calc\(100%-3rem\)\] max-w-\[420px\][^']*md:w-full'/.test(acceso), 'panel en el celular: cajón lateral que deja ver la página (en el computador, 420 px como siempre)')
check(/dialogo: 'fixed left-1\/2 top-1\/2 flex max-h-\[90dvh\] w-\[calc\(100%-2rem\)\] max-w-\[440px\]/.test(acceso), 'diálogo en el celular: centrado, ancho casi completo con márgenes, alto en dvh')
check(/hoja: 'fixed inset-x-0 bottom-0/.test(acceso), 'la hoja sigue existiendo (solo para la ventana)')
check((acceso.match(/motion-reduce:animate-none/g) ?? []).length === 4, 'reducir movimiento: sin animación en los cuatro formatos')
check(acceso.includes('min-h-0 flex-1 overflow-y-auto overscroll-contain'), 'scroll interno del contenido')
// Teclado del celular: lo visible manda.
check(JSON.stringify(encuadreVisible('dialogo', { alto: 800, arriba: 0 }, 800)) === '{}', 'sin teclado: mandan las clases (diálogo)')
check(JSON.stringify(encuadreVisible('panel', null, 800)) === '{}', 'sin visualViewport: mandan las clases')
const conTeclado = encuadreVisible('dialogo', { alto: 420, arriba: 0 }, 800)
check(conTeclado.top === 210 && conTeclado.maxHeight === 420 - MARGEN_DIALOGO_ACCESO * 2, 'diálogo con teclado: centrado en lo visible y sin pasar de su alto')
check(encuadreVisible('dialogo', { alto: 420, arriba: 120 }, 800).top === 330, 'diálogo con la página corrida (iOS): sigue lo visible')
check(encuadreVisible('dialogo', { alto: 150, arriba: 0 }, 800).maxHeight === 160, 'diálogo en una pantalla mínima: 160 px de alto mínimo')
const cajon = encuadreVisible('panel', { alto: 420, arriba: 30 }, 800)
check(cajon.top === 30 && cajon.height === 420 && cajon.bottom === 'auto', 'cajón con teclado: solo lo visible')
const hojaTeclado = encuadreVisible('hoja', { alto: 420, arriba: 0 }, 800)
check(hojaTeclado.bottom === 380 && hojaTeclado.maxHeight === Math.round(420 * 0.92), 'hoja con teclado: apoyada encima del teclado')
check(JSON.stringify(encuadreVisible('ventana', { alto: 420, arriba: 0 }, 800)) === '{}', 'la ventana del computador no se toca')
check(acceso.includes('...(medida ? encuadreVisible(formato, medida.vista, medida.altoPantalla) : {}),') && acceso.includes("vv.addEventListener('resize', medir)"), 'AccesoCuenta aplica el encaje con visualViewport')
check(acceso.includes("document.addEventListener('focusin', mostrar)") && acceso.includes("el.scrollIntoView({ block: 'nearest' })"), 'el campo enfocado queda a la vista')
// Accesibilidad y capa.
check(acceso.includes('aria-modal="true"') && (acceso.match(/<Dialogo\.Title/g) ?? []).length >= 3, 'aria-modal y título (aria-labelledby) en cada formato')
check(acceso.includes('<Dialogo.Portal>') && !/<Dialogo\.Portal container=/.test(acceso), 'portal al body: fuera de la cabecera y de su transform «Al bajar»')
check(!leer('components/site/SiteHeader.tsx').includes('<AccesoCuenta') && !/<AccesoCuenta/.test(leer('components/site/header/HeaderShared.tsx')), 'el acceso no se monta dentro de la cabecera')
check(acceso.includes('if (celular && !conHistorial.current)'), 'celular: el botón atrás cierra también el diálogo y el cajón')
check(acceso.includes("querySelectorAll<HTMLElement>('[data-cuenta-modo]')") && acceso.includes('setPosicion(POSICION_SIN_ANCLA)'), 'ventana sin ancla a la vista: del ícono de cuenta o arriba a la derecha')
// «Iniciar sesión» que vuelve a donde estaba.
check(rutaIniciarSesion('/favoritos') === '/auth?siguiente=%2Ffavoritos', '/favoritos → /auth?siguiente=/favoritos')
check(rutaIniciarSesion('/sede-norte/productos/abc') === '/auth?siguiente=%2Fsede-norte%2Fproductos%2Fabc', 'con prefijo de sede')
check(rutaIniciarSesion('/auth') === '/auth' && rutaIniciarSesion('/auth?tab=register') === '/auth' && rutaIniciarSesion(null) === '/auth', 'desde /auth o sin ruta: /auth')
check(['//otro.com', 'https://otro.com', '/\\otro.com', 'favoritos'].every((r) => rutaIniciarSesion(r) === '/auth'), 'nunca a otro sitio')
const eventos = leer('components/site/cuenta/eventos.ts')
check(/export function alTocarIniciarSesion\([\s\S]*?alTocarEnlaceCuenta\(e, href, 'ingresar', \{ quedarse: true, paginaRespaldo: href \}\)/.test(eventos), '«Iniciar sesión»: misma ventana, vista ingresar, se queda donde estaba')
check(acceso.includes('avisarAccesoEntro()'), 'al entrar sin salir de la página, se avisa (reseñas)')
const enlaceIniciar = leer('components/site/cuenta/EnlaceIniciarSesion.tsx')
check(enlaceIniciar.includes('const href = rutaIniciarSesion(volverA ?? ruta)') && enlaceIniciar.includes('alTocarIniciarSesion(e, href)') && enlaceIniciar.includes('if (alNavegar && !hayAccesoMontado()) alNavegar()'), 'EnlaceIniciarSesion: enlace a /auth?siguiente= que abre el acceso')
const usos = {
  'components/site/favoritos/FavoritosPagina.tsx': '/favoritos',
  'components/site/favoritos/FavoritosDrawer.tsx': 'panel de favoritos',
  'app/consultar-pedido/SeguirPedido.tsx': 'consultar pedido',
  'components/site/reviews/ReviewForm.tsx': 'reseñas «solo compradores»',
  'components/site/volumen/PrecioVolumenFicha.tsx': 'precios por volumen',
  'app/mi-cuenta/facturas/[id]/page.tsx': 'factura de Mi cuenta',
}
for (const [archivo, donde] of Object.entries(usos)) {
  const f = leer(archivo)
  check(f.includes('<EnlaceIniciarSesion') && !/href=\{?\s*(ruta\()?["'`]\/auth/.test(f) && !f.includes('abrirAccesoCuenta({') && !f.includes('href="/mi-cuenta" className={`${botonSecundario}'), `${donde}: «Iniciar sesión» con la regla única (sin /auth directo)`)
}
check(leer('components/site/favoritos/FavoritosDrawer.tsx').includes('alNavegar={onClose}'), 'panel de favoritos: se cierra solo si navega a la página; si no, el acceso se abre encima')
for (const f of ['components/site/favoritos/FavoritosDrawer.tsx', 'components/site/reviews/ReviewForm.tsx']) {
  check(/e\.key === 'Escape' && !e\.defaultPrevented && !(raiz|document\.documentElement)\.hasAttribute\('data-cuenta-abierta'\)/.test(leer(f)), `${f}: Escape con el acceso encima cierra solo el acceso`)
}
const resenas = leer('components/site/reviews/ReviewForm.tsx')
check(/addEventListener\(EVENTO_ACCESO_ENTRO/.test(resenas) && resenas.includes('}, [paso, productId, entradas])'), 'reseñas: al entrar se vuelve a verificar la compra')
check(leer('components/site/volumen/PrecioVolumenFicha.tsx').includes('onAuthStateChange'), 'precios por volumen: el aviso cambia al entrar')
const legado = leer('components/site/SiteHeader.tsx')
check((legado.match(/alTocarEnlaceCuenta\(e, '\/auth'\)/g) ?? []).length === 2 && legado.includes("alTocarEnlaceCuenta(e, '/auth?tab=register', 'registro')"), 'cabecera antigua: ícono y menú con la misma regla')
for (const [archivo, patron] of [
  ['components/site/MenuInferior.tsx', /alTocarEnlaceCuenta\(e, href\(d\)\)/],
  ['components/site/header/mobile/MobileTabs.tsx', /alTocarEnlaceCuenta\(e, ruta\('\/auth'\)\)/],
  ['components/site/header/HeaderPorZonas.tsx', /alTocarEnlaceCuenta\(e, '\/mi-cuenta'\)/],
  ['components/site/CheckoutWizard.tsx', /alTocarIngresarCheckout\(e, hrefIngresar\)/],
]) {
  check(patron.test(leer(archivo)), `${archivo}: abre el acceso con la regla única`)
}

if (problemas.length) {
  console.error(`✗ verify-acceso-cuenta: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-acceso-cuenta: ${casos} comprobaciones`)
