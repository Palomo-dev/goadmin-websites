'use client'

/**
 * Carta QR en la mesa — estado compartido de la página en el navegador.
 *
 * La Carta QR es una página del sitio armada con secciones independientes (portada «mesa»,
 * servicio de mesa, carta «qr», pedido, cuenta y valoración). Todas leen y escriben este único
 * almacén (useSyncExternalStore), así una ronda enviada desde la barra del pedido actualiza la
 * barra de la mesa, la cuenta y el panel de la tableta sin que las secciones se conozcan.
 *
 * Qué guarda y de dónde sale:
 * - La mesa: la del QR validada por el servidor (useMesaQR → sessionStorage, 4 h).
 * - El pedido y la cuenta: GET /api/mesa/<mesa>/{pedido,cuenta}, cada 8 s mientras la pestaña
 *   está visible y al volver la conexión (estado de las rondas «en vivo»).
 * - La ronda por enviar: el carrito del sitio de esa sede (lib/cart.ts), con el comensal de
 *   cada línea. Se envía con POST /api/orders («Comer aquí» con la mesa y el comensal).
 * - Pantalla: el hash (#pedido, #estado, #cuenta, #pagar, #valorar), así «atrás» funciona.
 *   En la Carta QR por pasos (modo mesa, lib/restaurant/pasosMesa.ts) manda `?paso=` en su lugar:
 *   un paso a la vez, con su entrada en el historial. Cambiar de paso no recarga datos: el
 *   almacén es el mismo en todos.
 * - Comensal propio: localStorage por mesa («Yo» por defecto).
 */

import { useSyncExternalStore } from 'react'
import type { MesaGuardada } from '@/lib/restaurant/mesaQR'
import { getCartKey } from '@/lib/utils'
import {
  MENSAJES_MESA,
  claveComensal,
  claveRondaEnVuelo,
  claveRondasEnviadas,
  claveRondasLocales,
  firmaRonda,
  fusionarRondasLocales,
  parseCuentaMesa,
  parsePedidoMesa,
  parseRondasLocales,
  rondaPendienteIgual,
  sanearComensal,
  TEXTO_POR_CONFIRMAR,
  type CuentaMesa,
  type LineaMesa,
  type RondaLocal,
  type ModoDivision,
  type PedidoMesa,
} from '@/lib/restaurant/mesa-modelo'
import {
  pantallaDePaso,
  pasoAnterior,
  puedeIrAPaso,
  resolverPaso,
  type PasoMesa,
  type PasosDisponibles,
} from '@/lib/restaurant/pasosMesa'

export type PantallaMesa = '' | 'pedido' | 'estado' | 'cuenta' | 'pagar' | 'valorar'
const PANTALLAS: readonly PantallaMesa[] = ['pedido', 'estado', 'cuenta', 'pagar', 'valorar']

export interface AvisoMesa {
  tipo: 'mesero' | 'agotado' | 'error' | 'info' | 'ok'
  titulo: string
  texto?: string
  /** Solicitud que se puede cancelar («Cancelar» del aviso del mesero). */
  solicitudId?: string
  accion?: { texto: string; ir?: PantallaMesa }
}

export interface LineaRonda {
  /** Id de la línea en el carrito. */
  id: string | number
  productId: number
  nombre: string
  precio: number
  cantidad: number
  modificadores: string[]
  nota: string | null
  comensal: string
  imagen: string | null
}

export interface RondaEnviada {
  numero: number
  hora: string
  platos: number
  auto: boolean
}

/** Lo que el comensal eligió en la cuenta (08) y paga en «Pagar mi parte» (09). */
export interface SeleccionPago {
  modo: ModoDivision
  partes: number
  comensal: string | null
  /** % de propina elegido; `null` = «Otro» (valor en `propinaOtra`). */
  propinaPct: number | null
  propinaOtra: number
  monto: number
  propina: number
}

