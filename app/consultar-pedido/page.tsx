import { Metadata } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { getShipmentByTracking } from '@/lib/supabase/queries'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { ResultadoGuia } from '@/components/site/rastreo/ResultadoGuia'
import { enlaceWhatsapp } from '@/lib/website/ajustesSitio'
import { SeguirPedido } from './SeguirPedido'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  return {
    title: ctx ? `Consultar pedido | ${ctx.organization.name}` : 'Consultar pedido',
    robots: { index: false, follow: false },
  }
}

/**
 * Consultar pedido (Figma «16 Sitio web» › Consultar pedido v2, 3102:84056, aprobado 2026-11-24).
 * Una sola página: /rastrear y /tracking redirigen aquí conservando la búsqueda.
 * - «Número de pedido» + correo o teléfono de la compra → /api/cuenta/buscar-pedido (organización
 *   del host, mismo mensaje si no existe o no coincide, límite por IP y por número) → el pedido se
 *   muestra en esta misma página con su token de seguimiento.
 * - «Guía de transportadora» → `?guia=<n>`, buscada aquí con la organización del host.
 * Antes esta página buscaba por correo solo y listaba hasta 10 pedidos con datos personales
 * (/api/orders/lookup, retirado: responde 410).
 */
export default async function ConsultarPedidoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, primaryColor, template, headerNav, footerNav, frozenReason, effectiveSettings } = ctx

  const params = await searchParams
  const guia = typeof params.guia === 'string' ? params.guia.trim().slice(0, 80) : ''
  const modo = guia || params.modo === 'guia' ? 'guia' : 'pedido'
  // La organización se pasa siempre: sin ella, este sitio rastrearía guías de cualquier otra.
  const envio = guia ? await getShipmentByTracking(guia, organization.id) : null
  const numeroWhatsapp = (effectiveSettings as Record<string, unknown> | null)?.whatsapp_number
  const whatsapp = typeof numeroWhatsapp === 'string' && numeroWhatsapp.replace(/\D/g, '').length >= 7
    ? enlaceWhatsapp({ numero: numeroWhatsapp, saludo: 'Hola, no encuentro mi pedido.' })
    : null

  return (
    <OrganizationLayout organization={organization} template={template} primaryColor={primaryColor} headerNav={headerNav} footerNav={footerNav} frozenReason={frozenReason}>
      <div className="bg-slate-50" style={{ ['--primary-color' as string]: primaryColor }}>
        <div className="mx-auto w-full max-w-5xl px-5 pb-12 pt-5 md:pt-10">
          <SeguirPedido
            modoInicial={modo}
            guiaInicial={guia}
            whatsapp={whatsapp}
            primaryColor={primaryColor}
            rutaSeguirPidiendo={organization.type_id === 1 ? '/menu' : '/productos'}
          >
            {guia ? <ResultadoGuia trackingNumber={guia} shipment={envio} primaryColor={primaryColor} /> : null}
          </SeguirPedido>
        </div>
      </div>
    </OrganizationLayout>
  )
}
