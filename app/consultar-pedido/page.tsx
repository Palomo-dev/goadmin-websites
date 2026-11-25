import { Metadata } from 'next'
import { headers } from 'next/headers'
import { getOrgContext } from '@/lib/get-org-context'
import { getShipmentByTracking } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { enlaceWhatsapp } from '@/lib/website/ajustesSitio'
import { checkRateLimit, ipDeCabeceras } from '@/lib/rateLimit'
import { normalizarGuia, pareceNumeroPedido, vistaGuiaPublica, type ConsultaGuia } from '@/lib/orders/consultaGuia'
import { SeguirPedido } from './SeguirPedido'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  return {
    title: ctx ? `Consultar pedido | ${ctx.organization.name}` : 'Consultar pedido',
    robots: { index: false, follow: false },
  }
}

/** Búsquedas por guía permitidas por IP y por tienda en la ventana (decisión D del Figma G4). */
const GUIAS_POR_VENTANA = 20
const VENTANA_GUIAS_MS = 10 * 60 * 1000

/**
 * Consultar pedido (Figma «16 Sitio web» › Consultar pedido v2, 3102:84056, aprobado 2026-11-24).
 * Una sola página: /rastrear y /tracking redirigen aquí conservando la búsqueda.
 * - «Número de pedido» + correo o teléfono de la compra → /api/cuenta/buscar-pedido (organización
 *   del host, mismo mensaje si no existe o no coincide, límite por IP y por número) → el pedido se
 *   muestra en esta misma página con su token de seguimiento.
 * - «Número de guía» (Figma 3240:97997, aprobado 2026-11-25) → `?guia=<n>`, buscada aquí con la
 *   organización del host: el número impreso en la guía (DEL-…), la guía de la transportadora o el
 *   TRK viejo (que nunca se muestra). Lo que llega a la pantalla es `vistaGuiaPublica`: sin
 *   dirección, nombre ni teléfonos, sin código de entrega y sin montos.
 *
 * Límite de intentos: la búsqueda ocurre en este server component (no en un route handler), así
 * que el límite se aplica aquí mismo, antes de consultar la base: 20 por 10 minutos por IP y
 * tienda, con la IP de `headers()` y el mismo limitador de /api/cuenta/buscar-pedido. Se eligió
 * dejarlo aquí y no mover la búsqueda a un route handler porque así la guía sigue funcionando con
 * los enlaces viejos (`/tracking?q=`, `/rastrear?guia=`) y sin JavaScript.
 * Mismo mensaje si la guía no existe o es de otra tienda (la consulta filtra por la organización).
 */
export default async function ConsultarPedidoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, effectiveSettings } = ctx

  const params = await searchParams
  const guiaEscrita = typeof params.guia === 'string' ? params.guia.trim().slice(0, 80) : ''
  const numeroInicial = typeof params.numero === 'string' ? params.numero.trim().slice(0, 60) : ''
  const modo = guiaEscrita || params.modo === 'guia' ? 'guia' : 'pedido'

  let consulta: ConsultaGuia | null = null
  if (guiaEscrita) {
    const guia = normalizarGuia(guiaEscrita)
    const ip = ipDeCabeceras(await headers())
    if (!checkRateLimit(`consultar-guia:${organization.id}:${ip}`, GUIAS_POR_VENTANA, VENTANA_GUIAS_MS).allowed) {
      consulta = { tipo: 'muchas' }
    } else if (!guia) {
      consulta = { tipo: 'no_encontrada' }
    } else {
      // La organización se pasa siempre: sin ella, este sitio rastrearía guías de cualquier otra.
      const zonaOrg = (organization as { timezone?: string | null }).timezone ?? null
      const datos = await getShipmentByTracking(guia, organization.id, zonaOrg)
      if (datos === 'error') consulta = { tipo: 'error' }
      else if (datos) consulta = { tipo: 'encontrada', vista: vistaGuiaPublica(datos) }
      else {
        const numero = pareceNumeroPedido(guiaEscrita)
        consulta = numero ? { tipo: 'parece_pedido', numero } : { tipo: 'no_encontrada' }
      }
    }
  }

  const numeroWhatsapp = (effectiveSettings as Record<string, unknown> | null)?.whatsapp_number
  const hayWhatsapp = typeof numeroWhatsapp === 'string' && numeroWhatsapp.replace(/\D/g, '').length >= 7
  const whatsapp = hayWhatsapp
    ? enlaceWhatsapp({ numero: numeroWhatsapp as string, saludo: 'Hola, no encuentro mi pedido.' })
    : null
  const whatsappGuia = hayWhatsapp && consulta?.tipo === 'encontrada'
    ? enlaceWhatsapp({ numero: numeroWhatsapp as string, saludo: `Hola, quiero saber de mi envío con la guía ${consulta.vista.numeroGuia}.` })
    : null
  const telefono = typeof organization.phone === 'string' && organization.phone.replace(/\D/g, '').length >= 7 ? organization.phone : null

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="bg-slate-50" style={{ ['--primary-color' as string]: primaryColor }}>
        <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-5 md:pt-10">
          <SeguirPedido
            modoInicial={modo}
            guiaInicial={guiaEscrita}
            numeroInicial={numeroInicial}
            consultaGuia={consulta}
            whatsapp={whatsapp}
            whatsappGuia={whatsappGuia}
            telefonoTienda={telefono}
            primaryColor={primaryColor}
            rutaSeguirPidiendo={organization.type_id === 1 ? '/menu' : '/productos'}
          />
        </div>
      </div>
    </OrganizationLayout>
  )
}
