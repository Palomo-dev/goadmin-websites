'use client'

/**
 * Acceso a la cuenta desde el ícono de la cabecera (Figma «16 Sitio web» 2834:68670, aprobado el
 * 2026-11-22). Modo del editor (`header_cuenta.modo`, lib/website/v2/cabeceraTienda.ts):
 * - `pagina` (sin valor, lo de hoy): el ícono es un enlace a /auth o a /mi-cuenta. Aquí no se pinta nada.
 * - `panel` (M2), `ventana` colgada del ícono, sin beneficios (M3, V1), `dialogo` con pestañas (M4).
 * - En el celular, cualquiera de esos tres es una hoja inferior (C1–C4); la fila «Iniciar sesión»
 *   del menú abre la misma hoja.
 * Con sesión, el mismo formato muestra el menú de cuenta (A1, A2, C4): Hola {nombre}, Mis pedidos,
 * Favoritos, Direcciones y Cerrar sesión.
 *
 * Un solo AccesoCuenta montado en el layout escucha `abrir-acceso-cuenta` (eventos.ts). Va en un
 * portal al `document.body` (Radix Dialog, como HojaMonedas) para no quedar atrapado en la
 * cabecera: foco atrapado, Escape cierra y el foco vuelve al ícono. Mientras está abierto se
 * esconde el chat flotante (`data-cuenta-abierta`, app/globals.css).
 *
 * Reglas (2840:70345): el carrito y lo escrito en el pago no se pierden (sin recargar: se refresca
 * la página en su lugar), los favoritos sin sesión se juntan con los de la cuenta
 * (iniciarFavoritos(true) → juntarEnCuenta) y el error de ingreso no dice qué falló.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Link from '@/components/site/Enlace'
import { useRouter } from 'next/navigation'
import * as Dialogo from '@radix-ui/react-dialog'
import { ArrowLeft, ChevronRight, Heart, LogOut, MapPin, Package, User, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { iniciarFavoritos, useFavoritos } from '@/lib/favoritos/almacen'
import {
  MENU_CUENTA,
  destinoVistaAcceso,
  rutaAcceso,
  saludoCuenta,
  type ModoCuenta,
  type OpcionesCuenta,
  type VistaAcceso,
} from '@/lib/website/v2/cabeceraTienda'
import { EVENTO_ABRIR_ACCESO, abrirAccesoCuenta, fijarAccesoAbierto, registrarAnfitrionAcceso, useAccesoAbierto, type DetalleAbrirAcceso } from './eventos'
import { FormularioAcceso, tituloVista, type VistaFormulario } from './FormularioAcceso'
import { cerrarSesionTienda, type TipoEntrada } from './useAcceso'
import { BotonAvatarCuenta } from './avatar/BotonAvatarCuenta'

/** Formato en pantalla: el del editor o, en el celular, la hoja inferior. */
export type FormatoAcceso = Exclude<ModoCuenta, 'pagina'> | 'hoja'

/** Ancho del celular del sitio (Tailwind `md`): por debajo, hoja inferior. */
const CONSULTA_CELULAR = '(max-width: 767px)'

/** Formato en que se abre el acceso: hoja en el celular; si no, el modo (la página no se abre aquí). */
export function formatoAcceso(modo: ModoCuenta, celular: boolean): FormatoAcceso | null {
  if (modo === 'pagina') return null
  return celular ? 'hoja' : modo
}

interface Sesion {
  activa: boolean
  nombre: string | null
  correo: string | null
}

