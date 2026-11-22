/**
 * Favoritos de la tienda (Figma «16 Sitio web» 2762:61067, aprobado 2026-11-22). Lógica pura, sin
 * React ni Supabase: la usan el almacén del navegador, la API, la página /favoritos, el panel
 * lateral y `scripts/verify-favoritos.mjs` (por eso no importa nada con alias `@/`).
 *
 * Dónde se guardan:
 * - Sin sesión, en el dispositivo: `localStorage.guest_favorites` (lista de ids, como siempre, para
 *   no romper pestañas abiertas con el código anterior) y `guest_favorites_meta` (fecha y precio
 *   al guardar de cada id, para «Recientes» y «Bajó de precio»).
 * - Con sesión, en la cuenta: tabla `store_favorites` (o `customers.metadata.favorites` mientras
 *   la tabla no exista). Al iniciar sesión se juntan los del dispositivo con los de la cuenta.
 */

export const CLAVE_DISPOSITIVO = 'guest_favorites'
export const CLAVE_DISPOSITIVO_META = 'guest_favorites_meta'
/** Tope de favoritos por cliente (y de ids por consulta). */
export const MAX_FAVORITOS = 200
/** Tope de productos de una lista compartida. */
export const MAX_LISTA_COMPARTIDA = 100
/** «Pocas unidades» / «Quedan N»: el mismo umbral por defecto del aviso de stock bajo del sitio. */
export const UMBRAL_POCAS_UNIDADES = 5

export interface FavoritoGuardado {
  productId: number
  /** Variante (producto hijo) guardada; `null` = el producto. */
  variantId: number | null
  /** ISO 8601. */
  guardadoEn: string
  precioAlGuardar: number | null
}

const entero = (v: unknown): number | null => {
  const n = typeof v === 'string' && /^\d{1,9}$/.test(v.trim()) ? Number(v) : v
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 2_147_483_648 ? n : null
}
const precio = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null
}
const fechaIso = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : new Date(t).toISOString()
}

export const claveFavorito = (f: Pick<FavoritoGuardado, 'productId' | 'variantId'>): string => `${f.productId}:${f.variantId ?? ''}`

/** Un favorito válido o `null` (ids enteros positivos, precio ≥ 0, fecha ISO). */
export function favoritoValido(v: unknown, ahora: () => string = () => new Date().toISOString()): FavoritoGuardado | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const productId = entero(o.productId)
  if (productId === null) return null
  return {
    productId,
    variantId: o.variantId === null || o.variantId === undefined ? null : entero(o.variantId),
    guardadoEn: fechaIso(o.guardadoEn) ?? ahora(),
    precioAlGuardar: precio(o.precioAlGuardar),
  }
}

/** Lista sin repetidos (gana la primera aparición) y con el tope. */
export function sinRepetidos(lista: readonly FavoritoGuardado[], max = MAX_FAVORITOS): FavoritoGuardado[] {
  const vistos = new Set<string>()
  const salida: FavoritoGuardado[] = []
  for (const f of lista) {
    const k = claveFavorito(f)
    if (vistos.has(k)) continue
    vistos.add(k)
    salida.push(f)
    if (salida.length >= max) break
  }
  return salida
}

/**
 * Lee lo guardado en el dispositivo. `ids` es la lista de siempre (`guest_favorites`, en el orden
 * en que se agregaron); `meta` el mapa id → `{ t, p }`. Sin fecha guardada, una fecha antigua que
 * respeta el orden de la lista (así «Recientes» sigue funcionando con lo guardado antes).
 */
export function leerDispositivo(ids: unknown, meta: unknown): FavoritoGuardado[] {
  if (!Array.isArray(ids)) return []
  const m = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, { t?: unknown; p?: unknown }>) : {}
  const salida: FavoritoGuardado[] = []
  ids.forEach((crudo, i) => {
    const productId = entero(crudo)
    if (productId === null) return
    const extra = m[String(productId)] ?? {}
    salida.push({
      productId,
      variantId: null,
      guardadoEn: fechaIso(extra.t) ?? new Date(Date.UTC(2000, 0, 1) + i * 1000).toISOString(),
      precioAlGuardar: precio(extra.p),
    })
  })
  return sinRepetidos(salida)
}

