'use client'

/**
 * Pie de los sitios V2 con tema (Figma «16 Sitio web», una lámina por plantilla). SiteFooter lo
 * usa SOLO cuando el sitio tiene tema con colores (`useTemaColores`); los sitios legacy siguen con
 * sus cinco composiciones de siempre.
 *
 * Estructura de las láminas:
 * - marca (monograma + nombre con la fuente de títulos), descripción, redes en círculo con borde y
 *   «Escríbenos por WhatsApp»;
 * - columnas: Ubicación (dirección + «Cómo llegar», con el mapa), Horario / Horario por sede (una
 *   línea por sede), una por menú del pie con su nombre, Contacto (teléfono, WhatsApp, correo) y,
 *   a la derecha, la tarjeta del mapa;
 * - barra inferior: «© año marca» y los enlaces «Tratamiento de datos» del menú legal, medios de
 *   pago y, si la organización lo deja encendido, «Hecho con GO Admin».
 * - centrado (Noir): todo centrado; mínimo: marca | enlaces | redes en una fila; el resto, rejilla.
 * - celular: alineado a la izquierda y con acordeones (el primero abierto), como las láminas.
 *
 * Boletín: no hay dónde guardar el correo (no existe alta de suscriptores), así que la columna no
 * sale hasta que exista (BOLETIN_DISPONIBLE). Un formulario que no envía no va en una plantilla.
 */
import Link from 'next/link'
import Image from 'next/image'
import {
  ChevronRight, Clock, Facebook, HelpCircle, Instagram, Linkedin, Mail, MapPin, MessageCircle, Navigation, Phone, RotateCcw,
  Truck, Twitter, Youtube,
} from 'lucide-react'
import type { OrganizationWithDetails, WebsiteMenuWithItems, WebsiteMenuItemWithChildren } from '@/types/database'
import { useEncabezadoPie } from '../EncabezadoPieContext'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { prefijarItemsNav } from '@/lib/outlet/rutaSitio'
import { IconoTikTok, LogoPieTema, MapaPie, MediosPagoPie } from './PieExtras'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

/** Alta de suscriptores del boletín: no existe todavía (2026-10-06). */
export const BOLETIN_DISPONIBLE = false

const TRATAMIENTO = /^tratamiento de datos$/i

interface Enlace {
  name: string
  href: string
}

interface Columna {
  clave: string
  titulo: string
  contenido: React.ReactNode
}

export interface PieTemaProps {
  organization: OrganizationWithDetails
  primaryColor: string
  composicion: string
  claseFondo: string
  estiloFondo: React.CSSProperties | undefined
  menus: WebsiteMenuWithItems[] | undefined
  redes: Record<string, string | undefined>
  textoPie: string
  mostrarHechoCon: boolean
  mostrarContacto: boolean
  mostrarHorario: boolean
  mostrarRedes: boolean
  logoHeight: number
}

function enlacesDeMenu(items: WebsiteMenuItemWithChildren[]): Enlace[] {
  return items.map((item) => {
    if ((item.item_type === 'page' || item.item_type === 'policy') && item.page) {
      return { name: item.custom_label || item.page.title, href: item.page.slug === 'home' ? '/' : `/${item.page.slug}` }
    }
    if (item.item_type === 'category' && item.category) return { name: item.category.name, href: `/categorias/${item.category.slug}` }
    return { name: item.custom_label || '', href: item.custom_url || '#' }
  }).filter((e) => e.name)
}

/** Ícono de un enlace del pie por su destino o texto (láminas: ayuda, rastreo, devoluciones, check-in). */
function iconoDeEnlace(e: Enlace): typeof Clock | null {
  const t = `${e.href} ${e.name}`.toLowerCase()
  if (/preguntas|faq/.test(t)) return HelpCircle
  if (/tracking|rastre|consultar-pedido/.test(t)) return Truck
  if (/devoluci/.test(t)) return RotateCcw
  if (/check-in|estad[ií]a/.test(t)) return Clock
  return null
}

const ICONOS_REDES: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: IconoTikTok,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
}

const fila = 'flex items-center gap-2 text-sm text-current opacity-70'
const enlaceFila = 'flex items-center gap-2 text-sm text-current opacity-70 hover:opacity-100 transition-opacity'
const tituloColumna = 'mb-3 text-xs font-semibold uppercase tracking-wider text-white'

