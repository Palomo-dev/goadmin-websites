'use client'

/**
 * Menú inferior del celular v2 (lib/website/menuInferior.ts): pestañas tipo app, botones de acción,
 * píldora flotante, solo íconos o isla con un botón aparte, con los botones que el sitio eligió
 * (texto, ícono, acción y destino).
 *
 * Solo se pinta con `mobile_header.bottom_nav.v === 2`. Sin eso la tienda sigue con su barra de
 * siempre (BarraPestanas, MobileBottomNav, MobileCTABar o BarraMovilGiro).
 * - Pestañas: el mismo aspecto de BarraPestanas (fondo y color del encabezado, 56 px). Con
 *   `centerShape: 'notch'` (N3) el destacado es un círculo de 64 px con muesca.
 * - Acciones: el mismo aspecto de BarraMovilGiro (primero relleno con el color de la marca).
 * - Píldora flotante (`floating`, Figma «Editor · Encabezado píldora…» P4/P5 c): una píldora
 *   separada `style.offset` (16) del borde inferior y de los lados, de vidrio (fondo del tema
 *   translúcido con desenfoque y borde; con `glass: false`, fondo del tema con sombra), pestañas
 *   ícono + texto, el botón destacado (`centerId`) en un círculo relleno y el activo marcado con
 *   `indicator` (fill/dot/line/slide). También la pinta OrganizationLayoutCliente con los enlaces
 *   del encabezado cuando la composición `pill` pide la píldora abajo (lib/website/pildora.ts).
 * - Solo íconos (`icons`, N2): el activo se abre en una píldora con su nombre.
 * - Isla (`split`, N4): la píldora flotante con hasta 4 botones y uno aparte en su círculo.
 * - Favoritos (`favorites`): abre el panel lateral o la página /favoritos, como el corazón de la
 *   cabecera (`header_favoritos.alTocar`). El almacén de favoritos solo se lee si el menú tiene
 *   ese botón (ConFavoritos).
 *
 * 2026-11-23 (Figma 2836:69391, aprobado): contador de Carrito y Favoritos (número, punto u oculto,
 * el mismo InsigniaContador de la cabecera), «al bajar» (se esconde y vuelve al subir), páginas
 * especiales (para todas las tiendas: sin menú en checkout, carrito y pedido; en la ficha se oculta
 * o se apila mientras se ve la barra fija de compra), la burbuja del chat 12 px sobre el menú,
 * colores (`theme`) y efectos del activo y al tocar. Sin las claves nuevas se pinta lo de hoy.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import Link from '@/components/site/Enlace'
import { usePathname } from 'next/navigation'
import {
  CalendarCheck, CalendarDays, CircleUserRound, Gift, Heart, Home, LayoutGrid, Link2, List, MapPin, Menu, MessageCircle, Package, Percent,
  Phone, Search, ShoppingBag, ShoppingBasket, ShoppingCart, Sparkles, Star, Store, Tag, Truck, User,
} from 'lucide-react'
import type { BotonMenu, ContadorMenu, DestinoBoton, DestinosTienda, EfectoActivo, IconoMenu, MenuInferior as Menu2, PaginaMenu } from '@/lib/website/menuInferior'
import { botonesVisibles, contadorMenu, efectoActivoMenu, fichaMenu, idBotonAparte, MS_VELOCIDAD, temaMenu } from '@/lib/website/menuInferior'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'
import { empujeChatBarra } from '@/lib/website/v2/barraFija'
import { CLASE_FONDO_ENCABEZADO, estiloBarraEncabezado, marcaFondoEncabezado, variablesEncabezado, useTemaMenuMovil, type HeaderVariantProps } from './header/HeaderShared'
import { ModalCategorias, useUnidadesCarrito } from './header/mobile/MobileTabs'
import { InsigniaContador } from './header/AccionCabecera'
import { ProductSearch } from './ProductSearch'
import { iconoBuscar, dibujoBuscar } from './header/iconoBuscar'
import { conGlifo } from './iconos/GlifoTienda'
import type { EstiloGlifos } from '@/lib/website/v2/glifosTienda'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { useOpcionesTienda } from './OpcionesTiendaContext'
import { abrirPanelFavoritos, useFavoritos } from '@/lib/favoritos/almacen'
import { registrarEmpujeChat } from './barraFija/efectosBarraFija'
import { useBarraFijaCelularVisible } from './menuInferior/estadoMenuInferior'
import { alTocarMenu, useAltoMenu, useEsconderAlBajar, useMarcaDeslizante } from './menuInferior/efectosMenu'

const ICONO: Record<IconoMenu, typeof Home> = {
  home: Home, grid: LayoutGrid, search: Search, bag: ShoppingBag, cart: ShoppingCart, user: User, menu: Menu,
  phone: Phone, whatsapp: MessageCircle, 'map-pin': MapPin, calendar: CalendarDays, 'calendar-check': CalendarCheck,
  package: Package, truck: Truck, tag: Tag, percent: Percent, star: Star, heart: Heart, sparkles: Sparkles, link: Link2,
  store: Store, list: List, basket: ShoppingBasket, 'user-circle': CircleUserRound, gift: Gift,
}

/** El estilo de los íconos sin su fondo (para los botones que ya pintan uno propio). */
function sinFondo(e: EstiloGlifos): EstiloGlifos | null {
  const { bg: _bg, ...resto } = e
  return Object.keys(resto).length > 0 ? resto : null
}