/** Lo que se escribe en el dispositivo (las dos claves). */
export function escribirDispositivo(lista: readonly FavoritoGuardado[]): { ids: number[]; meta: Record<string, { t: string; p: number | null }> } {
  const ids: number[] = []
  const meta: Record<string, { t: string; p: number | null }> = {}
  // El dispositivo guarda por producto (el corazón de las tarjetas no elige variante).
  for (const f of sinRepetidos(lista.map((x) => ({ ...x, variantId: null })))) {
    ids.push(f.productId)
    meta[String(f.productId)] = { t: f.guardadoEn, p: f.precioAlGuardar }
  }
  return { ids, meta }
}

/**
 * Junta los favoritos del dispositivo con los de la cuenta, sin duplicar. Si un producto está en
 * los dos, se queda el de la cuenta. Devuelve la lista final (los más recientes primero) y los
 * que hay que agregar a la cuenta.
 */
export function juntarFavoritos(
  cuenta: readonly FavoritoGuardado[],
  dispositivo: readonly FavoritoGuardado[],
  max = MAX_FAVORITOS,
): { todos: FavoritoGuardado[]; nuevos: FavoritoGuardado[] } {
  const enCuenta = new Set(cuenta.map(claveFavorito))
  const espacio = Math.max(0, max - enCuenta.size)
  const nuevos = sinRepetidos(dispositivo.filter((f) => !enCuenta.has(claveFavorito(f)))).slice(0, espacio)
  const todos = ordenarPorFecha(sinRepetidos([...cuenta, ...nuevos], max))
  return { todos, nuevos }
}

/** Los más recientes primero (empate: el de id mayor). No muta. */
export function ordenarPorFecha<T extends Pick<FavoritoGuardado, 'guardadoEn' | 'productId'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => (a.guardadoEn === b.guardadoEn ? b.productId - a.productId : a.guardadoEn < b.guardadoEn ? 1 : -1))
}

/** Agrega (al principio, como el más reciente) o quita un favorito. No muta. */
export function alternarFavorito(lista: readonly FavoritoGuardado[], f: FavoritoGuardado): { lista: FavoritoGuardado[]; agregado: boolean } {
  const k = claveFavorito(f)
  if (lista.some((x) => claveFavorito(x) === k)) return { lista: lista.filter((x) => claveFavorito(x) !== k), agregado: false }
  return { lista: sinRepetidos([f, ...lista]), agregado: true }
}

// ─── Producto en la lista ────────────────────────────────────────────────────────────────────

/** Lo que pintan la tarjeta, la fila del panel y las sugerencias (lo arma el servidor). */
export interface FichaFavorito {
  id: number
  uuid: string | null
  nombre: string
  categoriaId: number | null
  categoria: string | null
  precio: number | null
  precioAnterior: number | null
  imagen: string | null
  sku: string | null
  /** Padre con variantes: «Elegir» (lleva a la ficha). */
  esPadre: boolean
  /** Cantidad de variantes activas del padre (`null` = no se sabe). */
  variantes: number | null
  /** Plato con un grupo obligatorio: también «Elegir». */
  requiereElegir: boolean
  /** Stock disponible; `null` = no controla inventario. */
  stock: number | null
  /** Unidades vendidas en la web (para «Más vendidos»). */
  ventas: number
}

export type AccionFavorito = 'agregar' | 'elegir' | 'agotado' | 'no_disponible'
export type InsigniaFavorito = 'bajo_precio' | 'agotado' | 'pocas' | null

export interface EstadoFavorito {
  accion: AccionFavorito
  insignia: InsigniaFavorito
  /** «Quedan N» (solo con pocas unidades). */
  quedan: number | null
  bajoPrecio: boolean
}