export interface EstadoMesaQR {
  subdomain: string
  branchId: number | null
  organizationId: number | null
  mesa: MesaGuardada | null
  pedido: PedidoMesa | null
  cuenta: CuentaMesa | null
  sinConexion: boolean
  pantalla: PantallaMesa
  servicioAbierto: boolean
  confirmarAbierto: boolean
  errorEnvio: boolean
  enviando: boolean
  aviso: AvisoMesa | null
  comensal: string
  ronda: LineaRonda[]
  ultimaRonda: RondaEnviada | null
  busqueda: string
  /** Hay sección «Pedido de la mesa» en la página (la barra inferior la pinta ella). */
  hayPedido: boolean
  /** Hay sección «Cuenta de la mesa». */
  hayCuenta: boolean
  hayValorar: boolean
  /** Hay sección «Servicio de mesa» (su barra reemplaza el aviso de mesa de la carta). */
  hayServicio: boolean
  /** Abono recién pagado (vuelta de la pasarela con ?ref=CQR-…). */
  abonoPagado: { reference: string; total: number | null; id: string | null; email: string | null } | null
  seleccionPago: SeleccionPago | null
  /** Instancia de <AvisosMesa /> que pinta los avisos y la hoja del mesero. */
  avisosDuenio: string | null
  /**
   * Los botones de la bienvenida (Ver la carta · Llamar al mesero · Pedir la cuenta) están a la
   * vista: la barra «Ver pedido de la mesa» se esconde (lámina 01, sin barra en la bienvenida).
   */
  botonesPortadaALaVista: boolean
  /**
   * Rondas que este celular envió y el equipo aún no confirma: se ven de inmediato como «por
   * confirmar» (también con la mesa sin sesión) y no dejan reenviar los mismos platos.
   */
  rondasLocales: RondaLocal[]
  /** Carta QR por pasos: el paso actual (`null` = página de siempre, todas las secciones apiladas). */
  paso: PasoMesa | null
  /** Pasos que existen en la página (según sus secciones visibles). `null` fuera de los pasos. */
  pasos: PasosDisponibles | null
  /** Lienzo del editor: el paso lo pide el editor y las secciones se pintan en línea. */
  pasosEnLienzo: boolean
}

const inicial: EstadoMesaQR = {
  subdomain: '',
  branchId: null,
  organizationId: null,
  mesa: null,
  pedido: null,
  cuenta: null,
  sinConexion: false,
  pantalla: '',
  servicioAbierto: false,
  confirmarAbierto: false,
  errorEnvio: false,
  enviando: false,
  aviso: null,
  comensal: 'Yo',
  ronda: [],
  ultimaRonda: null,
  busqueda: '',
  hayPedido: false,
  hayCuenta: false,
  hayValorar: false,
  hayServicio: false,
  abonoPagado: null,
  seleccionPago: null,
  avisosDuenio: null,
  botonesPortadaALaVista: false,
  rondasLocales: [],
  paso: null,
  pasos: null,
  pasosEnLienzo: false,
}

let estado: EstadoMesaQR = inicial
const oyentes = new Set<() => void>()

function emitir() {
  for (const o of oyentes) o()
}

export function setMesaQR(parcial: Partial<EstadoMesaQR>) {
  estado = { ...estado, ...parcial }
  emitir()
}

export function getMesaQR(): EstadoMesaQR {
  return estado
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => oyentes.delete(o)
}

export function useMesaQRStore<T>(selector: (e: EstadoMesaQR) => T): T {
  return useSyncExternalStore(
    suscribir,
    () => selector(estado),
    () => selector(inicial),
  )
}

// ─── Arranque ────────────────────────────────────────────────────────────────────────────────

/** El último abono iniciado en esta pestaña: al volver de la pasarela se sabe cuál y cuánto fue. */
const CLAVE_ULTIMO_ABONO = 'carta_qr_ultimo_abono'

let vigilando = false
let temporizador: ReturnType<typeof setInterval> | null = null

