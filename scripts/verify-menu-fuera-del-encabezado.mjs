/**
 * verify-menu-fuera-del-encabezado.mjs — los menús y hojas que abre el encabezado se pintan FUERA
 * del <header> (CapaEncabezado), nunca dentro.
 *
 *   npm run verify:menu-fuera-del-encabezado
 *
 * El bug (2026-11-25, celular de una tienda con «Al bajar: encoger»): con la página bajada,
 * SiteHeader envuelve el encabezado en un contenedor con `scale-[0.98]` (con «ocultar»,
 * `-translate-y-full`). Un `transform` en un ancestro vuelve a ese ancestro el bloque contenedor de
 * `position: fixed`: el cajón «Menú» (`fixed inset-0`) se abría recortado al alto del encabezado
 * (~230 px), con el fondo oscuro solo sobre la cabecera y los productos debajo.
 *
 * Qué comprueba (en el fuente; tolera CRLF):
 * 1. El cálculo: el envoltorio de «Al bajar» sí lleva transform (si un día deja de llevarlo, este
 *    verify sigue valiendo: ningún `fixed` de menú debe depender de que no haya transform arriba).
 * 2. CapaEncabezado: portal a la raíz del sitio (o el body), `display: contents`, copia variables
 *    del <header>, `data-capa-encabezado`, `data-hdr-bp`; Esc, Tab atrapado, foco de vuelta y chat
 *    oculto mientras está abierta.
 * 3. Ningún `fixed … inset-0` (cajón, pantalla, fondo oscuro) de components/site/header/** queda
 *    fuera de un portal: o va dentro de <CapaEncabezado>, o de un portal propio (vaul/Radix con
 *    `container` fuera del <header>, createPortal al body). Excepciones con motivo, abajo.
 * 4. Cada variante móvil envuelve su menú en la capa y conserva el bloqueo de scroll.
 * 5. Las reglas `header …` de app/globals.css que pintan el menú tienen su par
 *    `:where([data-capa-encabezado]) …` (el menú se ve igual fuera del <header>).
 * 6. El «Menú» del menú inferior pide abrir por evento antes de buscar el botón en el DOM.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('..', import.meta.url))
const leer = (r) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n')
const problemas = []
let casos = 0
const check = (c, m) => { casos++; if (!c) problemas.push(m) }

// ─── 1. El envoltorio de «Al bajar» lleva transform ─────────────────────────────────────────────
const siteHeader = leer('components/site/SiteHeader.tsx')
check(/-translate-y-full/.test(siteHeader) && /scale-\[0\.98\]/.test(siteHeader),
  'SiteHeader: no se encontró el transform de «Al bajar» (si cambió, revisa el comentario de CapaEncabezado)')

// ─── 2. CapaEncabezado ─────────────────────────────────────────────────────────────────────────
const capa = leer('components/site/header/CapaEncabezado.tsx')
check(/createPortal\(/.test(capa), 'CapaEncabezado: usa createPortal')
check(/querySelector<HTMLElement>\('\[data-raiz-sitio\]'\)\s*\?\?\s*document\.body/.test(capa), 'CapaEncabezado: el portal va a la raíz del sitio (o al body), nunca dentro del <header>')
check(/className="contents"/.test(capa), 'CapaEncabezado: la capa no crea caja (display: contents)')
check(/data-capa-encabezado=\{comoEncabezado \? '' : undefined\}/.test(capa), 'CapaEncabezado: marca data-capa-encabezado (reglas del menú en app/globals.css)')
check(/data-hdr-bp=\{puntoDeCorte\}/.test(capa), 'CapaEncabezado: copia data-hdr-bp (punto de corte del encabezado)')
check(/clave\.startsWith\('--'\) \|\| clave === 'color'/.test(capa), 'CapaEncabezado: copia solo variables y color del <header> (sin position/top)')
check(/e\.key === 'Escape'/.test(capa), 'CapaEncabezado: Esc cierra')
check(/e\.key !== 'Tab'/.test(capa) && /\(e\.shiftKey \? ultimo : primero\)\.focus\(\)/.test(capa), 'CapaEncabezado: el Tab no sale de la capa')
check(/volver\?\.focus\(\{ preventScroll: true \}\)/.test(capa), 'CapaEncabezado: el foco vuelve al botón que abrió')
check(/setAttribute\('data-menu-movil-abierto'/.test(capa), 'CapaEncabezado: marca <html> para ocultar el chat')
check(/createPortal\(\s*<div\b/.test(capa) && !/createPortal\(\s*<header\b/.test(capa), 'CapaEncabezado: el portal pinta un <div>, no otro <header>')


// ─── 3. Ningún `fixed … inset-0` de components/site/header/** fuera de un portal ────────────────
function archivos(dir) {
  const out = []
  for (const n of readdirSync(join(raiz, dir))) {
    const r = join(dir, n)
    if (statSync(join(raiz, r)).isDirectory()) out.push(...archivos(r))
    else if (/\.tsx$/.test(n)) out.push(relative(raiz, join(raiz, r)).replace(/\\/g, '/'))
  }
  return out
}
// Excepciones con motivo. Si una deja de cumplirse, este verify falla y hay que revisarla.
const EXCEPCIONES = {
  // Sin uso: nadie los importa (el Constructor ya no cambia de encabezado). Se comprueba abajo.
  'components/site/header/HeaderPorZonas.tsx': 'sin uso',
  'components/site/header/MenusEncabezado.tsx': 'sin uso',
  // (SelectorSede ya no es excepción: su confirmación va en CapaEncabezado desde 2026-11-25.)
}
const todos = archivos('components/site/header')
const SIN_USO = ['HeaderPorZonas', 'MenusEncabezado']
for (const f of SIN_USO) {
  const usos = [...todos, 'components/site/SiteHeader.tsx', 'components/site/OrganizationLayoutCliente.tsx', 'components/site/MenuInferior.tsx']
    .filter((r) => !SIN_USO.some((g) => r.endsWith(`/${g}.tsx`)))
    .filter((r) => new RegExp(`from ['"][^'"]*/${f}['"]`).test(leer(r)))
  check(usos.length === 0, `${f}: ahora se importa en ${usos.join(', ')} — su \`fixed inset-0\` necesita CapaEncabezado`)
}

