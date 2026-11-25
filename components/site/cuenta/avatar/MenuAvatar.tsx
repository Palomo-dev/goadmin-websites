'use client'

/**
 * Menú del avatar de la cabecera (Figma «16 Sitio web» 3044:78726, aprobado 2026-11-24):
 * - Computador (≥ 768 px, pantalla 5): desplegable colgado del avatar. Cabecera con avatar de
 *   40 px, nombre (o correo) y correo; el pedido en curso con «Seguir» o «Pagar»; los accesos en
 *   filas con su cifra a la derecha («Faltan datos» como insignia ámbar en Mis datos); «Seguir un
 *   pedido», «Ayuda por WhatsApp» y «Cerrar sesión» al final, sin protagonismo.
 * - Celular (< 768 px, pantalla 6): hoja inferior con asa y X, los accesos en mosaico de 3
 *   columnas. Deslizar hacia abajo y el botón atrás del navegador la cierran.
 *
 * Radix Dialog en un portal al body (como AccesoCuenta): Esc y tocar fuera cierran, el foco va al
 * primer enlace y vuelve al avatar. Mientras está abierto se esconde el chat flotante
 * (`data-cuenta-abierta`). Las cifras se piden al abrir (`cargarMenuAvatar`).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import Link from '@/components/site/Enlace'
import { useRouter } from 'next/navigation'
import * as Dialogo from '@radix-ui/react-dialog'
import { ChevronRight, LogOut, MessageCircle, Route, Truck, X } from 'lucide-react'
import {
  detalleAcceso,
  detalleMosaico,
  itemsMenuAvatar,
  vendeConPedidos,
  type IdentidadCuenta,
  type ItemMenuCuenta,
} from '@/lib/cuenta/reglasCuenta'
import { enlaceWhatsapp } from '@/lib/website/ajustesSitio'
import { fijarAccesoAbierto } from '../eventos'
import { ICONOS_CUENTA } from '../iconosCuenta'
import { cerrarSesionTienda } from '../useAcceso'
import { AvatarCuenta } from './AvatarCuenta'
import { cargarMenuAvatar, olvidarAvatar, useAvatarCuenta } from './datosAvatar'

/** Ancho del celular del sitio (Tailwind `md`): por debajo, hoja inferior. */
const CONSULTA_CELULAR = '(max-width: 767px)'

/** Sin saber el negocio (no llegaron los datos), al menos la entrada a Mi cuenta. */
const RESPALDO: ItemMenuCuenta[] = [{ clave: 'inicio', texto: 'Mi cuenta', href: '/mi-cuenta' }]

/** Fuente y color del tema: en el body ya no se heredan de la raíz del sitio (como AccesoCuenta). */
function estiloDelSitio(primaryColor: string | null | undefined): CSSProperties {
  const raiz = document.querySelector<HTMLElement>('[data-raiz-sitio]')
  const calculado = raiz ? window.getComputedStyle(raiz) : null
  const color = primaryColor || calculado?.getPropertyValue('--primary-color').trim() || ''
  const fuente = calculado?.fontFamily
  return { ...(color ? { ['--primary-color' as string]: color } : {}), ...(fuente ? { fontFamily: fuente } : {}) } as CSSProperties
}

/** Enlace `wa.me` si el número tiene dígitos suficientes; si no, null (no se pinta la fila). */
function enlaceAyuda(numero: string | null | undefined): string | null {
  const n = (numero ?? '').trim()
  return n.replace(/\D/g, '').length >= 7 ? enlaceWhatsapp({ numero: n, saludo: null }) : null
}

export interface MenuAvatarProps {
  /** El botón del avatar: el desplegable se cuelga de él y el foco vuelve a él. */
  origen: HTMLElement | null
  primaryColor?: string | null
  whatsapp?: string | null
  /**
   * `auto` (cabecera): hoja por debajo de 768 px y desplegable por encima. `hoja` (menús
   * inferiores): siempre la hoja, aunque el sitio muestre el menú inferior en pantallas más anchas.
   */
  formato?: 'auto' | 'hoja'
  onCerrar: () => void
}