/** Lo llama cada sección al montarse; la primera arranca el sondeo y los oyentes. */
export function registrarSeccionMesa(opciones: {
  subdomain: string
  branchId: number | null
  organizationId: number | null
  seccion?: 'pedido' | 'cuenta' | 'valorar' | 'servicio'
}) {
  const parcial: Partial<EstadoMesaQR> = {}
  if (!estado.subdomain && opciones.subdomain) parcial.subdomain = opciones.subdomain
  if (estado.branchId === null && opciones.branchId !== null) parcial.branchId = opciones.branchId
  if (estado.organizationId === null && opciones.organizationId !== null) parcial.organizationId = opciones.organizationId
  if (opciones.seccion === 'pedido') parcial.hayPedido = true
  if (opciones.seccion === 'cuenta') parcial.hayCuenta = true
  if (opciones.seccion === 'valorar') parcial.hayValorar = true
  if (opciones.seccion === 'servicio') parcial.hayServicio = true
  if (Object.keys(parcial).length > 0) setMesaQR(parcial)
  if (vigilando || typeof window === 'undefined') return
  vigilando = true

  const leerHash = () => {
    if (estado.pasos) {
      // Carta QR por pasos: la pantalla la da `?paso=` (iniciarPasosMesa), no el hash.
      return
    }
    const h = window.location.hash.replace(/^#/, '') as PantallaMesa
    setMesaQR({ pantalla: (PANTALLAS as readonly string[]).includes(h) ? h : '' })
  }
  leerHash()
  window.addEventListener('hashchange', leerHash)
  window.addEventListener('cart-updated', leerRonda)
  window.addEventListener('storage', leerRonda)
  window.addEventListener('online', () => {
    setMesaQR({ sinConexion: false })
    void refrescarMesa()
  })
  window.addEventListener('offline', () => setMesaQR({ sinConexion: true }))
  setMesaQR({ sinConexion: typeof navigator !== 'undefined' && navigator.onLine === false })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refrescarMesa()
  })

  // Vuelta de la pasarela: /carta-qr?ref=CQR-… → «¡Gracias! Pagaste tu parte».
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref') || params.get('reference')
  if (ref && /^CQR-[0-9A-F]{32}$/.test(ref)) {
    let guardado: { id?: unknown; reference?: unknown; total?: unknown; email?: unknown } = {}
    try {
      guardado = JSON.parse(window.sessionStorage.getItem(CLAVE_ULTIMO_ABONO) || '{}')
    } catch {
      guardado = {}
    }
    const mismo = guardado.reference === ref
    setMesaQR({
      abonoPagado: {
        reference: ref,
        total: mismo && typeof guardado.total === 'number' ? guardado.total : null,
        id: mismo && typeof guardado.id === 'string' ? guardado.id : null,
        email: mismo && typeof guardado.email === 'string' ? guardado.email : null,
      },
    })
    irA('valorar')
  }
  leerRonda()
}

/** La mesa la fija la sección que resolvió el QR (useMesaQR). */
export function fijarMesa(mesa: MesaGuardada | null) {
  const anterior = estado.mesa?.mesa ?? null
  if ((mesa?.mesa ?? null) === anterior && mesa?.expira === estado.mesa?.expira) return
  let comensal = 'Yo'
  if (mesa) {
    try {
      comensal = sanearComensal(window.localStorage.getItem(claveComensal(mesa.mesa))) ?? 'Yo'
    } catch {
      comensal = 'Yo'
    }
  }
  setMesaQR({ mesa, comensal, pedido: mesa ? estado.pedido : null, cuenta: mesa ? estado.cuenta : null, rondasLocales: mesa ? leerRondasLocales(mesa.mesa) : [] })
  if (!mesa) {
    servidor = { pedido: null, cuenta: null }
  } else {
    // Otra mesa o la misma: lo de la base se vuelve a leer abajo.
  }
  if (mesa) {
    void refrescarMesa()
    if (!temporizador) {
      temporizador = setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine !== false) void refrescarMesa()
      }, 8000)
    }
  } else if (temporizador) {
    clearInterval(temporizador)
    temporizador = null
  }
}

export function fijarComensal(nombre: string) {
  const limpio = sanearComensal(nombre) ?? 'Yo'
  setMesaQR({ comensal: limpio })
  if (estado.mesa) {
    try {
      window.localStorage.setItem(claveComensal(estado.mesa.mesa), limpio)
    } catch {
      /* almacenamiento bloqueado: el nombre vale solo esta visita */
    }
  }
}

// ─── Navegación ──────────────────────────────────────────────────────────────────────────────

/** Estado del historial de un paso: de dónde se vino, para que ← vuelva con history.back(). */
interface EstadoHistorialPaso {
  pasoMesa?: PasoMesa
  pasoMesaDesde?: PasoMesa
}

function urlConPaso(paso: PasoMesa): string {
  const url = new URL(window.location.href)
  url.searchParams.set('paso', paso)
  url.hash = ''
  return url.pathname + url.search
}

/**
 * Arranca la Carta QR por pasos (la llama PasosMesa al montarse y cada vez que cambian las
 * secciones). El paso sale de `?paso=` (o del hash de una pantalla, enlaces viejos); uno que no
 * existe en la página cae en el de inicio y la URL se corrige sin entrada nueva en el historial.
 */