/** Bajó de precio: hay precio al guardar y el de hoy es menor (al menos un centavo). */
export function bajoDePrecio(precioAlGuardar: number | null | undefined, precioActual: number | null | undefined): boolean {
  if (precioAlGuardar == null || precioActual == null) return false
  if (!(precioAlGuardar > 0) || !(precioActual >= 0)) return false
  return precioActual < precioAlGuardar - 0.005
}

/**
 * Qué botón y qué insignia lleva un favorito. Insignia (una sola, Figma 2762:61084): Agotado ›
 * Bajó de precio › Pocas unidades. Botón: Agotado, Elegir (padre o grupo obligatorio), No
 * disponible (padre sin variantes o sin precio) o Agregar.
 */
export function estadoFavorito(ficha: FichaFavorito, guardado?: Pick<FavoritoGuardado, 'precioAlGuardar'> | null, umbral = UMBRAL_POCAS_UNIDADES): EstadoFavorito {
  const agotado = !ficha.esPadre && ficha.stock !== null && ficha.stock <= 0
  const sinVariantes = ficha.esPadre && ficha.variantes !== null && ficha.variantes <= 0
  const pocas = !agotado && !ficha.esPadre && ficha.stock !== null && ficha.stock > 0 && ficha.stock <= umbral ? Math.floor(ficha.stock) : null
  const bajo = bajoDePrecio(guardado?.precioAlGuardar ?? null, ficha.precio)
  let accion: AccionFavorito
  if (agotado) accion = 'agotado'
  else if (sinVariantes) accion = 'no_disponible'
  else if (ficha.esPadre || ficha.requiereElegir) accion = 'elegir'
  else if (ficha.precio === null) accion = 'no_disponible'
  else accion = 'agregar'
  return { accion, insignia: agotado ? 'agotado' : bajo ? 'bajo_precio' : pocas !== null ? 'pocas' : null, quedan: pocas, bajoPrecio: bajo }
}

/** Pie del panel y botón «Agregar todo»: productos, disponibles (no agotados), agregables y su suma. */
export function resumenFavoritos(fichas: readonly FichaFavorito[]): { productos: number; disponibles: number; agregables: number; suma: number } {
  let disponibles = 0
  let agregables = 0
  let suma = 0
  for (const f of fichas) {
    const e = estadoFavorito(f)
    if (e.accion !== 'agotado' && e.accion !== 'no_disponible') {
      disponibles++
      suma += f.precio ?? 0
    }
    if (e.accion === 'agregar') agregables++
  }
  return { productos: fichas.length, disponibles, agregables, suma }
}

/** Los que «Agregar todo al carrito» puede sumar directo (simples, con precio y stock). */
export function fichasAgregables(fichas: readonly FichaFavorito[]): FichaFavorito[] {
  return fichas.filter((f) => estadoFavorito(f).accion === 'agregar')
}

// ─── Ordenar ─────────────────────────────────────────────────────────────────────────────────

export const ORDENES_FAVORITOS = ['recientes', 'precio_asc', 'precio_desc', 'nombre'] as const
export type OrdenFavoritos = (typeof ORDENES_FAVORITOS)[number]
export const ETIQUETAS_ORDEN_FAVORITOS: Readonly<Record<OrdenFavoritos, string>> = {
  recientes: 'Recientes',
  precio_asc: 'Precio: menor a mayor',
  precio_desc: 'Precio: mayor a menor',
  nombre: 'Nombre (A–Z)',
}

/**
 * Ordena las fichas. «Recientes» usa la fecha al guardar (las que no tienen fecha, al final); los
 * precios dejan sin precio al final; «Nombre» compara en español sin mayúsculas ni tildes. No muta.
 */
