'use client'

/**
 * `contact_channels` · `cards` — «Canales de contacto» (Contacto v2, Figma 3108:86969).
 *
 * Tarjetas WhatsApp, Teléfono, Correo, Dirección y canales propios. Cada canal toma el dato de la
 * organización o del sitio (Configuración) o un texto propio de la sección (`source: 'own'`). Un
 * canal sin dato no se muestra en la tienda. Contrato: `lib/website/v2/contrato/paginaContacto.ts`.
 */

import { Link2, Mail, MapPin, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditorHint } from '@/components/sections/restaurant/EditorHint'
import {
  CLAVES_CANALES,
  datosContactoDe,
  enlaceCanalPropio,
  leerCanales,
  valorDeCanal,
  type CanalContacto,
  type TipoCanal,
} from '@/lib/website/v2/contrato/paginaContacto'
import { whatsappDe } from '@/lib/website/menuInferior'
import { urlComoLlegar, urlLlamar } from '@/lib/maps/comoLlegar'

interface Props {
  content: Record<string, unknown>
  organization: any
  primaryColor?: string
}

const ICONOS: Record<TipoCanal, LucideIcon> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  address: MapPin,
  custom: Link2,
}

function txt(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** A dónde lleva el botón de un canal, con los enlaces de siempre del sitio. */
export function enlaceDeCanal(canal: CanalContacto, valor: string): { href: string; externo: boolean } | null {
  switch (canal.type) {
    case 'whatsapp': {
      const href = whatsappDe(valor, canal.message.trim() || undefined)
      return href ? { href, externo: true } : null
    }
    case 'phone': {
      const href = urlLlamar(valor)
      return href ? { href, externo: false } : null
    }
    case 'email':
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(valor) ? { href: `mailto:${valor}`, externo: false } : null
    case 'address': {
      const href = urlComoLlegar({ direccion: valor })
      return href ? { href, externo: true } : null
    }
    case 'custom': {
      const href = enlaceCanalPropio(canal.url)
      return href ? { href, externo: /^https?:\/\//i.test(href) } : null
    }
    default:
      return null
  }
}

export function CanalesContacto({ content, organization, primaryColor = '#3B82F6' }: Props) {
  const datos = datosContactoDe(organization, organization?.website_settings ?? null)
  const conAyuda = content.show_help !== false
  const whatsappPrincipal = content.whatsapp_primary !== false
  const canales = leerCanales(content.channels)
    .filter((c) => c.visible)
    .map((c) => ({ canal: c, valor: valorDeCanal(c, datos) }))
    .filter((x): x is { canal: CanalContacto; valor: string } => x.valor !== null)
  const titulo = txt(content.title)
  const subtitulo = txt(content.subtitle)

  if (canales.length === 0) {
    return (
      <EditorHint title="Canales de contacto sin datos">
        Ningún canal tiene dato. Escribe el WhatsApp, el teléfono, el correo y la dirección en Sitio web › Configuración, o pon un texto propio en cada canal.
      </EditorHint>
    )
  }

  const columnas = canales.length >= 4 ? 'lg:grid-cols-4' : canales.length === 3 ? 'lg:grid-cols-3' : canales.length === 2 ? 'sm:grid-cols-2' : ''
  return (
    <div className="flex flex-col gap-6">
      {(titulo || subtitulo) && (
        <div>
          {titulo && <h2 className="text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">{titulo}</h2>}
          {subtitulo && <p className="mt-1 text-gray-600 dark:text-gray-300">{subtitulo}</p>}
        </div>
      )}
      <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', columnas)}>
        {canales.map(({ canal, valor }) => {
          const Icono = ICONOS[canal.type]
          const enlace = enlaceDeCanal(canal, valor)
          const principal = canal.type === 'whatsapp' && whatsappPrincipal
          const colorIcono = canal.type === 'whatsapp' ? '#16a34a' : primaryColor
          return (
            <li key={canal.id} className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${colorIcono}1a` }}>
                <Icono aria-hidden className="h-5 w-5" style={{ color: colorIcono }} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                {canal.label && <p className="text-sm text-gray-500 dark:text-gray-400">{canal.label}</p>}
                <p className="break-words text-lg font-semibold text-gray-900 dark:text-white">{valor}</p>
                {conAyuda && canal.help && <p className="text-sm text-gray-500 dark:text-gray-400">{canal.help}</p>}
              </div>
              {enlace && canal.button_text && (
                <a
                  href={enlace.href}
                  {...(enlace.externo ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={cn(
                    'mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity',
                    principal ? 'text-white hover:opacity-90' : 'border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800',
                  )}
                  style={principal ? { backgroundColor: primaryColor } : undefined}
                >
                  {principal && <MessageCircle aria-hidden="true" className="h-4 w-4" />}
                  {canal.button_text}
                  {enlace.externo && <span className="sr-only"> (se abre en una pestaña nueva)</span>}
                </a>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

CanalesContacto.CONTENT_KEYS = CLAVES_CANALES