export function iniciarPasosMesa(disponibles: PasosDisponibles, lienzo: boolean) {
  if (typeof window === 'undefined') return
  const primera = estado.pasos === null
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash.replace(/^#/, '')
  const pedido = primera
    ? params.get('paso') ?? ((PANTALLAS as readonly string[]).includes(hash) ? hash : null) ?? (estado.pantalla || null)
    : estado.paso
  const paso = resolverPaso(pedido, disponibles.pasos)
  setMesaQR({ pasos: disponibles, paso, pasosEnLienzo: lienzo, pantalla: lienzo ? '' : pantallaDePaso(paso) })
  if (!primera || lienzo) return
  if (params.get('paso') !== paso || window.location.hash) {
    history.replaceState({ ...(history.state ?? {}), pasoMesa: paso }, '', urlConPaso(paso))
  }
  window.addEventListener('popstate', () => {
    if (!estado.pasos || estado.pasosEnLienzo) return
    const p = resolverPaso(new URLSearchParams(window.location.search).get('paso'), estado.pasos.pasos)
    if (p !== estado.paso) setMesaQR({ paso: p, pantalla: pantallaDePaso(p), confirmarAbierto: false, servicioAbierto: false })
  })
}

/** El lienzo del editor pide un paso (PreviewBridge → PasosMesa): sin historial ni URL. */
export function fijarPasoLienzo(paso: PasoMesa) {
  if (!estado.pasos) return
  setMesaQR({ paso: resolverPaso(paso, estado.pasos.pasos), pantalla: '' })
}

/**
 * Va a un paso de la Carta QR. Solo si existe en la página y la transición está permitida
 * (TRANSICIONES_MESA): si no, no hace nada y lo dice. Devuelve si fue.
 */
export function irAPaso(destino: PasoMesa, opciones: { reemplazar?: boolean } = {}): boolean {
  if (typeof window === 'undefined' || !estado.pasos || !estado.paso) return false
  const desde = estado.paso
  if (!puedeIrAPaso(desde, destino, estado.pasos.pasos)) {
    console.warn('[Carta QR] paso no permitido', { desde, destino })
    return false
  }
  if (estado.pasosEnLienzo) {
    setMesaQR({ paso: destino, pantalla: '' })
    return true
  }
  if (destino !== desde) {
    const st: EstadoHistorialPaso = { ...(history.state ?? {}), pasoMesa: destino, pasoMesaDesde: desde }
    if (opciones.reemplazar) history.replaceState(st, '', urlConPaso(destino))
    else history.pushState(st, '', urlConPaso(destino))
  } else {
    // Ya está en ese paso: nada que apilar en el historial.
  }
  setMesaQR({ paso: destino, pantalla: pantallaDePaso(destino) })
  return true
}

/**
 * ← atrás de una pantalla de la mesa. Por pasos: si se llegó desde el paso anterior, history.back()
 * (el botón atrás del celular y la flecha hacen lo mismo); si se entró directo (recarga, enlace),
 * se reemplaza por el paso anterior sin salir del sitio. Sin pasos, `sinPasos()`: lo de siempre.
 */
export function atrasMesa(sinPasos: () => void) {
  if (estado.pasos && estado.paso && !estado.pasosEnLienzo) {
    const destino = pasoAnterior(estado.paso, estado.pasos.pasos)
    const st = (history.state ?? {}) as EstadoHistorialPaso
    if (st.pasoMesaDesde === destino) history.back()
    else irAPaso(destino, { reemplazar: true })
  } else {
    sinPasos()
  }
}

export function irA(pantalla: PantallaMesa | PasoMesa, opciones: { reemplazar?: boolean } = {}) {
  if (typeof window === 'undefined') return
  if (estado.pasos && estado.paso) {
    // Carta QR por pasos: «''» (seguir pidiendo, volver a la carta) es el paso de la carta.
    irAPaso(pantalla === '' ? 'carta' : pantalla, opciones)
    return
  } else if (pantalla === 'bienvenida' || pantalla === 'carta' || pantalla === 'horario') {
    // Sin pasos no hay pantalla para esto: la carta y la portada están en la misma página.
    irA('')
    return
  }
  if (pantalla === '') {
    if (window.location.hash) {
      history.pushState(null, '', window.location.pathname + window.location.search)
    }
    setMesaQR({ pantalla: '' })
    return
  }
  if (window.location.hash !== `#${pantalla}`) window.location.hash = pantalla
  setMesaQR({ pantalla })
  window.scrollTo({ top: 0 })
}

export function mostrarAviso(aviso: AvisoMesa | null, ms = 6000) {
  setMesaQR({ aviso })
  if (aviso && ms > 0) {
    const actual = aviso
    setTimeout(() => {
      if (estado.aviso === actual) setMesaQR({ aviso: null })
    }, ms)
  }
}

// ─── Red ─────────────────────────────────────────────────────────────────────────────────────

function urlMesa(accion: string): string | null {
  return estado.mesa ? `/api/mesa/${encodeURIComponent(estado.mesa.mesa)}/${accion}` : null
}

async function postMesa(accion: string, cuerpo: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const url = urlMesa(accion)
  if (!url) return { ok: false, data: { motivo: 'MESA_INVALIDA' } }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok && data.ok !== false, data }
  } catch {
    setMesaQR({ sinConexion: typeof navigator !== 'undefined' && navigator.onLine === false })
    return { ok: false, data: { motivo: 'ERROR' } }
  }
}