/** Insignia (carrito y favoritos) de cada variante: la misma que pintaba el carrito. */
const INSIGNIA_PESTANAS = 'absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] leading-4 font-bold text-center'
const INSIGNIA_FLOTANTE = 'absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-white text-[10px] leading-4 font-bold text-center'
const INSIGNIA_ACCIONES = INSIGNIA_PESTANAS

/** Posición del contador de InsigniaContador en cada variante (número y punto). */
const POSICION_NUMERO = '-top-2 -right-2.5'
const POSICION_PUNTO = '-top-0.5 -right-1'
const FORMA_NUMERO = 'h-4 min-w-4 rounded-full px-1 !text-[10px] leading-4'

/**
 * Cantidad de favoritos para el contador y el aria-label del botón «Favoritos». Es un componente
 * (no un hook en MenuInferior) para que el almacén solo se lea, y se pida a /api/favorites,
 * cuando el menú tiene ese botón.
 */
function ConFavoritos({ children }: { children: (cantidad: number) => ReactNode }) {
  const { items } = useFavoritos()
  return <>{children(items.length)}</>
}

/**
 * Contador con el componente de la cabecera (InsigniaContador): número con «99+», punto u oculto.
 * Rebota (300 ms) cuando la cantidad sube.
 */
function ContadorBoton({ cantidad, contador, color }: { cantidad: number; contador: ContadorMenu; color: string }) {
  const anterior = useRef(cantidad)
  const [rebote, setRebote] = useState(0)
  useEffect(() => {
    if (cantidad > anterior.current) setRebote((n) => n + 1)
    anterior.current = cantidad
  }, [cantidad])
  const deCabecera = contador === 'number' ? 'numero' : contador === 'dot' ? 'punto' : 'oculto'
  return (
    <InsigniaContador
      key={rebote}
      cantidad={cantidad}
      contador={deCabecera}
      color={color}
      className={`${contador === 'dot' ? POSICION_PUNTO : POSICION_NUMERO}${rebote > 0 ? ' rebote-contador-favoritos' : ''}`}
      claseNumero={FORMA_NUMERO}
    />
  )
}

type Props = Pick<HeaderVariantProps, 'organization' | 'primaryColor' | 'navTree' | 'settings' | 'menuCategories' | 'branchId'> & {
  menu: Menu2
  destinos: DestinosTienda
  onCartClick?: () => void
  /** Botones de acción: false en rutas con barra propia (checkout, carrito, detalle…). */
  rutaAdmiteAcciones: boolean
  /** Página especial de la ruta (`paginaMenu`): sin menú, ficha o normal. */
  pagina?: PaginaMenu
}

/** Marca del activo dentro de un botón (lo que no es la píldora que se desliza). */
function partesActivo(efecto: EfectoActivo | null, esActivo: boolean, color: string): { fondo?: CSSProperties; claseIcono: string; rellenoIcono: boolean; estiloIcono?: CSSProperties; extra: ReactNode } {
  if (!esActivo || !efecto) return { claseIcono: '', rellenoIcono: false, extra: null }
  switch (efecto) {
    case 'pill': return { fondo: { backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }, claseIcono: '', rellenoIcono: false, extra: null }
    case 'dot': return { claseIcono: '', rellenoIcono: false, extra: <span className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /> }
    case 'underline': return { claseIcono: '', rellenoIcono: false, extra: <span className="absolute bottom-0 h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" /> }
    case 'fill': return { claseIcono: '', rellenoIcono: true, extra: null }
    case 'bounce': return { claseIcono: 'mi-rebote-activo', rellenoIcono: false, extra: null }
    case 'glow': return {
      claseIcono: 'rounded-full',
      rellenoIcono: false,
      estiloIcono: { backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `0 0 0 5px color-mix(in srgb, ${color} 14%, transparent), 0 0 16px color-mix(in srgb, ${color} 45%, transparent)` },
      extra: null,
    }
    default: return { claseIcono: '', rellenoIcono: false, extra: null }
  }
}

