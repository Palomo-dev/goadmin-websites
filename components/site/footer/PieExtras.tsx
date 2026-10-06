'use client'

/**
 * Bloques nuevos del pie (Figma «16 Sitio web», láminas de cada plantilla):
 * - «Escríbenos por WhatsApp» (footer_show_whatsapp) con el número del sitio;
 * - mapa de la sede con «Cómo llegar →» (footer_show_map);
 * - medios de pago visibles en la web (footer_show_payment_methods);
 * - columnas por menú con su nombre como encabezado (menús del pie del documento V2);
 * - íconos de TikTok y WhatsApp en las redes.
 *
 * Cada bloque devuelve `null` con su opción apagada (default), así que SiteFooter se pinta como
 * antes. Colores: heredan el del pie (`currentColor`), igual que el resto de sus enlaces.
 */
import Link from 'next/link'
import { MapPin, MessageCircle, Navigation } from 'lucide-react'
import { useEncabezadoPie } from '../EncabezadoPieContext'

/** TikTok (lucide no lo trae): mismo trazo que los demás íconos de redes. */
export function IconoTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 12a4 4 0 1 0 4 4V3c.5 2.5 2.5 4.5 5 5" />
    </svg>
  )
}

export function BotonWhatsappPie({ whatsappRedes, className = '' }: { whatsappRedes?: string | null; className?: string }) {
  const { opciones, extras } = useEncabezadoPie()
  if (!opciones.pie.whatsapp) return null
  const href = extras.enlaces.whatsapp ?? (whatsappRedes && /^https:\/\//i.test(whatsappRedes) ? whatsappRedes : null)
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-pie-whatsapp=""
      className={`inline-flex items-center gap-2 border px-3.5 py-2 text-sm font-medium transition-opacity hover:opacity-80 ${className}`}
      style={{ color: 'var(--accent-color, currentColor)', borderColor: 'currentColor', borderRadius: 'var(--radio-boton, 6px)' }}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      Escríbenos por WhatsApp
    </a>
  )
}

export function MapaPie({ className = '' }: { className?: string }) {
  const { opciones, extras } = useEncabezadoPie()
  if (!opciones.pie.mapa) return null
  const llegar = extras.enlaces.comoLlegar
  if (!llegar && !extras.mapaEmbebido) return null
  return (
    <div
      data-pie-mapa=""
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: 'var(--radio-sitio, 8px)', backgroundColor: 'color-mix(in srgb, currentColor 8%, transparent)', minHeight: 140 }}
    >
      {extras.mapaEmbebido ? (
        <iframe
          src={extras.mapaEmbebido}
          title="Mapa de la sede"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : null}
      {llegar ? (
        <a
          href={llegar}
          target="_blank"
          rel="noopener noreferrer"
          className={`relative z-10 flex h-full min-h-[140px] flex-col items-center justify-center gap-2 text-sm font-medium ${extras.mapaEmbebido ? 'justify-end pb-3' : ''}`}
        >
          {extras.mapaEmbebido ? null : <MapPin className="h-5 w-5" aria-hidden="true" />}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5"
            style={extras.mapaEmbebido ? { backgroundColor: 'var(--background-color, #fff)', color: 'var(--text-color, #111827)', borderRadius: 'var(--radio-boton, 6px)' } : undefined}
          >
            {extras.mapaEmbebido ? <Navigation className="h-4 w-4" aria-hidden="true" /> : null}
            Cómo llegar →
          </span>
        </a>
      ) : null}
    </div>
  )
}

export function MediosPagoPie({ className = '' }: { className?: string }) {
  const { opciones, extras } = useEncabezadoPie()
  if (!opciones.pie.mediosPago || extras.mediosPago.length === 0) return null
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${className}`} aria-label="Medios de pago" data-pie-medios-pago="">
      {extras.mediosPago.map((m) => (
        <li
          key={m}
          className="border px-2 py-0.5 text-[11px] font-semibold"
          style={{ borderColor: 'color-mix(in srgb, currentColor 25%, transparent)', borderRadius: 4 }}
        >
          {m}
        </li>
      ))}
    </ul>
  )
}

/** Logo del pie en sitios V2 con tema y sin imagen: monograma «TM» y nombre con la fuente de títulos. */
export function LogoPieTema({ nombre, color, textoSobreColor }: { nombre: string; color: string; textoSobreColor: string }) {
  const iniciales = nombre.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || nombre.slice(0, 2).toUpperCase()
  return (
    <span className="inline-flex items-center gap-2.5" data-logo-tema="">
      <span
        className="flex h-9 w-9 items-center justify-center text-sm font-semibold"
        style={{ backgroundColor: color, color: textoSobreColor, borderRadius: 'min(var(--radio-sitio, 8px), 8px)', fontFamily: 'var(--font-heading)' }}
      >
        {iniciales}
      </span>
      <span className="text-xl font-medium" style={{ fontFamily: 'var(--font-heading)' }}>{nombre}</span>
    </span>
  )
}

export interface ColumnaMenu {
  titulo: string
  items: { name: string; href: string }[]
}

/** Una columna por menú del pie, con el nombre del menú como encabezado (láminas: «Ayuda», «Legal»…). */
export function ColumnasMenusPie({ columnas, claseTitulo }: { columnas: ColumnaMenu[]; claseTitulo: string }) {
  if (columnas.length === 0) return null
  return (
    <>
      {columnas.map((c) => (
        <div key={c.titulo} data-pie-columna-menu="">
          <h3 className={claseTitulo} style={{ fontFamily: 'var(--font-body)' }}>{c.titulo}</h3>
          <ul className="space-y-2">
            {c.items.map((it, i) => (
              <li key={`${it.href}-${i}`}>
                <Link href={it.href} className="text-current opacity-60 hover:opacity-100 transition-opacity text-sm">
                  {it.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}