export function mensajeMesa(motivo: unknown): string {
  return (typeof motivo === 'string' && MENSAJES_MESA[motivo]) || MENSAJES_MESA.ERROR
}

// ─── Lo que devolvió la base + las rondas de este celular ────────────────────────────────────

/** Último pedido y cuenta tal como los devolvió la base (sin las rondas locales encima). */
let servidor: { pedido: PedidoMesa | null; cuenta: CuentaMesa | null } = { pedido: null, cuenta: null }

function leerRondasLocales(mesaId: string): RondaLocal[] {
  try {
    return parseRondasLocales(JSON.parse(window.localStorage.getItem(claveRondasLocales(mesaId)) || '[]'))
  } catch {
    return []
  }
}

function guardarRondasLocales(locales: RondaLocal[]) {
  if (!estado.mesa) return
  try {
    window.localStorage.setItem(claveRondasLocales(estado.mesa.mesa), JSON.stringify(locales))
  } catch {
    /* sin almacenamiento: valen mientras la pestaña siga abierta */
  }
}

/** Publica pedido y cuenta con las rondas locales que la base aún no muestra. */
function recomponer(locales: RondaLocal[] = estado.rondasLocales) {
  const ahora = Date.now()
  const mesaPublica = servidor.pedido?.mesa ?? (estado.mesa
    ? { id: estado.mesa.mesa, nombre: estado.mesa.nombre || 'Tu mesa', zona: estado.mesa.zona ?? null, sedeId: estado.mesa.sede ?? null, sede: estado.mesa.nombreSede ?? null }
    : null)
  const p = fusionarRondasLocales(servidor.pedido, locales, mesaPublica, ahora)
  const c = servidor.cuenta ? fusionarRondasLocales(servidor.cuenta, locales, null, ahora) : null
  const vigentes = p.locales
  if (vigentes.length !== estado.rondasLocales.length || vigentes.some((l, i) => l !== estado.rondasLocales[i])) guardarRondasLocales(vigentes)
  setMesaQR({
    pedido: p.pedido,
    rondasLocales: vigentes,
    ...(c ? { cuenta: c.pedido as CuentaMesa } : {}),
  })
}

let enCurso: Promise<void> | null = null
let repetir = false
let repetirConCuenta = false

/**
 * Lee el pedido (o la cuenta) de la mesa. Si ya hay una lectura en curso, no se pierde la nueva:
 * se repite al terminar (tras enviar una ronda, el estado tiene que traerla, no la de hace 8 s).
 */
export function refrescarMesa(conCuenta = false): Promise<void> {
  if (!estado.mesa) return Promise.resolve()
  if (enCurso) {
    repetir = true
    repetirConCuenta = repetirConCuenta || conCuenta
    return enCurso
  }
  enCurso = (async () => {
    let cuenta = conCuenta
    try {
      do {
        repetir = false
        await leerMesaUnaVez(cuenta)
        cuenta = repetirConCuenta
        repetirConCuenta = false
      } while (repetir)
    } finally {
      enCurso = null
    }
  })()
  return enCurso
}

async function leerMesaUnaVez(conCuenta: boolean) {
  const mesa = estado.mesa
  if (!mesa) return
  try {
    const quiereCuenta = conCuenta || estado.pantalla === 'cuenta' || estado.pantalla === 'pagar' || estado.pantalla === 'valorar'
    const res = await fetch(urlMesa(quiereCuenta ? 'cuenta' : 'pedido')!, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (quiereCuenta) {
        const cuenta = parseCuentaMesa(data)
        if (cuenta) {
          servidor = { pedido: cuenta, cuenta }
          setMesaQR({ sinConexion: false })
          recomponer()
        }
      } else {
        const pedido = parsePedidoMesa(data)
        if (pedido) {
          servidor = { ...servidor, pedido }
          setMesaQR({ sinConexion: false })
          recomponer()
        }
      }
    } else {
      // 404 (mesa que ya no existe), 429 o 503: se conserva lo último que se vio.
    }
  } catch {
    setMesaQR({ sinConexion: typeof navigator !== 'undefined' && navigator.onLine === false })
  }
}

