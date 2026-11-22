'use client'

/**
 * Favoritos en el navegador: UNA sola copia para toda la página (antes cada tarjeta pedía
 * /api/favorites por su cuenta). Lo leen el corazón de las tarjetas, el de la cabecera (contador),
 * el panel lateral y la página /favoritos con `useFavoritos()`.
 *
 * - Sin sesión: `localStorage` (`guest_favorites` + `guest_favorites_meta`, lib/favoritos/logica.ts).
 * - Con sesión: la cuenta (/api/favorites). Al detectar la sesión, si el dispositivo tenía
 *   favoritos se juntan con los de la cuenta (sin duplicar) y la copia local se borra.
 * - Cada cambio avisa con el evento `favoritos-aviso` (Agregado / Quitado · Deshacer).
 */
import { useSyncExternalStore } from 'react'
import {
  CLAVE_DISPOSITIVO,
  CLAVE_DISPOSITIVO_META,
  alternarFavorito,
  claveFavorito,
  escribirDispositivo,
  favoritoValido,
  leerDispositivo,
  ordenarPorFecha,
  sinRepetidos,
  type FavoritoGuardado,
} from './logica'

export interface EstadoFavoritos {
  /** Ya se sabe si hay sesión y qué hay guardado. */
  listo: boolean
  sesion: boolean
  items: FavoritoGuardado[]
}

export interface DetalleAvisoFavorito {
  tipo: 'agregado' | 'quitado' | 'error'
  item: FavoritoGuardado
}

export const EVENTO_AVISO_FAVORITOS = 'favoritos-aviso'
export const EVENTO_ABRIR_FAVORITOS = 'abrir-favoritos'

const INICIAL: EstadoFavoritos = { listo: false, sesion: false, items: [] }
let estado: EstadoFavoritos = INICIAL
const oyentes = new Set<() => void>()
let iniciado = false

function fijar(siguiente: Partial<EstadoFavoritos>) {
  estado = { ...estado, ...siguiente }
  oyentes.forEach((f) => f())
}

function leerLocal(): FavoritoGuardado[] {
  try {
    return ordenarPorFecha(leerDispositivo(JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) || '[]'), JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO_META) || '{}')))
  } catch {
    return []
  }
}

function escribirLocal(items: FavoritoGuardado[]) {
  try {
    if (items.length === 0) {
      localStorage.removeItem(CLAVE_DISPOSITIVO)
      localStorage.removeItem(CLAVE_DISPOSITIVO_META)
      return
    }
    // El orden de `guest_favorites` es el de agregado (el último, el más reciente), como siempre.
    const { ids, meta } = escribirDispositivo([...items].reverse())
    localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(ids))
    localStorage.setItem(CLAVE_DISPOSITIVO_META, JSON.stringify(meta))
  } catch {
    // Almacenamiento lleno o bloqueado: el favorito queda solo en esta pestaña.
  }
}

async function pedir(metodo: 'GET' | 'POST', cuerpo?: unknown): Promise<{ sesion?: boolean; favoritos?: unknown[] } | null> {
  try {
    const r = await fetch('/api/favorites', {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: 'no-store',
    })
    if (!r.ok) return null
    return (await r.json()) as { sesion?: boolean; favoritos?: unknown[] }
  } catch {
    return null
  }
}

const validos = (lista: unknown[] | undefined): FavoritoGuardado[] =>
  sinRepetidos((lista ?? []).map((v) => favoritoValido(v)).filter((f): f is FavoritoGuardado => f !== null))

/** Carga (una vez por página): sesión, cuenta y, si hace falta, junta lo del dispositivo. */
export async function iniciarFavoritos(forzar = false): Promise<void> {
  if (typeof window === 'undefined' || (iniciado && !forzar)) return
  iniciado = true
  const locales = leerLocal()
  // Lo del dispositivo se ve de inmediato; la cuenta llega después.
  if (!estado.listo) fijar({ items: locales })
  const r = await pedir('GET')
  if (!r?.sesion) {
    fijar({ listo: true, sesion: false, items: leerLocal() })
    return
  }
  let items = validos(r.favoritos)
  if (locales.length > 0) {
    const juntos = await pedir('POST', { action: 'juntar', items: locales })
    if (juntos?.favoritos) {
      items = validos(juntos.favoritos)
      escribirLocal([])
    }
  }
  fijar({ listo: true, sesion: true, items })
}

function suscribir(f: () => void) {
  oyentes.add(f)
  if (oyentes.size === 1 && typeof window !== 'undefined') {
    void iniciarFavoritos()
    window.addEventListener('storage', alCambiarOtraPestana)
  }
  return () => {
    oyentes.delete(f)
  }
}

function alCambiarOtraPestana(e: StorageEvent) {
  if (estado.sesion || (e.key !== CLAVE_DISPOSITIVO && e.key !== CLAVE_DISPOSITIVO_META)) return
  fijar({ items: leerLocal() })
}

function avisar(detalle: DetalleAvisoFavorito) {
  window.dispatchEvent(new CustomEvent<DetalleAvisoFavorito>(EVENTO_AVISO_FAVORITOS, { detail: detalle }))
}

/**
 * Agrega o quita (actualización optimista). `precio` es el que ve el visitante: con sesión el
 * servidor guarda el vigente; sin sesión, este (para «Bajó de precio»).
 */
export async function alternarFavoritoTienda(productId: number, opciones: { precio?: number | null; variantId?: number | null; silencioso?: boolean } = {}): Promise<boolean> {
  const item: FavoritoGuardado = {
    productId,
    variantId: opciones.variantId ?? null,
    guardadoEn: new Date().toISOString(),
    precioAlGuardar: opciones.precio ?? null,
  }
  const previo = estado.items
  const { lista, agregado } = alternarFavorito(previo, item)
  const original = previo.find((x) => claveFavorito(x) === claveFavorito(item)) ?? item
  fijar({ items: lista })
  if (estado.sesion) {
    const r = await pedir('POST', { productId, variantId: item.variantId, action: agregado ? 'add' : 'remove' })
    if (!r) {
      fijar({ items: previo })
      if (!opciones.silencioso) avisar({ tipo: 'error', item })
      return !agregado
    }
  } else {
    escribirLocal(lista)
  }
  if (!opciones.silencioso) avisar({ tipo: agregado ? 'agregado' : 'quitado', item: agregado ? item : original })
  return agregado
}

/** «Deshacer» de «Quitado de favoritos»: vuelve con su fecha y su precio al guardar. */
export async function restaurarFavorito(item: FavoritoGuardado): Promise<void> {
  if (estado.items.some((x) => claveFavorito(x) === claveFavorito(item))) return
  const lista = sinRepetidos([item, ...estado.items])
  fijar({ items: lista })
  if (estado.sesion) {
    const r = await pedir('POST', { productId: item.productId, variantId: item.variantId, action: 'add' })
    if (!r) fijar({ items: lista.filter((x) => claveFavorito(x) !== claveFavorito(item)) })
  } else {
    escribirLocal(lista)
  }
}

export function leerFavoritos(): EstadoFavoritos {
  return estado
}

export function useFavoritos(): EstadoFavoritos {
  return useSyncExternalStore(suscribir, leerFavoritos, () => INICIAL)
}

/** Abre el panel lateral de favoritos (lo escucha OrganizationLayoutCliente). */
export function abrirPanelFavoritos() {
  window.dispatchEvent(new Event(EVENTO_ABRIR_FAVORITOS))
}

/** Solo para pruebas: vuelve al estado inicial. */
export function reiniciarFavoritosParaPruebas() {
  estado = INICIAL
  iniciado = false
}
