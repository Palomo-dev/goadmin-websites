'use client'

/**
 * Barra fija del celular para cualquier giro (Figma «16 Sitio web», celular 390 de cada
 * plantilla): «Reservar · Cómo llegar · Llamar», «Agendar · WhatsApp», «Prueba gratis»…
 *
 * Solo con `mobile_bottom_bar` = lista de acciones (lib/website/encabezadoPie.ts). Con `auto`
 * (default) sigue la barra de hoy del restaurante (restaurant/MobileCTABar.tsx) y con `ninguna`
 * no hay barra. Las acciones llegan resueltas del servidor (extrasEncabezadoPie.server.ts): la
 * que no aplica en el sitio (sin WhatsApp, sin dirección…) ya no viene.
 *
 * La primera acción va rellena con el color de la marca; las demás, en contorno. Fondo y texto
 * del tema (`--background-color` / `--text-color`). Solo en móvil (`lg:hidden`, mismo corte que
 * el encabezado móvil), con espacio para el área segura y un espaciador para no tapar el pie.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import { CalendarCheck, CalendarDays, MessageCircle, Navigation, Phone, ShoppingBag, Sparkles } from 'lucide-react'
import type { AccionBarra } from '@/lib/website/encabezadoPie'
import { textoSobreAcentoSiHex } from '@/lib/website/v2/textoSobreAcento'

const ACCION: Record<AccionBarra['accion'], { texto: string; Icono: typeof Phone }> = {
  pedir: { texto: 'Pedir', Icono: ShoppingBag },
  reservar: { texto: 'Reservar', Icono: CalendarDays },
  agendar: { texto: 'Agendar', Icono: CalendarCheck },
  prueba: { texto: 'Prueba gratis', Icono: Sparkles },
  llamar: { texto: 'Llamar', Icono: Phone },
  whatsapp: { texto: 'WhatsApp', Icono: MessageCircle },
  como_llegar: { texto: 'Cómo llegar', Icono: Navigation },
}

export function BarraMovilGiro({ acciones, primaryColor }: { acciones: AccionBarra[]; primaryColor: string }) {
  const visible = acciones.length > 0
  // La burbuja del chat sube mientras hay barra (misma clase que la barra del restaurante).
  useEffect(() => {
    if (!visible) return
    document.body.classList.add('con-barra-movil')
    return () => document.body.classList.remove('con-barra-movil')
  }, [visible])
  if (!visible) return null
  const textoPrincipal = textoSobreAcentoSiHex(primaryColor) ?? '#ffffff'

  return (
    <>
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />
      <nav
        aria-label="Acciones rápidas"
        data-barra-movil-giro=""
        className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden"
        style={{
          backgroundColor: 'var(--background-color, #ffffff)',
          color: 'var(--text-color, #111827)',
          borderTop: '1px solid color-mix(in srgb, var(--text-color, #111827) 12%, transparent)',
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch gap-2">
          {acciones.slice(0, 4).map(({ accion, href }, i) => {
            const { texto, Icono } = ACCION[accion]
            const principal = i === 0
            const externo = /^https?:\/\//i.test(href)
            const clase = 'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-2 text-[13px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
            const estilo: React.CSSProperties = principal
              ? { backgroundColor: primaryColor, color: textoPrincipal, borderRadius: 'var(--radio-boton, 6px)', outlineColor: primaryColor }
              : {
                  border: '1px solid color-mix(in srgb, var(--text-color, #111827) 85%, transparent)',
                  borderRadius: 'var(--radio-boton, 6px)',
                  outlineColor: primaryColor,
                }
            const contenido = (
              <>
                <Icono className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{texto}</span>
              </>
            )
            return (
              <li key={accion} className="flex flex-1">
                {externo ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={clase} style={estilo}>
                    {contenido}
                  </a>
                ) : href.startsWith('tel:') ? (
                  <a href={href} className={clase} style={estilo}>
                    {contenido}
                  </a>
                ) : (
                  <Link href={href} className={clase} style={estilo}>
                    {contenido}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </>
  )
}
