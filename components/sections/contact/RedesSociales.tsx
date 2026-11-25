'use client'

/**
 * `social_networks` · `row` — «Redes sociales» (Contacto v2, Figma 3112:87143).
 *
 * Lee las redes guardadas del sitio (`website_settings.social_links`, Sitio web › SEO y redes): la
 * sección solo elige cuáles mostrar (`networks`; sin la clave, todas) y si van con nombre o solo el
 * ícono (`display`). Sin redes con enlace no pinta nada en la tienda.
 */

import type { ComponentType } from 'react'
import { Facebook, Instagram, Linkedin, Share2, Twitter, Youtube } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EditorHint } from '@/components/sections/restaurant/EditorHint'
import { IconoTikTok } from '@/components/site/footer/PieExtras'
import { CLAVES_REDES, formaRedes, type IdRedSocial } from '@/lib/website/v2/contrato/paginaContacto'
import { redesDeLaSeccion } from './datosSeccionesContacto'
import { FUENTE_CUERPO, FUENTE_TITULOS } from '@/lib/website/tarjetaPlantillasTienda'

interface Props {
  content: Record<string, unknown>
  organization: any
}

const ICONOS: Record<IdRedSocial, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: IconoTikTok,
  youtube: Youtube,
  x: Twitter,
  linkedin: Linkedin,
  pinterest: Share2,
}

function txt(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function RedesSociales({ content, organization }: Props) {
  const redes = redesDeLaSeccion(content, organization)
  const soloIcono = formaRedes(content.display) === 'icon'
  const titulo = txt(content.title)
  const subtitulo = txt(content.subtitle)

  if (redes.length === 0) {
    return (
      <EditorHint title="Redes sociales sin cuentas">
        Escribe tus cuentas en Sitio web › SEO y redes (o enciende alguna en la sección) para que aparezcan aquí.
      </EditorHint>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between" style={{ fontFamily: FUENTE_CUERPO }}>
      {(titulo || subtitulo) && (
        <div>
          {titulo && (
            <h2 className="text-xl font-bold text-gray-900 dark:text-white md:text-2xl" style={{ fontFamily: FUENTE_TITULOS }}>
              {titulo}
            </h2>
          )}
          {subtitulo && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{subtitulo}</p>}
        </div>
      )}
      <ul className="flex flex-wrap gap-2">
        {redes.map((r) => {
          const Icono = ICONOS[r.id]
          return (
            <li key={r.id}>
              <a
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={soloIcono ? `${r.nombre} (se abre en una pestaña nueva)` : undefined}
                title={soloIcono ? r.nombre : undefined}
                className={cn(
                  'inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 text-sm font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800',
                  soloIcono ? 'h-10 w-10' : 'px-4 py-2',
                )}
              >
                <Icono className="h-4 w-4" />
                {!soloIcono && r.nombre}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

RedesSociales.CONTENT_KEYS = CLAVES_REDES
