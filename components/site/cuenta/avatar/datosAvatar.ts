'use client'

/**
 * Datos del avatar de la cabecera y de su menú (Figma «16 Sitio web» 3044:78726, pantallas 4–6).
 *
 * Un solo almacén para todas las cabeceras montadas (escritorio y celular): escucha la sesión de
 * Supabase una vez y, SOLO con sesión, pide `/api/cuenta/menu?parte=avatar` (nombre de la ficha
 * de la organización, iniciales y pedido en curso). La respuesta se guarda en `sessionStorage` por
 * usuario unos minutos: navegar entre páginas no vuelve a consultar. Los visitantes sin sesión no
 * hacen ninguna petición. Las cifras del menú (`parte=menu`) se piden al abrirlo.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { iniciales as inicialesDe, type CifrasCuenta, type IdentidadCuenta } from '@/lib/cuenta/reglasCuenta'
import type { PedidoEnCursoAvatar } from '@/lib/cuenta/cuentaCliente'

export interface DatosAvatar {
  usuario: string
  tipo: number
  identidad: IdentidadCuenta
  enCurso: PedidoEnCursoAvatar | null
}

export interface DatosMenuAvatar extends DatosAvatar {
  cifras: CifrasCuenta | null
  facturaCompleta: boolean
  telefono: string | null
}

export interface EstadoAvatar {
  /** null mientras no se sabe si hay sesión. */
  sesion: boolean | null
  usuario: string | null
  /** Iniciales mientras llegan los datos (las del nombre de la sesión o del correo). */
  inicialesProvisionales: string
  correoSesion: string | null
  datos: DatosAvatar | null
  menu: DatosMenuAvatar | null
  cargandoMenu: boolean
}

/** Minutos que vale lo guardado del avatar y del menú. */
const VIGENCIA_AVATAR_MS = 5 * 60_000
const VIGENCIA_MENU_MS = 2 * 60_000
const CLAVE = (usuario: string, parte: 'avatar' | 'menu') => `go:cuenta-${parte}:${usuario}`

let estado: EstadoAvatar = { sesion: null, usuario: null, inicialesProvisionales: '', correoSesion: null, datos: null, menu: null, cargandoMenu: false }
const oyentes = new Set<() => void>()
let iniciado = false
let pidiendoAvatar: Promise<void> | null = null
let pidiendoMenu: Promise<void> | null = null

function fijar(cambios: Partial<EstadoAvatar>) {
  estado = { ...estado, ...cambios }
  oyentes.forEach((f) => f())
}

function leerGuardado<T>(clave: string, vigencia: number): T | null {
  try {
    const crudo = window.sessionStorage.getItem(clave)
    if (!crudo) return null
    const v = JSON.parse(crudo) as { t: number; d: T }
    return typeof v?.t === 'number' && Date.now() - v.t < vigencia ? v.d : null
  } catch {
    return null
  }
}

function guardar(clave: string, d: unknown) {
  try {
    window.sessionStorage.setItem(clave, JSON.stringify({ t: Date.now(), d }))
  } catch {
    /* sin almacenamiento: se vuelve a pedir la próxima vez */
  }
}

function borrarGuardado(usuario: string | null) {
  if (!usuario) return
  try {
    window.sessionStorage.removeItem(CLAVE(usuario, 'avatar'))
    window.sessionStorage.removeItem(CLAVE(usuario, 'menu'))
  } catch {
    /* nada */
  }
}