export function ordenarFichas(fichas: readonly FichaFavorito[], orden: OrdenFavoritos, guardados: readonly FavoritoGuardado[] = []): FichaFavorito[] {
  const fecha = new Map(guardados.map((g) => [g.productId, g.guardadoEn]))
  const nombre = (a: FichaFavorito, b: FichaFavorito) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) || a.id - b.id
  const copia = [...fichas]
  if (orden === 'nombre') return copia.sort(nombre)
  if (orden === 'precio_asc' || orden === 'precio_desc') {
    const signo = orden === 'precio_asc' ? 1 : -1
    return copia.sort((a, b) => {
      if (a.precio === null || b.precio === null) return a.precio === b.precio ? nombre(a, b) : a.precio === null ? 1 : -1
      return a.precio === b.precio ? nombre(a, b) : (a.precio - b.precio) * signo
    })
  }
  return copia.sort((a, b) => {
    const fa = fecha.get(a.id) ?? ''
    const fb = fecha.get(b.id) ?? ''
    if (fa === fb) return b.id - a.id
    return fa < fb ? 1 : -1
  })
}

export function ordenValido(v: unknown): OrdenFavoritos {
  return typeof v === 'string' && (ORDENES_FAVORITOS as readonly string[]).includes(v) ? (v as OrdenFavoritos) : 'recientes'
}

// ─── «También te puede gustar» ───────────────────────────────────────────────────────────────

export type FuenteSugerencias = 'categorias' | 'mas_vendidos' | 'destacados'

/**
 * Hasta `max` sugerencias del catálogo, sin los favoritos ni los agotados.
 * - `categorias`: de las categorías de los favoritos, los más vendidos primero (sin favoritos con
 *   categoría, cae a más vendidos).
 * - `mas_vendidos`: por unidades vendidas en la web.
 * - `destacados`: primero los que están en oferta (precio anterior), luego los más vendidos.
 * Si no queda ninguno, lista vacía (la sección se oculta).
 */
export function elegirSugerencias(catalogo: readonly FichaFavorito[], favoritas: readonly FichaFavorito[], fuente: FuenteSugerencias, max = 4): FichaFavorito[] {
  const excluir = new Set(favoritas.map((f) => f.id))
  const candidatos = catalogo.filter((f) => !excluir.has(f.id) && estadoFavorito(f).accion !== 'agotado' && estadoFavorito(f).accion !== 'no_disponible' && f.precio !== null)
  const porVentas = (a: FichaFavorito, b: FichaFavorito) => b.ventas - a.ventas || b.id - a.id
  const oferta = (f: FichaFavorito) => f.precioAnterior !== null && f.precio !== null && f.precioAnterior > f.precio
  const categorias = new Set(favoritas.map((f) => f.categoriaId).filter((c): c is number => c !== null))
  if (fuente === 'categorias' && categorias.size > 0) {
    return candidatos.filter((f) => f.categoriaId !== null && categorias.has(f.categoriaId)).sort(porVentas).slice(0, max)
  }
  if (fuente === 'destacados') {
    return [...candidatos].sort((a, b) => Number(oferta(b)) - Number(oferta(a)) || porVentas(a, b)).slice(0, max)
  }
  return [...candidatos].sort(porVentas).slice(0, max)
}

// ─── Consultas y listas compartidas ──────────────────────────────────────────────────────────

/** Ids de `?ids=1,2,3` (enteros positivos, sin repetidos, hasta `max`). */
export function idsDeConsulta(valor: string | null | undefined, max = MAX_FAVORITOS): number[] {
  if (!valor) return []
  const salida: number[] = []
  for (const parte of valor.split(',')) {
    const n = entero(parte.trim())
    if (n !== null && !salida.includes(n)) salida.push(n)
    if (salida.length >= max) break
  }
  return salida
}

/** Token de una lista compartida (lo genera el servidor; aquí solo se valida la forma). */
export function tokenListaValido(v: unknown): v is string {
  return typeof v === 'string' && /^[A-Za-z0-9_-]{12,32}$/.test(v)
}
