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

if (problemas.length) {
  console.error(`✗ verify-acceso-cuenta: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-acceso-cuenta: ${casos} comprobaciones`)
