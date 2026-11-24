/**
 * Regla del botón «Volver» de las tiendas (Figma `EAvjINVRnlzFM70GVoWXgl`, regla 2992:74856,
 * aprobada por el dueño el 2026-11-24).
 *
 * - El ← vuelve a donde venía el cliente DENTRO de la tienda (categoría con sus filtros, búsqueda,
 *   inicio): si el paso anterior de esta pestaña es de la tienda, `history.back()` (misma posición).
 * - Si entró directo (WhatsApp, Google, correo, pestaña nueva), va a la página «madre»: ficha → su
 *   categoría; categoría → la categoría padre o el inicio; carrito → la última categoría vista o
 *   el inicio; pago → carrito; pedido → Mis pedidos o el inicio; subpágina de Mi cuenta → Mi
 *   cuenta; servicio → Servicios.
 * - Siempre dice el nombre real del destino: «Volver a Neveras», nunca «Volver» a secas.
 *
 * Código puro: sin React, Next, DOM ni imports (lo prueba `scripts/verify-volver.mjs` con Node).
 * El rastro de la pestaña lo guarda `components/site/volver/RastroNavegacion.tsx` en
 * sessionStorage; aquí solo están las reglas.
 */

/** Una página visitada en esta pestaña. */
export interface EntradaRastro {
  /** `pathname` real del navegador (con el prefijo de la sede si lo hay). */
  path: string
  /** `pathname + search`: a dónde se vuelve, con sus filtros. */
  url: string
  /**
   * Entradas del historial que lleva esta página (los filtros de una categoría hacen
   * `router.push` sin cambiar de página). Con más de una, `history.back()` no saldría de la
   * página: se vuelve con un enlace a `url` del paso anterior.
   */
  pasos: number
  /** Se llegó aquí desde fuera de la tienda: no hay paso anterior al que volver. */
  corte?: boolean
}

/** Página «madre»: a dónde se va si no hay paso anterior de la tienda. */
export interface DestinoPadre {
  /** Ruta interna SIN el prefijo de la sede (quien la pinta lo antepone). */
  href: string
  etiqueta: string
}

export interface DestinoVolver {
  /** `historial` = `history.back()`; `enlace` = navegar a `href`. */
  modo: 'historial' | 'enlace'
  href: string
  etiqueta: string
  /** `href` ya trae el prefijo de la sede (sale del rastro, que guarda rutas reales). */
  hrefReal: boolean
}

/** Miga de pan: la última (página actual) va sin `href`. */
export interface Miga {
  etiqueta: string
  href?: string
}

/** Tope del rastro por pestaña. */
export const MAXIMO_RASTRO = 30

export const INICIO: DestinoPadre = { href: '/', etiqueta: 'Inicio' }

/** «Volver a Neveras», «Volver al inicio», «Volver a la carta». */
export function textoVolver(etiqueta: string): string {
  const e = etiqueta.trim()
  if (!e) return 'Volver a la página anterior'
  if (e.toLowerCase() === 'inicio') return 'Volver al inicio'
  return `Volver a ${e}`
}

/**
 * Ruta del `document.referrer` si es de la misma tienda (mismo origen); `null` si viene de fuera
 * (WhatsApp, Google, correo) o no hay referente.
 */
export function rutaReferente(referrer: string | null | undefined, origen: string): string | null {
  if (!referrer) return null
  try {
    const u = new URL(referrer)
    if (u.origin !== origen) return null
    return `${u.pathname}${u.search}`
  } catch {
    return null
  }
}

/** Separa `'/search?q=x'` en ruta y búsqueda. */
function partir(url: string): { ruta: string; q: URLSearchParams } {
  const i = url.indexOf('?')
  const ruta = (i >= 0 ? url.slice(0, i) : url).replace(/\/+$/, '') || '/'
  const q = new URLSearchParams(i >= 0 ? url.slice(i + 1) : '')
  return { ruta, q }
}