/** Sesión del visitante (la misma que lee la cabecera): nombre del registro y correo. */
function useSesionTienda(): Sesion {
  const [sesion, setSesion] = useState<Sesion>({ activa: false, nombre: null, correo: null })
  useEffect(() => {
    const supabase = createClient()
    const fijar = (s: { user?: { email?: string | null; user_metadata?: Record<string, unknown> } } | null) => {
      const meta = s?.user?.user_metadata ?? {}
      const nombre = typeof meta.first_name === 'string' ? meta.first_name : typeof meta.full_name === 'string' ? meta.full_name : null
      setSesion({ activa: !!s, nombre, correo: s?.user?.email ?? null })
    }
    supabase.auth.getSession().then(({ data }) => fijar(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => fijar(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return sesion
}

/** Fuente del tema: en el body ya no se hereda de la raíz del sitio. */
function estiloDelSitio(primaryColor: string): CSSProperties {
  const raiz = typeof document !== 'undefined' ? document.querySelector<HTMLElement>('[data-raiz-sitio]') : null
  const fuente = raiz ? window.getComputedStyle(raiz).fontFamily : undefined
  return { ['--primary-color' as string]: primaryColor, ...(fuente ? { fontFamily: fuente } : {}) } as CSSProperties
}

// ─── Ícono de cuenta de la cabecera ───────────────────────────────────────────────────────────

/**
 * El ícono de cuenta. Con «Página» (o sin valor) es el enlace de siempre; con los demás modos, un
 * botón que abre el acceso (o el menú de cuenta, con sesión) e indica si está abierto.
 * Con `sesion`, en cualquier modo (también «Página»): el botón del avatar con su menú (Figma
 * «16 Sitio web» 3044:78726, aprobado 2026-11-24); `children` es el avatar ya presentado.
 */
export function EnlaceCuenta({
  modo,
  href,
  className,
  title,
  ariaLabel,
  sesion = false,
  primaryColor,
  whatsapp,
  children,
}: {
  modo: ModoCuenta
  href: string
  className?: string
  title?: string
  ariaLabel?: string
  /** Hay sesión: el avatar abre su menú en vez del acceso o la página. */
  sesion?: boolean
  primaryColor?: string | null
  /** Número de WhatsApp del sitio para «Ayuda por WhatsApp» del menú del avatar. */
  whatsapp?: string | null
  children: ReactNode
}) {
  const abierto = useAccesoAbierto()
  if (sesion) {
    return (
      <BotonAvatarCuenta primaryColor={primaryColor} whatsapp={whatsapp} className={className} title={title}>
        {children}
      </BotonAvatarCuenta>
    )
  }
  if (modo === 'pagina') {
    return (
      <Link href={href} className={className} title={title} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={ariaLabel ?? 'Mi cuenta'}
      aria-haspopup="dialog"
      aria-expanded={abierto}
      data-cuenta-modo={modo}
      onClick={(e) => abrirAccesoCuenta({ origen: e.currentTarget, respaldo: href })}
    >
      {children}
    </button>
  )
}

/**
 * Fila o botón del menú del celular («Iniciar sesión», «Registrarse», «Mi cuenta»). Con «Página»,
 * el enlace de siempre; con los demás modos cierra el menú y abre la misma hoja que el ícono
 * (Figma C3 2837:70283).
 */
export function EnlaceAccesoMenu({
  modo,
  vista = 'ingresar',
  href,
  className,
  style,
  onNavigate,
  children,
}: {
  modo: ModoCuenta
  vista?: VistaAcceso
  href: string
  className?: string
  style?: CSSProperties
  onNavigate: () => void
  children: ReactNode
}) {
  if (modo === 'pagina') {
    return (
      <Link href={href} className={className} style={style} onClick={onNavigate}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-haspopup="dialog"
      data-cuenta-modo={modo}
      onClick={() => {
        onNavigate()
        // Después de que el menú suelte el foco y el bloqueo del scroll.
        window.setTimeout(() => abrirAccesoCuenta({ vista, respaldo: href }), 0)
      }}
    >
      {children}
    </button>
  )
}

// ─── Menú de cuenta (con sesión) ──────────────────────────────────────────────────────────────

const ICONO_MENU: Readonly<Record<(typeof MENU_CUENTA)[number]['clave'], typeof Package>> = { pedidos: Package, favoritos: Heart, direcciones: MapPin }

function MenuCuenta({ sesion, conBotonCuenta, onNavegar, onSalir }: { sesion: Sesion; conBotonCuenta: boolean; onNavegar: () => void; onSalir: () => void }) {
  const { items } = useFavoritos()
  const saludo = saludoCuenta(sesion.nombre, sesion.correo)
  const inicial = (sesion.nombre || sesion.correo || '?').trim().charAt(0).toUpperCase()
  return (
    <div className="flex flex-col gap-1" data-menu-cuenta="">
      <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 12%, white)', color: 'var(--primary-color)' }}>
          {inicial}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold text-gray-900">{saludo}</span>
          {sesion.correo && <span className="truncate text-xs text-gray-500">{sesion.correo}</span>}
        </span>
      </div>
      <nav aria-label="Mi cuenta" className="flex flex-col py-1">
        {MENU_CUENTA.map((m) => {
          const Icono = ICONO_MENU[m.clave]
          return (
            <Link key={m.clave} href={m.href} onClick={onNavegar} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-gray-800 hover:bg-gray-50">
              <Icono aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-600" />
              <span className="flex-1">{m.texto}</span>
              {m.clave === 'favoritos' && items.length > 0 && (
                <span className="rounded-full px-1.5 text-xs font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
                  {items.length > 99 ? '99+' : items.length}
                </span>
              )}
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-gray-400" />
            </Link>
          )
        })}
      </nav>
      <button type="button" onClick={onSalir} className="flex items-center gap-3 rounded-lg border-t border-gray-100 px-2 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">
        <LogOut aria-hidden="true" className="h-4 w-4 text-gray-600" />
        Cerrar sesión
      </button>
      {conBotonCuenta && (
        <Link href="/mi-cuenta" onClick={onNavegar} className="mt-2 flex h-10 items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-900 hover:bg-gray-50">
          Ver mi cuenta
        </Link>
      )}
    </div>
  )
}

// ─── El acceso ────────────────────────────────────────────────────────────────────────────────

type VistaHost = VistaFormulario | 'menu'

export interface AccesoCuentaProps {
  opciones: OpcionesCuenta
  /** «Continuar con Google» (lib/cuenta/reglasCuenta.ts `googleEnAcceso`; apagado por defecto). */
  google?: boolean
  organizationId: number
  organizationName: string
  primaryColor: string
}

export function AccesoCuenta({ opciones, google = false, organizationId, organizationName, primaryColor }: AccesoCuentaProps) {
  const router = useRouter()
  const sesion = useSesionTienda()
  const [abierto, setAbierto] = useState(false)
  const [formato, setFormato] = useState<FormatoAcceso>('panel')
  const [vista, setVista] = useState<VistaHost>('ingresar')
  const [posicion, setPosicion] = useState<{ top: number; right: number } | null>(null)
  const [arrastre, setArrastre] = useState(0)
  const origen = useRef<HTMLElement | null>(null)
  const inicioToque = useRef<number | null>(null)
  const conHistorial = useRef(false)
  const sesionRef = useRef(sesion)
  sesionRef.current = sesion

  const estilo = useMemo(() => (abierto ? estiloDelSitio(primaryColor) : undefined), [abierto, primaryColor])

  /** Cierra. `porNavegacion`: un enlace ya lleva a otra página (no se retrocede el historial). */
  const cerrar = useCallback((porNavegacion = false) => {
    setAbierto(false)
    setArrastre(0)
    if (conHistorial.current) {
      conHistorial.current = false
      if (!porNavegacion && (window.history.state as Record<string, unknown> | null)?.accesoCuenta) window.history.back()
    }
  }, [])

  const abrir = useCallback(
    (detalle: DetalleAbrirAcceso) => {
      const pedida: VistaAcceso = detalle.vista ?? 'ingresar'
      const conSesion = sesionRef.current.activa
      const celular = window.matchMedia(CONSULTA_CELULAR).matches
      // En el computador, desde la ventana, crear cuenta y recuperar van al panel o a la página.
      // En el celular todo es la hoja. «Página» (o la ventana que manda a la página): la ruta de siempre.
      const modo = conSesion || celular ? opciones.modo : destinoVistaAcceso(opciones, pedida)
      const fmt = formatoAcceso(modo, celular)
      if (!fmt) {
        router.push(conSesion ? '/mi-cuenta' : rutaAcceso(pedida))
        return
      }
      origen.current = detalle.origen ?? (document.activeElement as HTMLElement | null)
      if (fmt === 'ventana' && origen.current) {
        const r = origen.current.getBoundingClientRect()
        setPosicion({ top: Math.round(r.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - r.right)) })
      } else {
        setPosicion(null)
      }
      setFormato(fmt)
      setVista(conSesion ? 'menu' : pedida)
      setAbierto(true)
      // Celular: el botón atrás cierra la hoja (una entrada más con el mismo estado de Next).
      if (fmt === 'hoja' && !conHistorial.current) {
        window.history.pushState({ ...((window.history.state as object | null) ?? {}), accesoCuenta: true }, '')
        conHistorial.current = true
      }
    },
    [opciones, router],
  )

  useEffect(() => {
    const oir = (e: Event) => abrir((e as CustomEvent<DetalleAbrirAcceso>).detail ?? {})
    window.addEventListener(EVENTO_ABRIR_ACCESO, oir)
    const soltar = registrarAnfitrionAcceso()
    return () => {
      window.removeEventListener(EVENTO_ABRIR_ACCESO, oir)
      soltar()
    }
  }, [abrir])

  useEffect(() => {
    if (!abierto) return
    const alVolver = () => {
      if ((window.history.state as Record<string, unknown> | null)?.accesoCuenta) return
      conHistorial.current = false
      setAbierto(false)
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [abierto])

  // Estado compartido (aria-expanded del ícono) y chat flotante escondido mientras está abierto.
  useEffect(() => {
    fijarAccesoAbierto(abierto)
    if (!abierto) return
    const raiz = document.documentElement
    raiz.setAttribute('data-cuenta-abierta', '')
    return () => raiz.removeAttribute('data-cuenta-abierta')
  }, [abierto])

  const alEntrar = useCallback(
    async (_tipo: TipoEntrada) => {
      if (opciones.despues === 'cuenta') {
        window.location.href = '/mi-cuenta'
        return
      }
      // Quedarse: se cierra y la página se refresca en su lugar (carrito y pago intactos).
      cerrar()
      void iniciarFavoritos(true)
      router.refresh()
    },
    [opciones.despues, cerrar, router],
  )

  /** Desde la ventana: crear cuenta y recuperar van al panel o a la página (lo del editor). */
  const irAFuera = useCallback(
    (v: 'registro' | 'recuperar') => {
      if (opciones.ventanaDestino === 'pagina') {
        cerrar(true)
        router.push(rutaAcceso(v))
        return
      }
      setFormato('panel')
      setPosicion(null)
      setVista(v)
    },
    [opciones.ventanaDestino, cerrar, router],
  )

  const salir = useCallback(async () => {
    await cerrarSesionTienda()
    cerrar()
    if (window.location.pathname.startsWith('/mi-cuenta')) window.location.href = '/'
    else router.refresh()
  }, [cerrar, router])

  if (!abierto) return null

  const enMenu = vista === 'menu'
  const titulo = enMenu ? 'Mi cuenta' : tituloVista(vista, opciones.titulo)
  // Contraseña vuelve al código; recuperar vuelve a la contraseña (de donde se abrió).
  const atras = vista === 'contrasena' || vista === 'recuperar' || vista === 'enviado'
  const volverA: VistaFormulario = vista === 'contrasena' ? 'ingresar' : 'contrasena'
  const IconoTitulo = vista === 'registro' ? UserPlus : User
  const conBeneficios = opciones.beneficios && formato !== 'ventana'

  const clases: Record<FormatoAcceso, string> = {
    panel: 'fixed inset-y-0 right-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200',
    dialogo: 'fixed left-1/2 top-1/2 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150',
    ventana: 'fixed flex max-h-[calc(100dvh-5rem)] w-[340px] flex-col rounded-xl border border-gray-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-1 duration-150',
    hoja: 'fixed inset-x-0 bottom-0 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl animate-in slide-in-from-bottom duration-200',
  }
  const estiloContenido: CSSProperties = {
    zIndex: 2147483647,
    ...(formato === 'ventana' && posicion ? { top: posicion.top, right: posicion.right } : {}),
    ...(formato === 'hoja' && arrastre > 0 ? { transform: `translateY(${arrastre}px)` } : {}),
  }

  const cabecera =
    formato === 'dialogo' && !enMenu ? (
      <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-6">
        <div className="flex items-start gap-2">
          {atras && (
            <button type="button" aria-label="Volver" onClick={() => setVista(volverA)} className="-ml-1 mt-0.5 rounded-full p-1 hover:bg-gray-100">
              <ArrowLeft aria-hidden="true" className="h-5 w-5 text-gray-700" />
            </button>
          )}
          <div className="flex flex-col">
            <Dialogo.Title className="text-xl font-semibold text-gray-900">{titulo}</Dialogo.Title>
            {!atras && <p className="text-sm text-gray-500">{vista === 'registro' ? `Regístrate en ${organizationName}` : `Accede a tu cuenta en ${organizationName}`}</p>}
          </div>
        </div>
        <Dialogo.Close aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-gray-100">
          <X aria-hidden="true" className="h-5 w-5 text-gray-500" />
        </Dialogo.Close>
      </div>
    ) : formato === 'ventana' ? (
      <div className={`flex items-center justify-between gap-3 px-4 pt-3.5 ${enMenu ? 'sr-only' : ''}`}>
        <Dialogo.Title className="text-base font-semibold text-gray-900">{titulo}</Dialogo.Title>
        {!enMenu && (
          <Dialogo.Close aria-label="Cerrar" className="rounded-full p-1 hover:bg-gray-100">
            <X aria-hidden="true" className="h-4 w-4 text-gray-500" />
          </Dialogo.Close>
        )}
      </div>
    ) : (
      <div
        className="shrink-0 border-b border-gray-100"
        onTouchStart={(e) => {
          if (formato === 'hoja') inicioToque.current = e.touches[0].clientY
        }}
        onTouchMove={(e) => {
          if (inicioToque.current !== null) setArrastre(Math.max(0, e.touches[0].clientY - inicioToque.current))
        }}
        onTouchEnd={() => {
          // Deslizar hacia abajo cierra la hoja (Figma, reglas del celular).
          if (inicioToque.current !== null && arrastre > 80) cerrar()
          else setArrastre(0)
          inicioToque.current = null
        }}
      >
        {formato === 'hoja' && <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 rounded-full bg-gray-300" />}
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2.5">
            {atras ? (
              <button type="button" aria-label="Volver" onClick={() => setVista(volverA)} className="-ml-1 rounded-full p-1 hover:bg-gray-100">
                <ArrowLeft aria-hidden="true" className="h-5 w-5 text-gray-800" />
              </button>
            ) : (
              <IconoTitulo aria-hidden="true" className="h-5 w-5 text-gray-800" />
            )}
            <Dialogo.Title className="text-lg font-semibold text-gray-900">{titulo}</Dialogo.Title>
          </div>
          <Dialogo.Close aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-gray-100">
            <X aria-hidden="true" className="h-5 w-5 text-gray-500" />
          </Dialogo.Close>
        </div>
      </div>
    )

  return (
    <Dialogo.Root
      open
      onOpenChange={(v) => {
        if (!v) cerrar()
      }}
    >
      <Dialogo.Portal>
        <div data-acceso-cuenta={formato} data-vista={vista} style={estilo}>
          <Dialogo.Overlay className={formato === 'ventana' ? 'fixed inset-0' : 'fixed inset-0 bg-black/50 backdrop-blur-[1px]'} style={{ zIndex: 2147483646 }} />
          <Dialogo.Content
            aria-describedby={undefined}
            className={`${clases[formato]} text-[#111827] outline-none`}
            style={estiloContenido}
            data-superficie-propia=""
            onOpenAutoFocus={(e) => {
              // El foco va al primer campo (o al primer enlace del menú), no a la X.
              e.preventDefault()
              const contenido = e.currentTarget as HTMLElement | null
              const primero = contenido?.querySelector<HTMLElement>('[data-primer-campo], [data-menu-cuenta] a, [data-menu-cuenta] button')
              primero?.focus({ preventScroll: true })
            }}
            onCloseAutoFocus={(e) => {
              if (!origen.current || !origen.current.isConnected) return
              e.preventDefault()
              origen.current.focus({ preventScroll: true })
            }}
          >
            {cabecera}
            <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${formato === 'ventana' ? 'px-4 pb-4 pt-3' : formato === 'dialogo' ? 'px-6 pb-6 pt-3' : 'px-5 py-5'}`}>
              {enMenu ? (
                <MenuCuenta sesion={sesion} conBotonCuenta={formato !== 'ventana'} onNavegar={() => cerrar(true)} onSalir={() => void salir()} />
              ) : (
                <FormularioAcceso
                  vista={vista}
                  onVista={setVista}
                  organizationId={organizationId}
                  textoBoton={opciones.boton}
                  compacto={formato === 'ventana'}
                  beneficios={conBeneficios}
                  textosBeneficios={opciones.textosBeneficios}
                  pestanas={formato === 'dialogo'}
                  google={google}
                  onIrAFuera={formato === 'ventana' ? irAFuera : undefined}
                  alEntrar={alEntrar}
                />
              )}
            </div>
          </Dialogo.Content>
        </div>
      </Dialogo.Portal>
    </Dialogo.Root>
  )
}
