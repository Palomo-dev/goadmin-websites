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

const problemas = []
let casos = 0
const check = (cond, msg) => {
  casos++
  if (!cond) problemas.push(msg)
}
const leer = (r) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8')

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
check(acceso.includes("const CONSULTA_CELULAR = '(max-width: 767px)'") && acceso.includes("return celular ? 'hoja' : modo"), 'en el celular, la hoja inferior')
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

if (problemas.length) {
  console.error(`✗ verify-acceso-cuenta: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-acceso-cuenta: ${casos} comprobaciones`)