/**
 * Posiciones de las aperturas (no autocerradas) de la etiqueta JSX `nombre`. Recorre los
 * atributos saltando las llaves: `alCerrar={() => …}` no se confunde con el final de la etiqueta.
 */
function aperturas(src, nombre) {
  const out = []
  let desde = 0
  for (;;) {
    const i = src.indexOf(`<${nombre}`, desde)
    if (i < 0) break
    desde = i + 1
    const sig = src[i + nombre.length + 1]
    if (!/[\s>/]/.test(sig ?? '')) continue
    let llaves = 0
    for (let k = i + nombre.length + 1; k < src.length; k++) {
      const c = src[k]
      if (c === '{') llaves++
      else if (c === '}') llaves--
      else if (c === '>' && llaves === 0) {
        if (src[k - 1] !== '/') out.push(i)
        break
      }
    }
  }
  return out
}
/** `true` si `i` cae dentro de un <nombre>…</nombre> abierto. */
function dentroDe(src, i, nombre) {
  const abiertas = aperturas(src, nombre).filter((p) => p < i).length
  const cerradas = src.slice(0, i).split(`</${nombre}>`).length - 1
  return abiertas > cerradas
}
const PORTALES = [
  // <CapaEncabezado …>…</CapaEncabezado> (la autocerrada `<CapaEncabezado … />` es solo contenedor).
  'CapaEncabezado',
  // vaul: la hoja va en <Drawer.Portal container={…}> (MobileBottomSheet la manda a la capa).
  'Drawer.Portal',
  // Radix (HojaMonedas): createPortal al body dentro del diálogo.
  'DialogoMoneda.Root',
]
// Hojas reutilizables (se definen aquí y se pintan desde varios sitios): se revisa cada llamada.
const REUTILIZABLES = { 'components/site/header/mobile/MobileTabs.tsx': ['ModalCategorias'] }
/** Nombre de la función (componente) donde cae `i`. */
function funcionEn(src, i) {
  const m = [...src.slice(0, i).matchAll(/\n(?:export )?function (\w+)\(/g)].pop()
  return m?.[1] ?? null
}
const cajones = []
for (const ruta of todos) {
  if (ruta.endsWith('/CapaEncabezado.tsx') || ruta.endsWith('/CapaFijaEncabezado.tsx')) continue
  const src = leer(ruta)
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const clase = m[1] ?? m[2] ?? ''
    if (!/(^|\s)fixed(\s|$)/.test(clase) || !/(^|\s)inset-0(\s|$)/.test(clase)) continue
    cajones.push(ruta)
    if (EXCEPCIONES[ruta]) continue
    if ((REUTILIZABLES[ruta] ?? []).includes(funcionEn(src, m.index))) continue
    const ok = PORTALES.some((nombre) => dentroDe(src, m.index, nombre))
    const linea = src.slice(0, m.index).split('\n').length
    check(ok, `${ruta}:${linea}: \`${clase.slice(0, 60)}…\` está dentro del <header> sin CapaEncabezado (el transform de «Al bajar» lo recorta)`)
  }
}
check(cajones.includes('components/site/header/mobile/MobileDrawer.tsx'), 'no se encontró el cajón de MobileDrawer (¿cambió? actualiza este verify)')
// Cada llamada a una hoja reutilizable dentro del encabezado va en la capa (o fuera del <header>).
for (const [ruta, nombres] of Object.entries(REUTILIZABLES)) {
  const src = leer(ruta)
  for (const nombre of nombres) {
    let llamadas = 0
    for (const m of src.matchAll(new RegExp(`<${nombre}[\\s>/]`, 'g'))) {
      llamadas++
      const linea = src.slice(0, m.index).split('\n').length
      const ok = ['CapaEncabezado', 'FueraDelEncabezado'].some((n) => dentroDe(src, m.index, n))
      check(ok, `${ruta}:${linea}: <${nombre}> dentro del <header> sin CapaEncabezado ni FueraDelEncabezado`)
    }
    check(llamadas > 0, `${ruta}: no se encontró ninguna llamada a <${nombre}> (¿cambió? actualiza este verify)`)
  }
}