async function pedir(parte: 'avatar' | 'menu'): Promise<(DatosMenuAvatar & { sesion?: boolean }) | null> {
  try {
    const r = await fetch(`/api/cuenta/menu?parte=${parte}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return j?.sesion ? j : null
  } catch {
    return null
  }
}

function cargarAvatar(usuario: string) {
  const guardado = leerGuardado<DatosAvatar>(CLAVE(usuario, 'avatar'), VIGENCIA_AVATAR_MS)
  if (guardado && guardado.usuario === usuario) {
    fijar({ datos: guardado })
    return
  }
  if (pidiendoAvatar) return
  pidiendoAvatar = pedir('avatar').then((j) => {
    pidiendoAvatar = null
    if (!j || j.usuario !== usuario || estado.usuario !== usuario) return
    const d: DatosAvatar = { usuario: j.usuario, tipo: j.tipo, identidad: j.identidad, enCurso: j.enCurso ?? null }
    guardar(CLAVE(usuario, 'avatar'), d)
    fijar({ datos: d })
  })
}

function alCambiarSesion(s: { user?: { id: string; email?: string | null; user_metadata?: Record<string, unknown> } } | null) {
  const user = s?.user ?? null
  if (!user) {
    borrarGuardado(estado.usuario)
    fijar({ sesion: false, usuario: null, inicialesProvisionales: '', correoSesion: null, datos: null, menu: null })
    return
  }
  const meta = user.user_metadata ?? {}
  const nombre = typeof meta.first_name === 'string' ? [meta.first_name, typeof meta.last_name === 'string' ? meta.last_name : ''].join(' ').trim() : null
  if (estado.usuario !== user.id) fijar({ datos: null, menu: null })
  fijar({ sesion: true, usuario: user.id, correoSesion: user.email ?? null, inicialesProvisionales: inicialesDe(nombre || null, user.email ?? null) })
  cargarAvatar(user.id)
}

function iniciar() {
  if (iniciado || typeof window === 'undefined') return
  iniciado = true
  const supabase = createClient()
  supabase.auth.getSession().then(({ data }) => alCambiarSesion(data.session))
  supabase.auth.onAuthStateChange((_e, s) => alCambiarSesion(s))
}

function suscribir(f: () => void) {
  oyentes.add(f)
  return () => {
    oyentes.delete(f)
  }
}

const SERVIDOR: EstadoAvatar = { sesion: null, usuario: null, inicialesProvisionales: '', correoSesion: null, datos: null, menu: null, cargandoMenu: false }

/** Estado del avatar (sesión, iniciales, pedido en curso). Monta la escucha de la sesión una vez. */
export function useAvatarCuenta(): EstadoAvatar {
  useEffect(() => {
    iniciar()
  }, [])
  return useSyncExternalStore(suscribir, () => estado, () => SERVIDOR)
}

/** Pide las cifras del menú (al abrirlo). Usa lo guardado si es reciente. */
export function cargarMenuAvatar(): Promise<void> {
  const usuario = estado.usuario
  if (!usuario) return Promise.resolve()
  const guardado = leerGuardado<DatosMenuAvatar>(CLAVE(usuario, 'menu'), VIGENCIA_MENU_MS)
  if (guardado && guardado.usuario === usuario) {
    fijar({ menu: guardado })
    return Promise.resolve()
  }
  if (pidiendoMenu) return pidiendoMenu
  fijar({ cargandoMenu: true })
  pidiendoMenu = pedir('menu').then((j) => {
    pidiendoMenu = null
    if (!j || j.usuario !== usuario || estado.usuario !== usuario) {
      fijar({ cargandoMenu: false })
      return
    }
    const m: DatosMenuAvatar = {
      usuario: j.usuario,
      tipo: j.tipo,
      identidad: j.identidad,
      enCurso: j.enCurso ?? null,
      cifras: j.cifras ?? null,
      facturaCompleta: !!j.facturaCompleta,
      telefono: j.telefono ?? null,
    }
    const d: DatosAvatar = { usuario: m.usuario, tipo: m.tipo, identidad: m.identidad, enCurso: m.enCurso }
    guardar(CLAVE(usuario, 'menu'), m)
    guardar(CLAVE(usuario, 'avatar'), d)
    fijar({ menu: m, datos: d, cargandoMenu: false })
  })
  return pidiendoMenu
}

/**
 * Mi cuenta ya leyó la ficha en el servidor: deja ese nombre en el avatar (así un cambio en Mis
 * datos se ve en la cabecera sin esperar a que venza lo guardado) y olvida las cifras viejas.
 */
export function sembrarIdentidadAvatar(usuario: string, identidad: IdentidadCuenta) {
  if (typeof window === 'undefined') return
  const actual = leerGuardado<DatosAvatar>(CLAVE(usuario, 'avatar'), VIGENCIA_AVATAR_MS)
  try {
    window.sessionStorage.removeItem(CLAVE(usuario, 'menu'))
  } catch {
    /* nada */
  }
  if (!actual || actual.usuario !== usuario) return
  const d: DatosAvatar = { ...actual, identidad }
  guardar(CLAVE(usuario, 'avatar'), d)
  if (estado.usuario === usuario) fijar({ datos: d, menu: null })
}

/** Olvida todo lo guardado (al cerrar sesión). */
export function olvidarAvatar() {
  borrarGuardado(estado.usuario)
  fijar({ datos: null, menu: null })
}
