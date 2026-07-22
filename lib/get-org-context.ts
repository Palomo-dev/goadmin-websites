import { headers } from 'next/headers'
import {
  getOrganizationByHost,
  getWebsiteHeaderNav,
  getWebsiteFooterNav
} from '@/lib/supabase/queries'
import { getTemplate, getTemplateByBusinessType } from '@/lib/templates'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

export type FrozenReason = 'trial_expired' | 'suspended' | 'deleted' | 'payment_failed' | 'canceled' | null

export async function getOrgContext() {
  const headersList = await headers()
  const subdomain = headersList.get('x-subdomain')
  const customDomain = headersList.get('x-custom-domain')
  const identifier = customDomain || subdomain

  if (!identifier) return null

  const organization = await getOrganizationByHost(identifier)
  if (!organization) return null

  const primaryColor = organization.website_settings?.primary_color || organization.primary_color || '#3B82F6'
  const templateId = organization.website_settings?.template_id || 'modern'
  const template = getTemplate(templateId) || getTemplateByBusinessType(organization.type_id)

  const [headerNav, footerNav] = await Promise.all([
    getWebsiteHeaderNav(organization.id),
    getWebsiteFooterNav(organization.id)
  ])

  // Verificar estado de congelación de la organización
  const frozenReason = await checkFrozenStatus(organization.id, organization.status)

  return { organization, primaryColor, template, headerNav, footerNav, frozenReason }
}

export async function checkFrozenStatus(orgId: number, orgStatus: string | null): Promise<FrozenReason> {
  // Si la organización está suspendida o eliminada, está congelada
  if (orgStatus === 'suspended') return 'suspended'
  if (orgStatus === 'deleted') return 'deleted'

  // Consultar el estado de la suscripción
  const supabase = createAdminClient() || createPublicClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, trial_end, current_period_end')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { status: string; trial_end: string | null; current_period_end: string | null } | null }

  if (!sub) return null

  const now = new Date()

  // Si el trial expiró
  if (sub.status === 'trialing' && sub.trial_end) {
    const trialEnd = new Date(sub.trial_end)
    if (trialEnd < now) return 'trial_expired'
  }

  // Si el pago falló (past_due)
  if (sub.status === 'past_due') return 'payment_failed'

  // Si la suscripción fue cancelada
  if (sub.status === 'canceled') return 'canceled'

  // Si está activa o en trial válido, no está congelada
  return null
}