// ─── Ronda por enviar (carrito de la sede con el comensal de cada línea) ─────────────────────

interface LineaCarritoGuardada {
  id: number | string
  productId?: number
  name?: string
  price?: number | string
  quantity?: number | string
  imageUrl?: string | null
  newModifiers?: { name?: string }[]
  modifiers?: { valueName?: string }[]
  notes?: string | null
  diner?: string | null
}

function claveCarrito(): string | null {
  const sub = estado.subdomain || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '')
  return sub ? getCartKey(sub, estado.branchId) : null
}

export function leerRonda() {
  const clave = claveCarrito()
  if (!clave) return
  let lineas: LineaCarritoGuardada[] = []
  try {
    const v = JSON.parse(window.localStorage.getItem(clave) || '[]')
    lineas = Array.isArray(v) ? v : []
  } catch {
    lineas = []
  }
  setMesaQR({ ronda: aRonda(lineas) })
}

function aRonda(lineas: LineaCarritoGuardada[]): LineaRonda[] {
  return lineas.map((l) => ({
      id: l.id,
      productId: Number(l.productId ?? l.id),
      nombre: String(l.name ?? 'Producto'),
      precio: Number(l.price) || 0,
      cantidad: Number(l.quantity) || 1,
      modificadores: [
        ...(l.modifiers || []).map((m) => m.valueName || ''),
        ...(l.newModifiers || []).map((m) => m.name || ''),
      ].filter(Boolean),
      nota: l.notes || null,
      comensal: sanearComensal(l.diner) ?? 'Yo',
      imagen: l.imageUrl || null,
    }))
}

function escribirCarrito(lineas: LineaCarritoGuardada[]) {
  const clave = claveCarrito()
  if (!clave) return
  try {
    window.localStorage.setItem(clave, JSON.stringify(lineas))
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent('cart-updated'))
}

