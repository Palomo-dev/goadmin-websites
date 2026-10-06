import { headers } from 'next/headers'
import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Clock, MapPin, Phone, Users } from 'lucide-react'
import { getOrganizationByHost, getWebsiteFooterNav, getWebsiteHeaderNav, getMetaPixelId } from '@/lib/supabase/queries'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { checkFrozenStatus } from '@/lib/get-org-context'
import { OrganizationLayout } from '@/components/site/OrganizationLayout'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { createAdminClient } from '@/lib/supabase/server'
import { fechaLarga, horaEnZona, hoyEnZona } from '@/lib/restaurant/horario'
import { tokenValido } from '@/lib/restaurant/reservas-errores'
import { leerReservaPorToken } from '@/lib/restaurant/reservas-servidor'
import { CancelarReservaMesa } from './CancelarReservaMesa'

export const dynamic = 'force-dynamic'

/**
 * «Consultar o cancelar tu reserva» (paquete D, captura 21 del plan).
 *
 * Se llega por el enlace del correo o de la confirmación: `/reserva/mesa/<token>`.
 * La organización sale del HOST y la reserva se busca por token Y organización
 * (`leerReservaPorToken`, la misma lectura que la API). Fecha y hora son de la
 * sede; el plazo para cancelar se calcula en su zona. Para modificarla, el
 * contacto de la sede.
 */

async function getOrg() {
  const h = await headers()
  const identifier = h.get('x-custom-domain') || h.get('x-subdomain')
  if (!identifier) return null
  return getOrganizationByHost(identifier)
}

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrg()
  return { title: org ? `Tu reserva | ${org.name}` : 'Tu reserva', robots: { index: false, follow: false } }
}

const ETIQUETAS: Record<string, { texto: string; clase: string }> = {
  pending: { texto: 'Pendiente de confirmación', clase: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  confirmed: { texto: 'Confirmada', clase: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200' },
  seated: { texto: 'En la mesa', clase: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  completed: { texto: 'Completada', clase: 'bg-muted text-foreground' },
  cancelled: { texto: 'Cancelada', clase: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200' },
  no_show: { texto: 'No se presentó', clase: 'bg-muted text-foreground' },
}

function enlaceWhatsApp(telefono: string | null): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (digitos.length < 7) return null
  return `https://wa.me/${digitos.length === 10 ? `57${digitos}` : digitos}`
}

export default async function ReservaMesaPage({ params }: { params: Promise<{ token: string }> }) {
  const org = await getOrg()
  if (!org) return <NotFoundPage />
  const { token } = await params

  const supabase = createAdminClient()
  const reserva = supabase && tokenValido(token) ? await leerReservaPorToken(supabase, org.id, token) : null

  const primaryColor = org.website_settings?.primary_color || org.primary_color || '#8B6914'
  const templateId = org.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(org.type_id)
  const frozenReason = await checkFrozenStatus(org.id, org.status)
  const [headerNav, footerNav, metaPixelId] = await Promise.all([
    getWebsiteHeaderNav(org.id),
    getWebsiteFooterNav(org.id),
    getMetaPixelId(org.id),
  ])

  const estado = reserva ? ETIQUETAS[reserva.status] ?? { texto: reserva.status, clase: 'bg-muted' } : null
  const limite = reserva ? new Date(reserva.cancelableHasta) : null
  const limiteTexto =
    reserva && limite
      ? `${fechaLarga(hoyEnZona(reserva.zonaHoraria, limite))} a las ${horaEnZona(limite, reserva.zonaHoraria) ?? ''}`
      : null
  const telefono = reserva?.sede?.telefono ?? null
  const whatsapp = enlaceWhatsApp(telefono)

  return (
    <OrganizationLayout
      organization={org}
      template={template}
      primaryColor={primaryColor}
      headerNav={headerNav}
      footerNav={footerNav}
      metaPixelId={metaPixelId}
      frozenReason={frozenReason}
    >
      <main className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
        {!reserva ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
              No encontramos esta reserva
            </h1>
            <p className="mt-2 text-muted-foreground">
              Revisa que el enlace esté completo. Si el problema sigue, escríbenos.
            </p>
            <Link href="/" className="mt-6 inline-block underline underline-offset-4">
              Volver al inicio
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${estado?.clase}`}>{estado?.texto}</span>
              <h1 className="text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>
                Tu reserva en {org.name}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">Código {reserva.code}</p>
            </div>

            <dl className="space-y-3 rounded-xl bg-muted p-5 text-sm">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Día</dt>
                <dd className="font-medium">{fechaLarga(reserva.date)}</dd>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Hora</dt>
                <dd className="font-medium">{reserva.time}</dd>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <dt className="sr-only">Personas</dt>
                <dd className="font-medium">
                  {reserva.partySize} {reserva.partySize === 1 ? 'persona' : 'personas'} · a nombre de {reserva.customerName}
                </dd>
              </div>
              {reserva.sede && (
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Sede</dt>
                  <dd>
                    <span className="font-medium">{reserva.sede.nombre}</span>
                    {reserva.sede.direccion && <span className="block text-muted-foreground">{reserva.sede.direccion}</span>}
                  </dd>
                </div>
              )}
            </dl>

            {reserva.status === 'cancelled' ? (
              <p className="text-center text-sm text-muted-foreground">Esta reserva está cancelada.</p>
            ) : reserva.puedeCancelar ? (
              <div className="flex flex-col gap-2">
                <CancelarReservaMesa token={token} primaryColor={primaryColor} />
                {limiteTexto && (
                  <p className="text-center text-xs text-muted-foreground">Puedes cancelar hasta el {limiteTexto}.</p>
                )}
              </div>
            ) : ['pending', 'confirmed'].includes(reserva.status) ? (
              <p className="text-center text-sm text-muted-foreground">
                Ya pasó el plazo para cancelar en línea ({reserva.horasCancelacion} h antes). Escríbenos si no puedes venir.
              </p>
            ) : null}

            {(telefono || whatsapp) && ['pending', 'confirmed'].includes(reserva.status) && (
              <div className="flex flex-col items-center gap-2 border-t border-border pt-6 text-sm">
                <p className="text-muted-foreground">¿Quieres cambiar la hora o el número de personas?</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {whatsapp && (
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                      Escribir por WhatsApp
                    </a>
                  )}
                  {telefono && (
                    <a href={`tel:${telefono.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 underline underline-offset-4">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                      Llamar
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </OrganizationLayout>
  )
}