// ─── 4. Cada variante móvil ─────────────────────────────────────────────────────────────────────
const variantes = {
  'components/site/header/mobile/MobileDrawer.tsx': ['useBloqueoScrollFondo(open)', '<CapaEncabezado abierta={open} alCerrar={() => setOpen(false)} variables={estiloHeader} retorno={botonMenuRef}>', 'useAbrirMenuMovil(() => setOpen(true))', 'data-foco-inicial=""'],
  'components/site/header/mobile/MobileFullscreen.tsx': ['useBloqueoScrollFondo(open)', '<CapaEncabezado abierta={open} alCerrar={() => setOpen(false)} variables={estiloHeader} retorno={botonMenuRef}>', 'useAbrirMenuMovil(() => setOpen(true))'],
  'components/site/header/mobile/MobileBottomSheet.tsx': ['<CapaEncabezado abierta={open} persistente gestionarFoco={false} variables={estiloHeader} refCapa={setCapaEl} />', '<Drawer.Portal container={capaEl}>', 'useAbrirMenuMovil(() => setOpen(true))'],
  'components/site/header/mobile/MobileTabs.tsx': ['<CapaEncabezado abierta={!!pildoraMovil && categoriasPildora}', 'useBloqueoScrollFondo(true)'],
  'components/site/header/mobile/MobileMenuShell.tsx': ['<CapaEncabezado abierta={abierto} persistente={montado} alCerrar={onCerrar} comoEncabezado={false}>', "document.body.style.overflow = 'hidden'"],
  'components/site/header/mobile/HeaderMovilConfigurable.tsx': ['<MobileMenuShell ', '<CapaEncabezado abierta={buscar}', "useAbrirMenuMovil(() => setAbierto(true), presentacion.estilo !== 'none' && presentacion.estilo !== 'tabs')"],
  'components/site/header/HeaderMinimal.tsx': ['<CapaEncabezado abierta={fullscreenOpen}', "document.body.style.overflow = 'hidden'"],
}
for (const [ruta, frases] of Object.entries(variantes)) {
  const src = leer(ruta)
  for (const f of frases) check(src.includes(f), `${ruta}: falta \`${f}\``)
}
// El cajón y su fondo oscuro, juntos dentro de la capa y a pantalla completa (alto dinámico).
{
  const src = leer('components/site/header/mobile/MobileDrawer.tsx')
  const i = src.indexOf('<CapaEncabezado abierta={open}')
  const j = src.indexOf('</CapaEncabezado>')
  const bloque = i >= 0 && j > i ? src.slice(i, j) : ''
  check(/className="md:hidden fixed inset-0 z-\[60\] h-\[100dvh\]"/.test(bloque), 'MobileDrawer: el cajón ocupa toda la pantalla (100dvh) dentro de la capa')
  check(/bg-black\/50 backdrop-blur-sm/.test(bloque), 'MobileDrawer: el fondo oscuro va dentro de la capa')
  check(/pb-\[env\(safe-area-inset-bottom\)\]/.test(bloque), 'MobileDrawer: el panel respeta el área segura')
  check(/<span className="font-bold text-\[var\(--mm-title\)\]">Menú<\/span>/.test(bloque), 'MobileDrawer: el contenido del menú sigue igual (título «Menú»)')
}