/** Rutas con nombre fijo (sin prefijo de sede). */
const ETIQUETAS_FIJAS: Record<string, string> = {
  '/': 'Inicio',
  '/productos': 'Productos',
  '/menu': 'la carta',
  '/carrito': 'Tu carrito',
  '/checkout': 'Finalizar compra',
  '/favoritos': 'Favoritos',
  '/servicios': 'Servicios',
  '/agendar': 'Agendar cita',
  '/cotizar': 'Solicitar cotización',
  '/espacios': 'Espacios',
  '/reservas': 'Reservas',
  '/pases': 'Planes',
  '/viajes': 'Viajes',
  '/membresias': 'Membresías',
  '/rastrear': 'Rastrear pedido',
  '/tracking': 'Rastrear pedido',
  '/consultar-pedido': 'Consultar pedido',
  '/mi-cuenta': 'Mi cuenta',
  '/mi-cuenta/pedidos': 'Mis pedidos',
}

/**
 * Nombre de una ruta conocida (sin prefijo de sede, con su búsqueda): `'/search?q=nevera'` →
 * `Resultados de "nevera"`. Las rutas con nombre propio (categoría, ficha) lo registran ellas
 * mismas; aquí devuelven `null`.
 */
export function etiquetaDeRuta(url: string): string | null {
  const { ruta, q } = partir(url)
  if (ruta === '/search' || ruta === '/buscar') {
    const texto = (q.get('q') || '').trim()
    return texto ? `Resultados de "${texto.slice(0, 40)}"` : 'Buscar'
  }
  return ETIQUETAS_FIJAS[ruta] ?? null
}

/** `'Neveras | Tienda'` → `'Neveras'`. Sin separador, el título tal cual; vacío → null. */
export function etiquetaDeTitulo(titulo: string | null | undefined): string | null {
  const t = (titulo || '').trim()
  if (!t) return null
  const i = t.lastIndexOf(' | ')
  const corto = (i > 0 ? t.slice(0, i) : t).trim()
  return corto ? corto.slice(0, 60) : null
}

/**
 * Pasos a los que el ← nunca vuelve por historial: el pago, el acceso, la retoma de compra, el
 * editor. Desde un pedido recién pagado, «atrás» no debe reabrir el checkout.
 */
export function rutaSinRetorno(url: string): boolean {
  const { ruta } = partir(url)
  return (
    ruta === '/checkout' || ruta.startsWith('/checkout/') ||
    ruta === '/auth' || ruta.startsWith('/auth/') ||
    ruta.startsWith('/retomar/') ||
    ruta.startsWith('/vista-previa/') ||
    ruta.startsWith('/pruebas-internas')
  )
}

/**
 * Agrega la navegación actual al rastro de la pestaña. Puro: devuelve una pila nueva.
 *
 * - `primera`: primera página de este documento (carga completa). Con el mismo `path` arriba es
 *   una recarga; si viene «atrás/adelante» y está en la pila, se recorta hasta ella; con
 *   referente de la tienda se encadena; sin él, el cliente entró desde fuera (`corte`).
 * - Navegación interna: misma página → otro paso del historial (filtros); `pop` (atrás/adelante)
 *   → se recorta hasta esa página; si no, se agrega.
 */
export function avanzarRastro(
  pila: readonly EntradaRastro[],
  nav: { path: string; url: string; pop: boolean; primera: boolean; referente: string | null },
): EntradaRastro[] {
  const copia = pila.map((e) => ({ ...e }))
  const tope = copia[copia.length - 1]
  const nueva: EntradaRastro = { path: nav.path, url: nav.url, pasos: 1 }
  const recortar = (lista: EntradaRastro[]) => lista.slice(-MAXIMO_RASTRO)

  if (nav.primera) {
    if (tope && tope.path === nav.path) {
      tope.url = nav.url
      return recortar(copia)
    }
    if (nav.pop) {
      const i = ultimoIndice(copia, nav.path)
      if (i >= 0) {
        copia[i].url = nav.url
        return recortar(copia.slice(0, i + 1))
      }
    }
    if (nav.referente) {
      const pathRef = nav.referente.split('?')[0] || '/'
      if (!tope || tope.path !== pathRef) copia.push({ path: pathRef, url: nav.referente, pasos: 1 })
      copia.push(nueva)
      return recortar(copia)
    }
    copia.push({ ...nueva, corte: true })
    return recortar(copia)
  }

  if (tope && tope.path === nav.path) {
    if (tope.url !== nav.url && !nav.pop) tope.pasos += 1
    tope.url = nav.url
    return recortar(copia)
  }
  if (nav.pop) {
    const i = ultimoIndice(copia, nav.path)
    if (i >= 0) {
      copia[i].url = nav.url
      return recortar(copia.slice(0, i + 1))
    }
  }
  copia.push(nueva)
  return recortar(copia)
}