function leerCarritoCrudo(): LineaCarritoGuardada[] {
  const clave = claveCarrito()
  if (!clave) return []
  try {
    const v = JSON.parse(window.localStorage.getItem(clave) || '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** Quita una línea de la ronda («Cambiar» la deja en la carta para volver a elegir). */
export function quitarDeRonda(id: number | string) {
  escribirCarrito(leerCarritoCrudo().filter((l) => l.id !== id))
}

export function totalRonda(ronda: LineaRonda[]): number {
  return ronda.reduce((s, l) => s + l.precio * l.cantidad, 0)
}

/** Firma de la ronda por enviar (los platos del carrito con su comensal). */
export function firmaRondaActual(ronda: LineaRonda[] = estado.ronda): string {
  return firmaRonda(ronda)
}

/**
 * Clave de idempotencia de la ronda (`roundKey`): la misma mientras la ronda sea la misma y no se
 * haya confirmado su envío. Si la respuesta se pierde y el comensal reintenta, /api/orders
 * reconoce la clave y devuelve el pedido ya creado en vez de crear otro.
 */
function claveIdempotencia(mesaId: string, firma: string): string {
  const nueva = (): string =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 14)}`
  try {
    const guardada = JSON.parse(window.localStorage.getItem(claveRondaEnVuelo(mesaId)) || 'null') as { firma?: unknown; key?: unknown; creada?: unknown } | null
    if (guardada && guardada.firma === firma && typeof guardada.key === 'string' && typeof guardada.creada === 'number' && Date.now() - guardada.creada < 30 * 60 * 1000) {
      return guardada.key
    }
    const key = nueva()
    window.localStorage.setItem(claveRondaEnVuelo(mesaId), JSON.stringify({ firma, key, creada: Date.now() }))
    return key
  } catch {
    return nueva()
  }
}

function olvidarClaveIdempotencia(mesaId: string) {
  try {
    window.localStorage.removeItem(claveRondaEnVuelo(mesaId))
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Envía la ronda por enviar a la mesa: POST /api/orders con «Comer aquí», la mesa del QR, el
 * comensal de cada línea, sin correo y con su `roundKey`. El servidor recalcula precios,
 * impuestos y stock. Si esos mismos platos ya se enviaron y esperan confirmación, no se reenvían.
 */
export async function enviarRonda(): Promise<void> {
  const mesa = estado.mesa
  const crudo = leerCarritoCrudo()
  if (!mesa || crudo.length === 0 || estado.enviando) return
  const lineasRonda = aRonda(crudo)
  const firma = firmaRonda(lineasRonda)
  if (rondaPendienteIgual(firma, estado.rondasLocales, estado.pedido)) {
    // Doble envío de lo mismo: la ronda ya está con el equipo, se muestra su estado.
    setMesaQR({ confirmarAbierto: false })
    mostrarAviso({ tipo: 'info', titulo: 'Esa ronda ya la enviaste', texto: TEXTO_POR_CONFIRMAR })
    irA('estado')
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setMesaQR({ sinConexion: true, confirmarAbierto: false, errorEnvio: true })
    return
  }
  setMesaQR({ enviando: true, errorEnvio: false })
  const roundKey = claveIdempotencia(mesa.mesa, firma)
  const numero = (estado.pedido?.rondas.length ?? 0) + 1
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(estado.organizationId ? { organizationId: estado.organizationId } : {}),
        ...(typeof estado.branchId === 'number' ? { branchId: estado.branchId } : {}),
        customer: { firstName: estado.comensal || mesa.nombre || 'Mesa', lastName: '', email: '', phone: '' },
        items: crudo.map((l) => ({
          id: l.productId ?? l.id,
          lineId: l.id,
          name: l.name,
          price: l.price,
          quantity: l.quantity,
          ...(l.modifiers && l.modifiers.length > 0 ? { modifiers: l.modifiers } : {}),
          ...(l.newModifiers && l.newModifiers.length > 0 ? { newModifiers: l.newModifiers } : {}),
          ...(l.notes ? { notes: l.notes } : {}),
          diner: sanearComensal(l.diner) ?? estado.comensal,
        })),
        subtotal: crudo.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 1), 0),
        shipping: 0,
        total: crudo.reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.quantity) || 1), 0),
        paymentMethod: 'mesa',
        deliveryType: 'dine_in',
        tableRef: mesa.mesa,
        dinerLabel: estado.comensal,
        roundKey,
      }),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, any>
    if (res.status === 409 && Array.isArray(data.details)) {
      // Agotado (lámina 12): se quitan de la ronda los platos sin existencias. Nada se cobró.
      const nombres = (data.details as string[]).map((d) => String(d).split(' (')[0])
      const quedan = crudo.filter((l) => !nombres.includes(String(l.name)))
      escribirCarrito(quedan)
      setMesaQR({ enviando: false, confirmarAbierto: false })
      mostrarAviso({
        tipo: 'agotado',
        titulo: nombres.length === 1 ? `${nombres[0]} se agotó` : 'Algunos platos se agotaron',
        texto: 'Lo quitamos de tu ronda. Nada se cobró.',
        accion: { texto: 'Ver platos parecidos' },
      }, 9000)
      return
    }
    if (!res.ok || !data.success) {
      setMesaQR({ enviando: false, confirmarAbierto: false, errorEnvio: true })
      return
    }
    // Enviada: el carrito queda vacío y la ronda se sigue en el pedido de la mesa.
    try {
      const clave = claveRondasEnviadas(mesa.mesa)
      const previas = JSON.parse(window.localStorage.getItem(clave) || '[]')
      const lista = Array.isArray(previas) ? previas : []
      window.localStorage.setItem(clave, JSON.stringify([...lista, data.orderId].slice(-20)))
    } catch {
      /* sin almacenamiento */
    }
    olvidarClaveIdempotencia(mesa.mesa)
    escribirCarrito([])
    const ahora = new Date()
    // Se ve ya, con sus platos y su total, aunque la mesa no tenga sesión (lámina 06).
    if (typeof data.orderId === 'string' && !estado.rondasLocales.some((l) => l.clave === data.orderId)) {
      const items: LineaMesa[] = lineasRonda.map((l) => ({
        id: String(l.id), nombre: l.nombre, cantidad: l.cantidad, total: l.precio * l.cantidad,
        modificadores: l.modificadores, nota: l.nota, comensal: l.comensal, estado: 'por_confirmar', pagada: false,
      }))
      recomponer([...estado.rondasLocales, {
        clave: data.orderId, creada: ahora.toISOString(), comensal: estado.comensal, items,
        subtotal: items.reduce((s, l) => s + l.total, 0), firma,
      }])
    } else {
      // Reintento que /api/orders reconoció (misma roundKey): la ronda ya estaba registrada.
    }
    setMesaQR({
      enviando: false,
      confirmarAbierto: false,
      ultimaRonda: {
        numero,
        hora: ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
        platos: crudo.reduce((s, l) => s + (Number(l.quantity) || 1), 0),
        auto: data.rondaMesa?.auto === true,
      },
    })
    await refrescarMesa()
    irA('estado')
  } catch {
    setMesaQR({ enviando: false, confirmarAbierto: false, errorEnvio: true, sinConexion: typeof navigator !== 'undefined' && navigator.onLine === false })
  }
}

// ─── Servicio de mesa ────────────────────────────────────────────────────────────────────────

export async function llamarMesero(motivo: string, detalle: string, textoEnviado: string): Promise<boolean> {
  const { ok, data } = await postMesa('solicitar', { motivo, detalle, comensal: estado.comensal })
  if (!ok) {
    mostrarAviso({ tipo: 'error', titulo: 'No pudimos avisar al mesero', texto: mensajeMesa(data.motivo) })
    return false
  }
  const mesero = typeof data.mesero === 'string' && data.mesero ? data.mesero : null
  const hora = new Date(typeof data.created_at === 'string' ? data.created_at : Date.now())
    .toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  setMesaQR({ servicioAbierto: false })
  mostrarAviso({
    tipo: 'mesero',
    titulo: 'Avisamos al mesero',
    texto: `${textoEnviado.replace('{mesero}', mesero ?? 'El equipo')} · ${hora}`,
    solicitudId: typeof data.request_id === 'string' && data.status === 'open' ? data.request_id : undefined,
  }, 10000)
  void refrescarMesa()
  return true
}

export async function cancelarLlamado(solicitudId: string) {
  const { ok } = await postMesa('cancelar-solicitud', { solicitud: solicitudId })
  mostrarAviso(ok ? { tipo: 'info', titulo: 'Cancelamos el llamado' } : { tipo: 'error', titulo: 'El mesero ya va en camino' }, 4000)
  void refrescarMesa()
}

export async function pedirCuenta(detalle: string | null = null): Promise<boolean> {
  const { ok, data } = await postMesa('pedir-cuenta', { detalle, comensal: estado.comensal })
  if (!ok) {
    mostrarAviso({ tipo: 'error', titulo: 'No pudimos pedir la cuenta', texto: mensajeMesa(data.motivo) })
    return false
  }
  await refrescarMesa(true)
  return true
}

// ─── Pago en línea y valoración ──────────────────────────────────────────────────────────────

export async function pagarEnLinea(opciones: {
  modo: ModoDivision
  partes: number
  comensal: string | null
  propina: number
  monto: number
  email: string | null
  nombre: string | null
}): Promise<{ ok: true } | { ok: false; mensaje: string; monto?: number }> {
  const { ok, data } = await postMesa('abono', {
    modo: opciones.modo,
    partes: opciones.partes,
    comensal: opciones.comensal,
    propina: opciones.propina,
    monto: opciones.monto,
    email: opciones.email,
    nombre: opciones.nombre,
  })
  if (!ok) {
    void refrescarMesa(true)
    return { ok: false, mensaje: mensajeMesa(data.motivo), ...(typeof data.monto === 'number' ? { monto: data.monto } : {}) }
  }
  const pasarela = typeof data.pasarela === 'string' ? data.pasarela : 'wompi_co'
  try {
    const res = await fetch('/api/checkout/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gateway: pasarela,
        returnUrl: `${window.location.origin}${window.location.pathname}`,
        source: 'table_bill',
        sourceId: data.id,
      }),
    })
    const init = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string }
    if (!res.ok || !init.checkoutUrl) return { ok: false, mensaje: init.error || MENSAJES_MESA.ERROR }
    try {
      window.sessionStorage.setItem(CLAVE_ULTIMO_ABONO, JSON.stringify({
        id: data.id, reference: data.reference, total: data.total, email: opciones.email,
      }))
    } catch {
      /* sin almacenamiento: la vuelta muestra el agradecimiento sin el monto */
    }
    window.location.href = init.checkoutUrl
    return { ok: true }
  } catch {
    return { ok: false, mensaje: MENSAJES_MESA.ERROR }
  }
}

export async function valorarVisita(puntaje: number, aspectos: string[], comentario: string): Promise<boolean> {
  const { ok, data } = await postMesa('valorar', {
    puntaje,
    aspectos,
    comentario: comentario.trim() || null,
    comensal: estado.comensal,
  })
  if (!ok) mostrarAviso({ tipo: 'error', titulo: 'No pudimos guardar tu valoración', texto: mensajeMesa(data.motivo) })
  return ok
}