// ─── 5. CSS: cada regla `header …` del menú tiene su par para la capa ───────────────────────────
const css = leer('app/globals.css')
const pares = [
  [/\[data-tema-colores\] header \[class\*='--header-bg-light'\],\n\[data-tema-colores\] :where\(\[data-capa-encabezado\]\) \[class\*='--header-bg-light'\] \{/, 'fondo del tema V2'],
  [/\[data-tema-colores\] :where\(\[data-capa-encabezado\]\) :is\(div, nav\):is\(\[class~='bg-white'\]/, 'superficies bg-white del tema V2'],
  [/:is\(header :is\([^)]*\), :where\(\[data-capa-encabezado\]\) :is\([^)]*\), \[data-franja-sede\]\) \[class\*='text-gray-'\]/, 'texto gris del tema V2'],
  [/\[data-encabezado-texto\]\[data-encabezado-texto\]\[data-encabezado-texto\] :where\(\[data-capa-encabezado\]\) :is\(/, 'color de texto del encabezado'],
  [/header,\n:where\(\[data-capa-encabezado\]\) \{\n {2}--mm-hover-bg: var\(--header-hover\);/, 'hover del menú'],
  [/header \[data-superficie-propia\]\[data-superficie-propia\],\n:where\(\[data-capa-encabezado\]\) \[data-superficie-propia\]/, 'superficies propias'],
  [/html\[data-menu-movil-abierto\] \[data-gochat-widget\][^{]*\{\s*display: none !important;/, 'chat oculto con el menú abierto'],
]
for (const [re, que] of pares) check(re.test(css), `app/globals.css: falta el par de la capa para «${que}»`)
// `:where` y nada más: el par no sube la especificidad de ninguna regla.
check(!/[^(]\[data-capa-encabezado\] [^{]*\{/.test(css.replace(/:where\(\[data-capa-encabezado\]\)/g, '')), 'app/globals.css: usa :where([data-capa-encabezado]) (sin subir especificidad)')

// ─── 6. El «Menú» del menú inferior ─────────────────────────────────────────────────────────────
const menuInferior = leer('components/site/MenuInferior.tsx')
check(/else if \(!pedirAbrirMenuMovil\(\)\) document\.querySelector<HTMLButtonElement>\('header button\[aria-label="Abrir menú"\]'\)\?\.click\(\)/.test(menuInferior),
  'MenuInferior: «Menú» pide abrir por evento y solo sin oyente toca el botón del encabezado')

if (problemas.length) {
  console.error(`✗ verify-menu-fuera-del-encabezado: ${problemas.length} de ${casos} fallaron`)
  for (const p of problemas) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ verify-menu-fuera-del-encabezado: ${casos} comprobaciones`)