function ultimoIndice(pila: readonly EntradaRastro[], path: string): number {
  for (let i = pila.length - 1; i >= 0; i -= 1) if (pila[i].path === path) return i
  return -1
}

/** La última categoría vista en la pestaña (para el ← del carrito sin paso anterior). */
export function ultimaCategoriaVista(
  pila: readonly EntradaRastro[],
  nombres: (e: EntradaRastro) => string | null,
  sinPrefijo: (path: string) => string,
): { url: string; etiqueta: string } | null {
  for (let i = pila.length - 2; i >= 0; i -= 1) {
    const e = pila[i]
    if (!sinPrefijo(e.path).startsWith('/categorias/')) continue
    const etiqueta = nombres(e)
    if (etiqueta) return { url: e.url, etiqueta }
  }
  return null
}

export interface EntradaResolver {
  pila: readonly EntradaRastro[]
  /** `pathname` real de la página que pinta el ←. */
  actual: string
  padre: DestinoPadre
  /** Nombre de una entrada: el que registró la página, el de su ruta o el de su título. */
  nombre: (e: EntradaRastro) => string | null
  /** Quita el prefijo de la sede de un `pathname` real. */
  sinPrefijo: (path: string) => string
  /** `history.length` del navegador: con 1, `history.back()` no tiene a dónde ir. */
  largoHistorial: number
  /** Carrito: sin paso anterior, la última categoría vista antes que el padre. */
  preferirUltimaCategoria?: boolean
}

/** A dónde va el ← y qué dice. */
export function resolverVolver(e: EntradaResolver): DestinoVolver {
  const alPadre = (): DestinoVolver => {
    if (e.preferirUltimaCategoria) {
      const cat = ultimaCategoriaVista(e.pila, e.nombre, e.sinPrefijo)
      if (cat) return { modo: 'enlace', href: cat.url, etiqueta: cat.etiqueta, hrefReal: true }
    }
    return { modo: 'enlace', href: e.padre.href, etiqueta: e.padre.etiqueta, hrefReal: false }
  }
  const tope = e.pila[e.pila.length - 1]
  // El rastro todavía no registró esta página (o la pestaña no guarda nada): el padre.
  if (!tope || tope.path !== e.actual || tope.corte) return alPadre()
  const anterior = e.pila[e.pila.length - 2]
  if (!anterior) return alPadre()
  const urlAnterior = e.sinPrefijo(anterior.url)
  if (rutaSinRetorno(urlAnterior) || anterior.path === e.actual) return alPadre()
  const etiqueta = e.nombre(anterior) ?? 'la página anterior'
  // Un solo paso en esta página y un historial con a dónde volver: atrás de verdad (misma
  // posición y filtros). Si no, un enlace a la página anterior con sus filtros.
  if (tope.pasos <= 1 && e.largoHistorial > 1) return { modo: 'historial', href: anterior.url, etiqueta, hrefReal: true }
  return { modo: 'enlace', href: anterior.url, etiqueta, hrefReal: true }
}

// ─── Páginas «madre» ─────────────────────────────────────────────────────────────────────────

/** Nodo del árbol de categorías que ya carga el contexto (`ctx.categoriasTienda`). */
export interface NodoCategoria {
  id: number | string
  name: string
  slug: string
  children?: NodoCategoria[]
}

/** Camino raíz → categoría en el árbol ya cargado; `[]` si no está. Sin consultas. */
export function caminoCategoria(arbol: readonly NodoCategoria[] | null | undefined, id: number | string | null | undefined): NodoCategoria[] {
  if (id === null || id === undefined || !arbol) return []
  const buscar = (nodos: readonly NodoCategoria[], camino: NodoCategoria[]): NodoCategoria[] | null => {
    for (const n of nodos) {
      const aqui = [...camino, n]
      if (String(n.id) === String(id)) return aqui
      const hijo = n.children?.length ? buscar(n.children, aqui) : null
      if (hijo) return hijo
    }
    return null
  }
  return buscar(arbol, []) ?? []
}

const hrefCategoria = (slug: string) => `/categorias/${encodeURIComponent(slug)}`