export function MenuAvatar({ origen, primaryColor, whatsapp, formato = 'auto', onCerrar }: MenuAvatarProps) {
  const router = useRouter()
  const { datos, menu, cargandoMenu, correoSesion, inicialesProvisionales } = useAvatarCuenta()
  const [{ hoja, posicion }] = useState(() => {
    const celular = formato === 'hoja' || window.matchMedia(CONSULTA_CELULAR).matches
    const r = origen?.getBoundingClientRect()
    return {
      hoja: celular,
      posicion: r ? { top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) } : { top: 64, right: 16 },
    }
  })
  const [arrastre, setArrastre] = useState(0)
  const [saliendo, setSaliendo] = useState(false)
  const inicioToque = useRef<number | null>(null)
  const conHistorial = useRef(false)
  const estilo = useMemo(() => estiloDelSitio(primaryColor), [primaryColor])

  /** Cierra. `porNavegacion`: un enlace ya lleva a otra página (no se retrocede el historial). */
  const cerrar = useCallback(
    (porNavegacion = false) => {
      if (conHistorial.current) {
        conHistorial.current = false
        if (!porNavegacion && (window.history.state as Record<string, unknown> | null)?.menuAvatar) window.history.back()
      }
      onCerrar()
    },
    [onCerrar],
  )

  useEffect(() => {
    void cargarMenuAvatar()
  }, [])

  // Chat flotante escondido y estado compartido mientras está abierto (como AccesoCuenta).
  useEffect(() => {
    fijarAccesoAbierto(true)
    const raiz = document.documentElement
    raiz.setAttribute('data-cuenta-abierta', '')
    return () => {
      fijarAccesoAbierto(false)
      raiz.removeAttribute('data-cuenta-abierta')
    }
  }, [])

  // Celular: el botón atrás cierra la hoja (una entrada más con el mismo estado de Next).
  useEffect(() => {
    if (!hoja) return
    if (!conHistorial.current) {
      window.history.pushState({ ...((window.history.state as object | null) ?? {}), menuAvatar: true }, '')
      conHistorial.current = true
    }
    const alVolver = () => {
      if ((window.history.state as Record<string, unknown> | null)?.menuAvatar) return
      conHistorial.current = false
      onCerrar()
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [hoja, onCerrar])

  const salir = useCallback(async () => {
    setSaliendo(true)
    await cerrarSesionTienda()
    olvidarAvatar()
    cerrar()
    if (window.location.pathname.startsWith('/mi-cuenta')) window.location.href = '/'
    else router.refresh()
  }, [cerrar, router])

  // Lo del menú (con cifras) o, mientras llega, lo del avatar.
  const fuente = menu ?? datos
  const identidad: IdentidadCuenta = fuente?.identidad ?? {
    nombre: null,
    titulo: correoSesion || 'Mi cuenta',
    iniciales: inicialesProvisionales || '?',
    correo: correoSesion,
  }
  const tipo = fuente ? fuente.tipo : null
  const items = tipo === null ? (cargandoMenu ? [] : RESPALDO) : itemsMenuAvatar(tipo)
  const enCurso = fuente?.enCurso ?? null
  const ayuda = enlaceAyuda(whatsapp)
  const conSeguir = tipo !== null && vendeConPedidos(tipo)
  const navegar = () => cerrar(true)

  const tarjetaPedido = enCurso ? (
    <Link
      href={enCurso.ruta}
      onClick={navegar}
      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
      data-pedido-en-curso=""
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 12%, white)' }} aria-hidden="true">
        <Truck className="h-4 w-4" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <span className="truncate text-[13px] font-semibold text-slate-900">
          {enCurso.numero} · {enCurso.insignia}
        </span>
        {enCurso.titulo && <span className="text-xs text-slate-500">{enCurso.titulo}</span>}
      </span>
      <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--primary-color)' }}>
        {enCurso.accion === 'pagar' ? 'Pagar' : 'Seguir'}
      </span>
    </Link>
  ) : null

  const claseFila = 'flex items-center gap-3 rounded-lg px-3 text-sm text-slate-900 transition-colors hover:bg-slate-50'
  const filasAyuda = (conFlecha: boolean, alto: string) =>
    conSeguir || ayuda ? (
      <>
        <hr className="my-1 border-slate-200" />
        {conSeguir && (
          <Link href="/consultar-pedido" onClick={navegar} className={`${claseFila} ${alto}`}>
            <Route aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-slate-600" strokeWidth={1.75} />
            <span className="flex-1">Seguir un pedido</span>
            {conFlecha && <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />}
          </Link>
        )}
        {ayuda && (
          <a href={ayuda} target="_blank" rel="noopener noreferrer" onClick={navegar} className={`${claseFila} ${alto}`}>
            <MessageCircle aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-slate-600" strokeWidth={1.75} />
            <span className="flex-1">Ayuda por WhatsApp</span>
            {conFlecha && <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />}
          </a>
        )}
      </>
    ) : null
  const filaSalir = (
    <>
      <hr className="my-1 border-slate-200" />
      <button type="button" onClick={() => void salir()} disabled={saliendo} className={`${claseFila} py-2.5 text-left text-slate-600 disabled:opacity-60`}>
        <LogOut aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
        {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
    </>
  )
  const cargando = cargandoMenu && items.length === 0

  const quien = (
    <span className="flex min-w-0 flex-1 flex-col leading-snug">
      <Dialogo.Title className="truncate text-[15px] font-semibold text-slate-900">{identidad.titulo}</Dialogo.Title>
      {identidad.nombre && identidad.correo && <span className="truncate text-[13px] text-slate-500">{identidad.correo}</span>}
    </span>
  )

  const contenidoEscritorio = (
    <div className="flex flex-col gap-1" data-menu-avatar="">
      <div className="flex items-center gap-3 px-3 pb-2 pt-3">
        <AvatarCuenta iniciales={identidad.iniciales} primaryColor={primaryColor} tam={40} />
        {quien}
      </div>
      {tarjetaPedido}
      <hr className="my-1 border-slate-200" />
      {cargando && <Esqueleto filas={4} />}
      <nav aria-label="Mi cuenta" className="flex flex-col">
        {items.map((it) => {
          const Icono = ICONOS_CUENTA[it.clave]
          const fila = menu ? detalleAcceso(it.clave, menu.cifras, { nombre: identidad.nombre, telefono: menu.telefono, facturaCompleta: menu.facturaCompleta }) : null
          // «Faltan datos» en Mis datos: los de factura, igual que el mosaico del celular.
          const aviso = fila?.aviso ?? (menu && it.clave === 'datos' && detalleMosaico('datos', menu.cifras, menu).aviso ? 'Faltan datos' : null)
          return (
            <Link key={it.clave} href={it.href} onClick={navegar} className={`${claseFila} py-2.5`}>
              <Icono aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-slate-600" strokeWidth={1.75} />
              <span className="flex-1">{it.texto}</span>
              {aviso ? (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{aviso}</span>
              ) : fila?.cifra ? (
                <span className="text-[13px] text-slate-500">{fila.cifra}</span>
              ) : null}
            </Link>
          )
        })}
      </nav>
      {filasAyuda(false, 'py-2.5')}
      {filaSalir}
    </div>
  )

  const contenidoCelular = (
    <div className="flex flex-col gap-3" data-menu-avatar="">
      {tarjetaPedido}
      {cargando && <Esqueleto filas={2} />}
      <nav aria-label="Mi cuenta" className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const Icono = ICONOS_CUENTA[it.clave]
          const linea = menu ? detalleMosaico(it.clave, menu.cifras, menu) : null
          return (
            <Link
              key={it.clave}
              href={it.href}
              onClick={navegar}
              className="flex min-h-[84px] flex-col gap-1.5 rounded-xl border border-slate-200 bg-white p-3 transition-colors active:bg-slate-50"
            >
              <Icono aria-hidden="true" className="h-5 w-5 shrink-0" style={{ color: 'var(--primary-color)' }} strokeWidth={1.75} />
              <span className="text-[13px] font-semibold leading-tight text-slate-900">{it.texto}</span>
              {linea ? (
                <span className={`text-xs leading-tight ${linea.aviso ? 'text-amber-700' : 'text-slate-500'}`}>{linea.texto}</span>
              ) : (
                <span aria-hidden="true" className="h-3 w-12 rounded bg-slate-100" />
              )}
            </Link>
          )
        })}
      </nav>
      <div className="flex flex-col">
        {filasAyuda(true, 'py-3.5')}
        {filaSalir}
      </div>
    </div>
  )

  const estiloContenido: CSSProperties = {
    zIndex: 2147483647,
    ...(hoja ? (arrastre > 0 ? { transform: `translateY(${arrastre}px)` } : {}) : { top: posicion.top, right: posicion.right, maxHeight: `calc(100dvh - ${posicion.top + 8}px)` }),
  }

  return (
    <Dialogo.Root
      open
      onOpenChange={(v) => {
        if (!v) cerrar()
      }}
    >
      <Dialogo.Portal>
        <div data-menu-avatar-formato={hoja ? 'hoja' : 'ventana'} style={estilo}>
          <Dialogo.Overlay className={hoja ? 'fixed inset-0 bg-black/50 backdrop-blur-[1px]' : 'fixed inset-0'} style={{ zIndex: 2147483646 }} />
          <Dialogo.Content
            aria-describedby={undefined}
            className={
              hoja
                ? 'fixed inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col rounded-t-[20px] bg-white pb-[env(safe-area-inset-bottom)] text-[#111827] shadow-2xl outline-none animate-in slide-in-from-bottom duration-200'
                : 'fixed flex w-[320px] flex-col overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 text-[#111827] shadow-xl outline-none animate-in fade-in slide-in-from-top-1 duration-150'
            }
            style={estiloContenido}
            data-superficie-propia=""
            onOpenAutoFocus={(e) => {
              // El foco va al primer enlace del menú, no a la X.
              e.preventDefault()
              const contenido = e.currentTarget as HTMLElement | null
              contenido?.querySelector<HTMLElement>('[data-menu-avatar] a, [data-menu-avatar] button')?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(e) => {
              if (!origen || !origen.isConnected) return
              e.preventDefault()
              origen.focus({ preventScroll: true })
            }}
          >
            {hoja ? (
              <>
                <div
                  className="shrink-0"
                  onTouchStart={(e) => {
                    inicioToque.current = e.touches[0].clientY
                  }}
                  onTouchMove={(e) => {
                    if (inicioToque.current !== null) setArrastre(Math.max(0, e.touches[0].clientY - inicioToque.current))
                  }}
                  onTouchEnd={() => {
                    // Deslizar hacia abajo cierra la hoja.
                    if (inicioToque.current !== null && arrastre > 80) cerrar()
                    else setArrastre(0)
                    inicioToque.current = null
                  }}
                >
                  <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-slate-300" />
                  <div className="flex items-center gap-3 px-4 pb-3 pt-4">
                    <AvatarCuenta iniciales={identidad.iniciales} primaryColor={primaryColor} tam={40} />
                    {quien}
                    <Dialogo.Close aria-label="Cerrar" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200">
                      <X aria-hidden="true" className="h-4 w-4 text-slate-600" />
                    </Dialogo.Close>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{contenidoCelular}</div>
              </>
            ) : (
              contenidoEscritorio
            )}
          </Dialogo.Content>
        </div>
      </Dialogo.Portal>
    </Dialogo.Root>
  )
}

function Esqueleto({ filas }: { filas: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 px-3 py-1">
      {Array.from({ length: filas }, (_, i) => (
        <span key={i} className="h-5 animate-pulse rounded bg-slate-100" />
      ))}
    </div>
  )
}