export function PieTema(p: PieTemaProps) {
  const { opciones, extras } = useEncabezadoPie()
  const { prefijo } = useRutaSitio()
  const anio = new Date().getFullYear()
  const centrado = p.composicion === 'centered'
  const minimo = p.composicion === 'minimal'
  const iconoTxt = textoSobreAcentoSiHex(p.primaryColor) ?? '#ffffff'

  // Menús del pie: «Tratamiento de datos» va a la barra inferior; el resto, una columna por menú.
  const menus = (p.menus ?? []).map((m) => ({ titulo: m.name, enlaces: prefijarItemsNav(enlacesDeMenu(m.items), prefijo) ?? [] }))
  const abajo = menus.flatMap((m) => m.enlaces.filter((e) => TRATAMIENTO.test(e.name)))
  const columnasMenu = menus
    .map((m) => ({ ...m, enlaces: m.enlaces.filter((e) => !TRATAMIENTO.test(e.name)) }))
    .filter((m) => m.titulo && m.enlaces.length > 0)

  const direccion = [p.organization.address, p.organization.city].filter(Boolean).join(', ') || extras.sedeEstado?.direccion || null
  const llegar = extras.enlaces.comoLlegar
  const conUbicacion = opciones.pie.mapa && (!!direccion || !!llegar)

  const columnas: Columna[] = []
  if (conUbicacion) {
    columnas.push({
      clave: 'ubicacion',
      titulo: 'Ubicación',
      contenido: (
        <ul className="space-y-2">
          {direccion && <li className={fila}><MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />{direccion}</li>}
          {llegar && (
            <li>
              <a href={llegar} target="_blank" rel="noopener noreferrer" className={enlaceFila}>
                <Navigation className="h-4 w-4 flex-shrink-0" aria-hidden="true" />Cómo llegar
              </a>
            </li>
          )}
        </ul>
      ),
    })
  }
  const horarios = extras.horariosSedes ?? []
  if (p.mostrarHorario && horarios.length > 0) {
    columnas.push({
      clave: 'horario',
      titulo: horarios.length > 1 ? 'Horario por sede' : 'Horario',
      contenido: (
        <ul className="space-y-2">
          {horarios.map((h) => (
            <li key={`${h.nombre}-${h.resumen}`} className={`${fila} ${centrado ? 'md:justify-center' : ''}`}>
              <Clock className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {h.nombre ? `${h.nombre} · ${h.resumen}` : h.resumen}
            </li>
          ))}
        </ul>
      ),
    })
  }
  // Orden de las láminas: ubicación, horario, menús, contacto y, al final, el menú legal.
  const esLegal = (titulo: string) => /^legal/i.test(titulo.trim())
  const columnaMenu = (m: { titulo: string; enlaces: Enlace[] }): Columna => ({
    clave: `menu-${m.titulo}`,
      titulo: m.titulo,
      contenido: (
        <ul className="space-y-2">
          {m.enlaces.map((e, i) => {
            const Icono = iconoDeEnlace(e)
            return (
              <li key={`${e.href}-${i}`}>
                <Link href={e.href} className={`${enlaceFila} ${centrado ? 'md:justify-center' : ''}`}>
                  {Icono && <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />}
                  {e.name}
                </Link>
              </li>
            )
          })}
        </ul>
      ),
  })
  columnas.push(...columnasMenu.filter((m) => !esLegal(m.titulo)).map(columnaMenu))
  if (p.mostrarContacto) {
    const tel = p.organization.phone
    const correo = p.organization.email
    const wa = extras.enlaces.whatsapp
    const centrar = centrado ? 'md:justify-center' : ''
    if (tel || correo || wa || (!conUbicacion && direccion)) {
      columnas.push({
        clave: 'contacto',
        titulo: 'Contacto',
        contenido: (
          <ul className="space-y-2">
            {!conUbicacion && direccion && <li className={`${fila} ${centrar}`}><MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />{direccion}</li>}
            {tel && <li><a href={`tel:${tel}`} className={`${enlaceFila} ${centrar}`}><Phone className="h-4 w-4 flex-shrink-0" aria-hidden="true" />{tel}</a></li>}
            {wa && !centrado && <li><a href={wa} target="_blank" rel="noopener noreferrer" className={enlaceFila}><MessageCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />WhatsApp</a></li>}
            {correo && !centrado && <li><a href={`mailto:${correo}`} className={enlaceFila}><Mail className="h-4 w-4 flex-shrink-0" aria-hidden="true" />{correo}</a></li>}
          </ul>
        ),
      })
    }
  }

  columnas.push(...columnasMenu.filter((m) => esLegal(m.titulo)).map(columnaMenu))

  const redes = p.mostrarRedes
    ? Object.entries(p.redes).filter(([red, url]) => !!url && (ICONOS_REDES[red] || (red === 'whatsapp' && opciones.pie.whatsapp)))
    : []
  const marca = (
    <div className={`flex flex-col gap-4 ${centrado ? 'items-start md:items-center md:text-center' : 'items-start'}`}>
      {p.organization.logo_url ? (
        <Image src={p.organization.logo_url} alt={p.organization.name} width={p.logoHeight * 3} height={p.logoHeight} className="w-auto object-contain" style={{ height: `${p.logoHeight}px` }} />
      ) : (
        <LogoPieTema nombre={p.organization.name} color={p.primaryColor} textoSobreColor={iconoTxt} />
      )}
      {p.organization.description && <p className="max-w-sm text-sm text-current opacity-70">{p.organization.description}</p>}
      {redes.length > 0 && (
        <div className="flex gap-2.5">
          {redes.map(([red, url]) => {
            const Icono = ICONOS_REDES[red] ?? MessageCircle
            return (
              <a
                key={red}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={red}
                className="flex h-8 w-8 items-center justify-center rounded-full border transition-opacity hover:opacity-80"
                style={{ borderColor: 'color-mix(in srgb, currentColor 22%, transparent)' }}
              >
                <Icono className="h-4 w-4" />
              </a>
            )
          })}
        </div>
      )}
      {opciones.pie.whatsapp && extras.enlaces.whatsapp && (
        <a
          href={extras.enlaces.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          data-pie-whatsapp=""
          className="inline-flex items-center gap-2 border px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: 'var(--accent-color, currentColor)', borderColor: 'currentColor', borderRadius: 'var(--radio-boton, 6px)' }}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Escríbenos por WhatsApp
        </a>
      )}
    </div>
  )

  const barraInferior = (
    <div className="mt-10 flex flex-col gap-3 border-t border-gray-700 pt-6 text-xs md:flex-row md:items-center md:justify-between">
      <p className="text-current opacity-60">
        {p.textoPie || `© ${anio} ${p.organization.name}`}
        {abajo.map((e, i) => (
          <span key={`${e.href}-${i}`}>
            {' · '}
            <Link href={e.href} className="hover:opacity-100 hover:underline">{e.name}</Link>
          </span>
        ))}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <MediosPagoPie />
        {p.mostrarHechoCon && (
          <p className="text-current opacity-60">
            Hecho con{' '}
            <a href="https://goadmin.io" target="_blank" rel="noopener noreferrer" className="hover:opacity-100" style={{ color: 'var(--accent-color)' }}>
              GO Admin
            </a>
          </p>
        )}
      </div>
    </div>
  )

  // Celular: a la izquierda, con acordeones (el primero abierto).
  const movil = (
    <div className="md:hidden">
      {columnas.map((c, i) => (
        <details key={c.clave} className="group border-b border-gray-700" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-white">
            {c.titulo}
            <ChevronRight className="h-4 w-4 opacity-60 transition-transform group-open:rotate-90" aria-hidden="true" />
          </summary>
          <div className="pb-4">{c.contenido}</div>
        </details>
      ))}
      <MapaPie className="mt-5" />
    </div>
  )

  return (
    <footer className={p.claseFondo} style={p.estiloFondo} data-pie-tema={p.composicion}>
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        {centrado ? (
          <>
            <div className="mb-8 md:flex md:justify-center">{marca}</div>
            <div className="hidden flex-wrap justify-center gap-x-20 gap-y-8 text-center md:flex">
              {columnas.map((c) => (
                <div key={c.clave}>
                  <h3 className={tituloColumna} style={{ fontFamily: 'var(--font-body)' }}>{c.titulo}</h3>
                  {c.contenido}
                </div>
              ))}
            </div>
            <div className="hidden md:block"><MapaPie className="mx-auto mt-8 max-w-md" /></div>
            {movil}
          </>
        ) : minimo ? (
          <>
            <div className="hidden items-start justify-between gap-10 md:flex">
              {marca}
              <div className="flex flex-wrap gap-x-16 gap-y-6">
                {columnas.map((c) => (
                  <div key={c.clave}>
                    <h3 className={tituloColumna} style={{ fontFamily: 'var(--font-body)' }}>{c.titulo}</h3>
                    {c.contenido}
                  </div>
                ))}
              </div>
              <MapaPie className="w-64" />
            </div>
            <div className="md:hidden">
              <div className="mb-6">{marca}</div>
              {movil}
            </div>
          </>
        ) : (
          <>
            <div
              className="hidden gap-10 md:grid"
              style={{
                gridTemplateColumns: `minmax(220px, 1.6fr) repeat(${Math.max(columnas.length, 1)}, minmax(0, 1fr))${opciones.pie.mapa ? ' minmax(200px, 1.3fr)' : ''}`,
              }}
            >
              {marca}
              {columnas.map((c) => (
                <div key={c.clave}>
                  <h3 className={tituloColumna} style={{ fontFamily: 'var(--font-body)' }}>{c.titulo}</h3>
                  {c.contenido}
                </div>
              ))}
              {opciones.pie.mapa && <MapaPie />}
            </div>
            <div className="md:hidden">
              <div className="mb-6">{marca}</div>
              {movil}
            </div>
          </>
        )}
        {barraInferior}
      </div>
    </footer>
  )
}