/**
 * Ficha: padre = su categoría; sin categoría, la carta (restaurante) o Productos (lo de antes:
 * «Volver a productos» no se pierde). Migas: Inicio › categorías › producto.
 */
export function navegacionFicha(opciones: {
  camino: readonly NodoCategoria[]
  esRestaurante: boolean
  producto: string
}): { padre: DestinoPadre; migas: Miga[] } {
  const { camino, esRestaurante, producto } = opciones
  if (esRestaurante) {
    return {
      padre: { href: '/menu', etiqueta: 'la carta' },
      migas: [{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Carta', href: '/menu' }, { etiqueta: producto }],
    }
  }
  if (camino.length === 0) {
    return {
      padre: { href: '/productos', etiqueta: 'Productos' },
      migas: [{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Productos', href: '/productos' }, { etiqueta: producto }],
    }
  }
  const ultima = camino[camino.length - 1]
  return {
    padre: { href: hrefCategoria(ultima.slug), etiqueta: ultima.name },
    migas: [
      { etiqueta: 'Inicio', href: '/' },
      ...camino.map((c) => ({ etiqueta: c.name, href: hrefCategoria(c.slug) })),
      { etiqueta: producto },
    ],
  }
}

/** Categoría: padre = la categoría padre (Figma 5C2 «Volver a Cocina») o el inicio. */
export function navegacionCategoria(opciones: {
  categoria: string
  padre: { name: string; slug: string } | null | undefined
}): { padre: DestinoPadre; migas: Miga[] } {
  const p = opciones.padre
  return {
    padre: p ? { href: hrefCategoria(p.slug), etiqueta: p.name } : INICIO,
    migas: [
      { etiqueta: 'Inicio', href: '/' },
      ...(p ? [{ etiqueta: p.name, href: hrefCategoria(p.slug) }] : []),
      { etiqueta: opciones.categoria },
    ],
  }
}

/** Sección de Mi cuenta (del menú de la cuenta). */
export interface SeccionCuenta {
  href: string
  texto: string
}

/**
 * Mi cuenta: en una sección, padre = Mi cuenta; en un detalle (`/mi-cuenta/pedidos/<id>`), la
 * sección (Mis pedidos, Facturas, Tickets). En Inicio de la cuenta, `null` (sin ←).
 */
export function navegacionCuenta(ruta: string, secciones: readonly SeccionCuenta[]): { padre: DestinoPadre; migas: Miga[]; actual: string } | null {
  const r = ruta.replace(/\/+$/, '') || '/'
  if (r === '/mi-cuenta' || !r.startsWith('/mi-cuenta/')) return null
  let seccion: SeccionCuenta | null = null
  for (const s of secciones) {
    if (s.href === '/mi-cuenta') continue
    if ((r === s.href || r.startsWith(`${s.href}/`)) && (!seccion || s.href.length > seccion.href.length)) seccion = s
  }
  const base: Miga[] = [{ etiqueta: 'Inicio', href: '/' }, { etiqueta: 'Mi cuenta', href: '/mi-cuenta' }]
  const nombreSeccion = (s: SeccionCuenta) => s.texto
  if (seccion && r !== seccion.href) {
    const detalle = detalleCuenta(seccion.href)
    return {
      padre: { href: seccion.href, etiqueta: nombreSeccion(seccion) },
      migas: [...base, { etiqueta: nombreSeccion(seccion), href: seccion.href }, { etiqueta: detalle }],
      actual: detalle,
    }
  }
  // Una página de la cuenta fuera del menú de este negocio: su nombre sale de la ruta.
  const actual = seccion ? nombreSeccion(seccion) : nombreDeSegmento(r.split('/')[2] ?? '')
  return { padre: { href: '/mi-cuenta', etiqueta: 'Mi cuenta' }, migas: [...base, { etiqueta: actual }], actual }
}

function nombreDeSegmento(segmento: string): string {
  const t = decodeURIComponent(segmento).replace(/-/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Mi cuenta'
}

function detalleCuenta(hrefSeccion: string): string {
  if (hrefSeccion.endsWith('/pedidos')) return 'Pedido'
  if (hrefSeccion.endsWith('/facturas')) return 'Factura'
  if (hrefSeccion.endsWith('/tickets')) return 'Ticket'
  return 'Detalle'
}