export function MenuInferior({ menu, destinos, organization, primaryColor, navTree, settings, menuCategories, branchId, onCartClick, rutaAdmiteAcciones, pagina = 'normal' }: Props) {
  const { ruta } = useRutaSitio()
  const pathname = usePathname() ?? '/'
  const [categorias, setCategorias] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const unidades = useUnidadesCarrito(organization.subdomain || '', branchId)
  const temaMenuMovil = useTemaMenuMovil(primaryColor)
  const { favoritos } = useOpcionesTienda()
  const corte = ((settings as { mobile_breakpoint?: number | null } | null | undefined)?.mobile_breakpoint ?? 768) - 0.02
  // La píldora flotante es navegación, como las pestañas: en todas las rutas. Nunca en checkout,
  // carrito ni pedido (F3, todas las tiendas).
  const navegacion = menu.variant !== 'actions'
  const botones = pagina !== 'sin-menu' && menu.enabled && (navegacion || rutaAdmiteAcciones) ? botonesVisibles(menu, { ...destinos, favoritos: favoritos.alTocar }) : []
  const visible = botones.length > 0

  // Ficha (F1/F2): mientras se ve la barra fija de compra, el menú se oculta o se apila debajo.
  const barraFija = useBarraFijaCelularVisible()
  const modoFicha = fichaMenu(menu)
  const ocultoPorBarra = pagina === 'ficha' && barraFija && modoFicha === 'hide'
  const apilado = pagina === 'ficha' && barraFija && modoFicha === 'stack'
  const escondido = useEsconderAlBajar(visible && menu.style.scroll === 'hide')
  const oculto = ocultoPorBarra || escondido

  const navRef = useRef<HTMLElement>(null)
  const contRef = useRef<HTMLElement>(null)
  const alto = useAltoMenu(navRef, `${menu.variant}-${botones.length}-${apilado}-${visible}`)
  const marca = useMarcaDeslizante(contRef, `${pathname}-${botones.length}-${apilado}`)

  // F4: la burbuja del chat queda 12 px sobre el menú (su alto real) y baja con él.
  const idEmpuje = useId()
  useEffect(() => {
    registrarEmpujeChat(idEmpuje, empujeChatBarra(alto, visible && !oculto, true))
  }, [idEmpuje, alto, visible, oculto])
  useEffect(() => () => registrarEmpujeChat(idEmpuje, 0), [idEmpuje])

  // F2: apilada, la barra fija sube el alto del menú (regla `html[data-menu-apilado]`).
  const conApilar = visible && pagina === 'ficha' && modoFicha === 'stack'
  useEffect(() => {
    if (!conApilar) return
    const raiz = document.documentElement
    raiz.setAttribute('data-menu-apilado', '')
    raiz.style.setProperty('--menu-inferior-alto', `${alto}px`)
    return () => {
      raiz.removeAttribute('data-menu-apilado')
      raiz.style.removeProperty('--menu-inferior-alto')
    }
  }, [conApilar, alto])

  // Oculto por la barra de la ficha: fuera del orden de tabulación (React 18 no tipa `inert`).
  useEffect(() => {
    navRef.current?.toggleAttribute('inert', ocultoPorBarra)
  }, [ocultoPorBarra, visible])

  if (!visible) return null

  const alPulsar = (d: DestinoBoton) => {
    if (d.tipo !== 'evento') return
    if (d.evento === 'search') setBuscar(true)
    else if (d.evento === 'categories') setCategorias(true)
    else if (d.evento === 'cart') onCartClick?.()
    else if (d.evento === 'favorites') abrirPanelFavoritos()
    else document.querySelector<HTMLButtonElement>('header button[aria-label="Abrir menú"]')?.click()
  }
  const href = (d: DestinoBoton) => (d.tipo === 'ruta' ? ruta(d.href) : d.tipo === 'externo' ? d.href : '')
  const activo = (d: DestinoBoton) => d.tipo === 'ruta' && (d.href === '/' ? pathname === ruta('/') || pathname === '/' : pathname.startsWith(ruta(d.href)))
  // Apilado bajo la barra de compra, el menú va compacto: sin textos (F2).
  const conTexto = menu.style.labels !== 'never' && !apilado
  const efecto = efectoActivoMenu(menu)
  const tema = temaMenu(menu)
  const toque = menu.style.pressEffect && menu.style.pressEffect !== 'none' ? menu.style.pressEffect : null
  const tocar = toque ? alTocarMenu(toque) : undefined
  // Buscar usa el dibujo elegido en Encabezado › Íconos (el mismo de todos los buscadores).
  const IconoBuscar = iconoBuscar(settings)
  const dibujoLupa = dibujoBuscar(settings)
  const estiloIconos = menu.style.iconStyle ?? null
  /**
   * Ícono de un botón con su dibujo (Lucide de siempre o del catálogo nuevo) y el «Estilo de los
   * íconos» del menú (Figma 2852:70951). Sin dibujo nuevo ni estilo, el mismo componente de hoy.
   * `sobreFondo`: el botón ya pinta su círculo o su píldora (destacado, aparte, botón principal,
   * activo con su nombre): el ícono no suma otro fondo ni toma los colores activo/inactivo.
   */
  const iconoDe = (b: BotonMenu, o: { activo?: boolean; sobreFondo?: boolean } = {}) => {
    const esBuscar = b.icon === 'search'
    const base = esBuscar ? dibujoLupa.base : ICONO[b.icon]
    const estilo: EstiloGlifos | null = estiloIconos && o.sobreFondo ? sinFondo(estiloIconos) : estiloIconos
    const color = o.sobreFondo ? null : (o.activo ? estiloIconos?.active : estiloIconos?.inactive) ?? null
    return conGlifo(base, {
      glifo: b.glyph ?? (esBuscar ? dibujoLupa.glifo : null),
      nombre: esBuscar ? dibujoLupa.nombre : b.icon,
      estilo,
      color,
      fondo: o.activo && !o.sobreFondo ? (estiloIconos?.active ?? menu.style.active ?? primaryColor) : null,
    })
  }

  /**
   * Pinta un botón con su contador y su aria-label. Sin `style.badges.cart` el carrito lleva el
   * número de siempre (la misma insignia); los botones de acción, sin contador (como hoy).
   */
  const conInsignia = (b: BotonMenu, claseInsignia: string, pintar: (insignia: ReactNode, aria: string | undefined) => ReactNode) => {
    if (b.action === 'favorites') {
      const c = contadorMenu(menu, 'favorites')
      return (
        <ConFavoritos key={b.id}>
          {(cantidad) => pintar(
            <ContadorBoton cantidad={cantidad} contador={c} color={primaryColor} />,
            cantidad > 0 && c !== 'hidden' ? `${b.label || 'Favoritos'}, ${cantidad}` : undefined,
          )}
        </ConFavoritos>
      )
    }
    if (b.action !== 'cart') return pintar(null, undefined)
    const c = contadorMenu(menu, 'cart')
    const conNumero = unidades > 0 && c !== 'hidden'
    const insignia = !conNumero ? null : menu.style.badges?.cart ? (
      <ContadorBoton cantidad={unidades} contador={c} color={primaryColor} />
    ) : (
      <span className={claseInsignia} style={{ backgroundColor: primaryColor }}>
        {unidades > 99 ? '99+' : unidades}
      </span>
    )
    return pintar(insignia, conNumero ? `${b.label || 'Carrito'}, ${unidades}` : undefined)
  }
  const ocultarEscritorio = `@media (min-width:${corte + 0.02}px){[data-menu-inferior]{display:none!important}}`

  const extras = (
    <>
      {categorias && <ModalCategorias settings={settings} primaryColor={primaryColor} navTree={navTree} menuCategories={menuCategories} onClose={() => setCategorias(false)} />}
      {buscar && <ProductSearch primaryColor={primaryColor} icon={IconoBuscar} abierto sinDisparador pantallaCompleta alCerrar={() => setBuscar(false)} />}
    </>
  )

  const enlace = (b: BotonMenu, d: DestinoBoton, clase: string, estilo: CSSProperties | undefined, contenido: ReactNode, aria?: string, actual?: boolean) => {
    const etiqueta = aria ?? (conTexto ? undefined : b.label || undefined)
    const marcas = { 'data-mi-boton': '', ...(actual ? { 'aria-current': 'page' as const } : {}) }
    if (d.tipo === 'evento') return <button type="button" onClick={() => alPulsar(d)} className={clase} style={estilo} aria-label={etiqueta ?? b.label} data-mi-boton="">{contenido}</button>
    if (d.tipo === 'externo') {
      const nueva = /^https?:\/\//i.test(d.href)
      return <a href={d.href} {...(nueva ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className={clase} style={estilo} aria-label={etiqueta} {...marcas}>{contenido}</a>
    }
    return <Link href={href(d)} className={clase} style={estilo} aria-label={etiqueta} {...marcas}>{contenido}</Link>
  }

  /** Atributos comunes del <nav>: oculto o escondido, efecto al tocar y velocidad. */
  const atributosNav = () => ({
    ref: navRef,
    ...(oculto ? { 'data-oculto': '' } : {}),
    ...(toque ? { 'data-mi-toque': toque } : {}),
    onPointerDown: tocar,
  })
  const variablesNav = (separacion = 0, activoColor?: string): CSSProperties => ({
    ...(separacion ? { ['--mi-sep' as string]: `${separacion}px` } : {}),
    ...(menu.style.fxSpeed ? { ['--mi-dur' as string]: `${MS_VELOCIDAD[menu.style.fxSpeed]}ms` } : {}),
    ...(activoColor ? { ['--mi-activo' as string]: activoColor } : {}),
  })

  /** Píldora que se desliza al activo (N1), dentro del contenedor `contRef`. */
  const deslizante = (color: string) => efecto === 'slide' && marca.visible && (
    <span
      aria-hidden="true"
      data-mi-deslizante=""
      className="pointer-events-none absolute left-0 top-0 rounded-full"
      style={{ transform: `translate(${marca.left}px, ${marca.top}px)`, width: marca.width, height: marca.height, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    />
  )

  // Fondo y textos según `theme`: el del encabezado o el del tema del sitio; los colores propios
  // (`background`, `active`, `inactive`) siempre mandan, como hoy.
  const fondoEncabezado = tema === 'header'
  /** Con el fondo del encabezado, sus variables (colores e íconos del celular); si no, nada (hoy). */
  const envolver = (hijos: ReactNode) => fondoEncabezado
    ? <div className="contents" style={variablesEncabezado(settings, temaMenuMovil)}>{hijos}</div>
    : <>{hijos}</>

  if (menu.variant === 'actions') {
    const textoPrincipal = textoSobreAcentoSiHex(primaryColor) ?? '#ffffff'
    const principalId = menu.style.primaryId ?? botones[0].boton.id
    return envolver(
      <>
        <style>{ocultarEscritorio}</style>
        <div data-menu-inferior="" className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" aria-hidden="true" />
        <nav
          aria-label="Acciones rápidas"
          data-menu-inferior="acciones"
          {...atributosNav()}
          className={`fixed inset-x-0 bottom-0 z-40 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]${fondoEncabezado ? ` ${CLASE_FONDO_ENCABEZADO}` : ''}`}
          style={{
            ...(fondoEncabezado ? estiloBarraEncabezado(settings, 'top') : { backgroundColor: 'var(--background-color, #ffffff)' }),
            ...(menu.style.background ? { backgroundColor: menu.style.background } : {}),
            color: menu.style.inactive ?? (fondoEncabezado ? 'var(--hdr-mobile-icon)' : 'var(--text-color, #111827)'),
            borderTop: '1px solid color-mix(in srgb, var(--text-color, #111827) 12%, transparent)',
            ...variablesNav(0, menu.style.active ?? primaryColor),
          }}
          {...(fondoEncabezado ? marcaFondoEncabezado(settings) : {})}
        >
          <ul className="mx-auto flex max-w-md items-stretch gap-2">
            {botones.map(({ boton: b, destino: d }) => conInsignia(b, INSIGNIA_ACCIONES, (insignia, aria) => {
              const principal = b.id === principalId
              const Icono = iconoDe(b, { sobreFondo: principal })
              const fondo = menu.style.active ?? primaryColor
              const clase = 'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
              const estilo: CSSProperties = principal
                ? { backgroundColor: fondo, color: textoSobreAcentoSiHex(fondo) ?? textoPrincipal, borderRadius: 'var(--radio-boton, 6px)', outlineColor: primaryColor }
                : { border: '1px solid color-mix(in srgb, currentColor 85%, transparent)', borderRadius: 'var(--radio-boton, 6px)', outlineColor: primaryColor }
              return (
                <li key={b.id} className="flex flex-1">
                  {enlace(b, d, clase, estilo, <>
                    {insignia ? (
                      <span className="relative flex-shrink-0" data-mi-icono=""><Icono className="h-4 w-4" aria-hidden="true" />{insignia}</span>
                    ) : (
                      <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" data-mi-icono="" />
                    )}
                    {conTexto && <span className="truncate">{b.label}</span>}
                  </>, aria)}
                </li>
              )
            }))}
          </ul>
        </nav>
        {extras}
      </>,
    )
  }

  if (menu.variant === 'floating' || menu.variant === 'split') {
    const separacion = menu.style.offset ?? 16
    const vidrio = menu.style.glass !== false && !fondoEncabezado
    const aparteId = idBotonAparte(menu, botones.map((x) => x.boton.id))
    const enIsla = aparteId ? botones.filter((x) => x.boton.id !== aparteId) : botones
    const aparte = aparteId ? botones.find((x) => x.boton.id === aparteId) ?? null : null
    const completo = menu.style.width === 'full' && !aparte
    const texto = fondoEncabezado ? 'var(--hdr-mobile-icon)' : 'var(--text-color, #111827)'
    const activoColor = menu.style.active ?? texto
    const inactivoColor = menu.style.inactive ?? `color-mix(in srgb, ${texto} 70%, transparent)`
    const destacado = menu.style.active ?? primaryColor
    // Alto de la píldora (con o sin textos) + su separación: lo que se reserva al final de la página
    // para que no tape el pie ni el contenido.
    const altoPildora = conTexto ? 62 : 52
    const fondoPildora: CSSProperties = fondoEncabezado
      ? estiloBarraEncabezado(settings, 'top')
      : { backgroundColor: vidrio ? 'color-mix(in srgb, var(--background-color, #ffffff) 72%, transparent)' : 'var(--background-color, #ffffff)' }
    const botonPildora = (b: BotonMenu, d: DestinoBoton, insignia: ReactNode, aria: string | undefined) => {
      const centro = b.id === menu.style.centerId
      const esActivo = !centro && activo(d)
      const soloActivo = efecto === 'label'
      const Icono = iconoDe(b, { activo: esActivo, sobreFondo: centro || (soloActivo && esActivo) })
      const verTexto = soloActivo ? esActivo : conTexto
      const etiqueta = verTexto && <span className="max-w-[72px] truncate text-[10px] font-medium leading-none">{b.label}</span>
      const partes = partesActivo(efecto, esActivo, activoColor)
      const contenido = centro ? (
        <span className="flex h-full flex-col items-center justify-center gap-1" style={{ color: texto }}>
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full shadow-md" style={{ backgroundColor: destacado, color: textoSobreAcentoSiHex(destacado) ?? '#ffffff' }} data-mi-icono="">
            <Icono className="h-5 w-5" aria-hidden="true" />{insignia}
          </span>
          {conTexto && <span className="max-w-[72px] truncate text-[10px] font-medium leading-none">{b.label}</span>}
        </span>
      ) : soloActivo && esActivo ? (
        <span data-mi-marca="" className="relative flex h-full items-center justify-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: destacado, color: textoSobreAcentoSiHex(destacado) ?? '#ffffff' }}>
          <span className="relative" data-mi-icono=""><Icono className="h-5 w-5" aria-hidden="true" />{insignia}</span>
          <span className="max-w-[72px] truncate text-[11px] font-semibold leading-none">{b.label}</span>
        </span>
      ) : (
        <span
          data-mi-marca=""
          className={`relative flex h-full flex-col items-center justify-center gap-1 rounded-full px-2.5 ${verTexto ? 'py-1.5' : 'py-2'}`}
          style={{ color: esActivo ? activoColor : inactivoColor, ...partes.fondo }}
        >
          <span className={partes.claseIcono ? `relative ${partes.claseIcono}` : 'relative'} style={partes.estiloIcono} data-mi-icono=""><Icono className="h-5 w-5" aria-hidden="true" {...(partes.rellenoIcono ? { fill: 'currentColor' } : {})} />{insignia}</span>
          {etiqueta}
          {partes.extra}
        </span>
      )
      return (
        <li key={b.id} data-mi-item="" className={`flex ${completo ? 'flex-1' : 'min-w-[56px]'} justify-center`} aria-current={esActivo ? 'page' : undefined}>
          {enlace(b, d, 'flex h-full w-full items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2', { outlineColor: primaryColor }, contenido, aria ?? (verTexto ? undefined : b.label || undefined), esActivo)}
        </li>
      )
    }
    return envolver(
      <>
        <style>{ocultarEscritorio}</style>
        <div data-menu-inferior="" aria-hidden="true" style={{ height: `calc(${altoPildora + separacion + 8}px + env(safe-area-inset-bottom))` }} />
        <nav
          aria-label="Menú inferior"
          data-menu-inferior={aparte ? 'isla' : 'flotante'}
          data-menu-vidrio={vidrio ? '' : undefined}
          {...atributosNav()}
          className={`pointer-events-none fixed inset-x-0 z-40 flex ${aparte ? 'items-center justify-between gap-3' : 'justify-center'}`}
          style={{ bottom: `calc(${separacion}px + env(safe-area-inset-bottom))`, paddingLeft: `${separacion}px`, paddingRight: `${separacion}px`, ...variablesNav(separacion, destacado) }}
        >
          <ul
              ref={contRef as RefObject<HTMLUListElement>}
              className={`pointer-events-auto flex items-stretch gap-0.5 rounded-full p-1.5 ${completo ? 'w-full' : 'max-w-full'}${aparte ? ' min-w-0' : ''}${efecto === 'slide' ? ' relative' : ''}${fondoEncabezado ? ` ${CLASE_FONDO_ENCABEZADO}` : ''}`}
              style={{
                ...fondoPildora,
                ...(menu.style.background ? (fondoEncabezado ? { background: menu.style.background } : { backgroundColor: menu.style.background }) : {}),
                ...(vidrio ? { backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' } : {}),
                border: `1px solid color-mix(in srgb, ${texto} ${vidrio ? 10 : 8}%, transparent)`,
                boxShadow: vidrio ? '0 8px 24px rgba(0, 0, 0, 0.12)' : '0 10px 30px rgba(0, 0, 0, 0.18)',
                color: inactivoColor,
              }}
              {...(fondoEncabezado ? marcaFondoEncabezado(settings) : {})}
            >
              {deslizante(activoColor)}
              {enIsla.map(({ boton: b, destino: d }) => conInsignia(b, INSIGNIA_FLOTANTE, (insignia, aria) => botonPildora(b, d, insignia, aria)))}
          </ul>
          {aparte && conInsignia(aparte.boton, INSIGNIA_FLOTANTE, (insignia, aria) => {
            const Icono = iconoDe(aparte.boton, { sobreFondo: true })
            return (
              <span key={aparte.boton.id} className="pointer-events-auto flex shrink-0">
                {enlace(
                  aparte.boton,
                  aparte.destino,
                  'relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                  { backgroundColor: destacado, color: textoSobreAcentoSiHex(destacado) ?? '#ffffff', outlineColor: primaryColor },
                  <span className="relative" data-mi-icono=""><Icono className="h-6 w-6" aria-hidden="true" />{insignia}</span>,
                  aria ?? (aparte.boton.label || undefined),
                )}
              </span>
            )
          })}
        </nav>
        {extras}
      </>,
    )
  }

  // Pestañas y Solo íconos: barra fija de 56 px.
  const soloIconos = menu.variant === 'icons'
  const colorTexto = fondoEncabezado ? 'var(--hdr-mobile-icon)' : 'var(--text-color, #111827)'
  const colorActivo = menu.style.active ?? (efecto ? primaryColor : undefined)
  const colorInactivo = menu.style.inactive ?? colorTexto
  const muesca = menu.style.centerShape === 'notch'
  return envolver(
    <>
      <style>{`@media (max-width: ${corte}px) { body { padding-bottom: 3.5rem; } }${ocultarEscritorio}`}</style>
      <nav
        aria-label="Menú inferior"
        data-menu-inferior={soloIconos ? 'iconos' : 'pestanas'}
        {...atributosNav()}
        className={`fixed bottom-0 left-0 right-0 z-40 ${fondoEncabezado ? CLASE_FONDO_ENCABEZADO : ''}`}
        style={{
          ...(fondoEncabezado ? estiloBarraEncabezado(settings, 'top') : { backgroundColor: 'var(--background-color, #ffffff)', borderTop: '1px solid color-mix(in srgb, var(--text-color, #111827) 12%, transparent)' }),
          ...(menu.style.background ? { background: menu.style.background } : {}),
          color: colorInactivo,
          ...variablesNav(0, colorActivo ?? primaryColor),
        }}
        {...(fondoEncabezado ? marcaFondoEncabezado(settings) : {})}
      >
        <div ref={contRef as RefObject<HTMLDivElement>} className={`grid h-14${efecto === 'slide' ? ' relative' : ''}`} style={{ gridTemplateColumns: `repeat(${botones.length}, minmax(0, 1fr))` }}>
          {deslizante(colorActivo ?? primaryColor)}
          {botones.map(({ boton: b, destino: d }) => conInsignia(b, INSIGNIA_PESTANAS, (insignia, aria) => {
            const centro = b.id === menu.style.centerId
            const esActivo = activo(d)
            const Icono = iconoDe(b, { activo: esActivo, sobreFondo: centro || (efecto === 'label' && esActivo) })
            const color = esActivo && colorActivo ? colorActivo : colorInactivo
            const soloActivo = efecto === 'label'
            const verTexto = soloIconos || soloActivo ? false : conTexto
            const fondoCentro = colorActivo ?? primaryColor
            let contenido: ReactNode
            if (centro) {
              contenido = muesca ? (
                // N3: círculo de 64 px que sube sobre la barra con un aro del color de la página (muesca).
                <span className="flex h-full flex-col items-center justify-end gap-0.5 pb-1">
                  <span
                    className="relative flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ backgroundColor: fondoCentro, color: textoSobreAcentoSiHex(fondoCentro) ?? '#ffffff', boxShadow: '0 0 0 6px var(--background-color, #ffffff), 0 8px 18px rgba(0, 0, 0, 0.18)' }}
                    data-mi-icono=""
                  >
                    <Icono className="h-7 w-7" aria-hidden="true" />{insignia}
                  </span>
                  {verTexto && <span className="text-[10px] font-medium" style={{ color }}>{b.label}</span>}
                </span>
              ) : (
                <span className="flex flex-col items-center justify-center gap-0.5 h-full">
                  <span className="relative -mt-5 flex h-12 w-12 items-center justify-center rounded-full shadow-lg" style={{ backgroundColor: fondoCentro, color: textoSobreAcentoSiHex(fondoCentro) ?? '#ffffff' }} data-mi-icono="">
                    <Icono className="h-6 w-6" aria-hidden="true" />{insignia}
                  </span>
                  {verTexto && <span className="text-[10px] font-medium" style={{ color }}>{b.label}</span>}
                </span>
              )
            } else if (!efecto) {
              // Lo de hoy (Pestañas sin marca del activo).
              contenido = (
                <span className="flex flex-col items-center justify-center gap-0.5 h-full hover:opacity-80 transition-opacity" style={{ color }}>
                  <span className="relative" data-mi-icono=""><Icono className="h-5 w-5" aria-hidden="true" />{insignia}</span>
                  {verTexto && <span className="text-[10px] font-medium">{b.label}</span>}
                </span>
              )
            } else if (soloActivo && esActivo) {
              // N2 / «Etiqueta solo en el activo»: el activo se abre en una píldora con su nombre.
              const fondo = colorActivo ?? primaryColor
              contenido = (
                <span className="flex h-full items-center justify-center">
                  <span data-mi-marca="" className="relative flex items-center gap-1.5 rounded-full px-3 py-2" style={{ backgroundColor: fondo, color: textoSobreAcentoSiHex(fondo) ?? '#ffffff' }}>
                    <span className="relative" data-mi-icono=""><Icono className="h-5 w-5" aria-hidden="true" />{insignia}</span>
                    <span className="max-w-[80px] truncate text-[12px] font-semibold leading-none">{b.label}</span>
                  </span>
                </span>
              )
            } else {
              const partes = partesActivo(efecto, esActivo, colorActivo ?? primaryColor)
              contenido = (
                <span className="flex h-full items-center justify-center" style={{ color }}>
                  <span data-mi-marca="" className={`relative flex flex-col items-center justify-center gap-0.5 rounded-full px-3 ${verTexto ? 'py-1' : 'py-2'}`} style={partes.fondo}>
                    <span className={partes.claseIcono ? `relative ${partes.claseIcono}` : 'relative'} style={partes.estiloIcono} data-mi-icono=""><Icono className="h-5 w-5" aria-hidden="true" {...(partes.rellenoIcono ? { fill: 'currentColor' } : {})} />{insignia}</span>
                    {verTexto && <span className="text-[10px] font-medium">{b.label}</span>}
                    {partes.extra}
                  </span>
                </span>
              )
            }
            return (
              <span key={b.id} data-mi-item="" className="flex items-center justify-center" aria-current={esActivo ? 'page' : undefined}>
                {enlace(b, d, 'flex h-full w-full items-center justify-center', undefined, contenido, aria ?? (verTexto ? undefined : b.label || undefined), esActivo)}
              </span>
            )
          }))}
        </div>
      </nav>
      {extras}
    </>,
  )
}
