import { getOrgContext } from '@/lib/get-org-context'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { CheckoutWizard } from '@/components/site/CheckoutWizard'
import { CurrencySelector } from '@/components/site/CurrencySelector'
import { CurrencyProvider } from '@/components/site/CurrencyProvider'
import { Metadata } from 'next'
import { getMetaPixelId, getGoogleAdsConfig, getDefaultTax, getOrganizationBranches } from '@/lib/supabase/queries'
import { getPixelesSitio } from '@/lib/seo/pixelesSitio'
import { sedePorDefectoPedido } from '@/lib/orders/pedidoWeb'
import { horarioSedeObligatorio, MENSAJE_PEDIDO_EN_LINEA_APAGADO, pedidoEnLineaApagado } from '@/lib/orders/disponibilidadPedido'
import { getDatosSedeLayout } from '@/lib/outlet/sedeLayout'
import { rutaSitio } from '@/lib/outlet/rutaSitio'
import { horarioDeSede, ZONA_POR_DEFECTO } from '@/lib/restaurant/horario'
import { MetaPixelInitiateCheckout } from '@/components/site/MetaPixelEvents'
import { PixelesSitio } from '@/components/site/PixelesSitio'
import { CartEventTracker } from '@/components/site/CartEventTracker'

export const dynamic = 'force-dynamic'

async function getWebsitePaymentMethods(organizationId: number) {
  const supabase = createAdminClient() || createPublicClient()

  // 1. Métodos de pago nativos (cash, transfer, card, etc.) habilitados para website
  const { data: orgMethods, error: orgError } = await (supabase as any)
    .from('organization_payment_methods')
    .select(`
      id, payment_method_code, is_active, show_on_website,
      website_display_order, website_display_name, website_description, website_icon,
      integration_connection_id,
      payment_methods (name, requires_reference)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('show_on_website', true)
    .order('website_display_order', { ascending: true, nullsFirst: false })

  const methods = (orgMethods || []).map((m: any) => ({
    code: m.payment_method_code,
    name: m.website_display_name || m.payment_methods?.name || m.payment_method_code,
    description: m.website_description || null,
    icon: m.website_icon || null,
    requiresReference: m.payment_methods?.requires_reference || false,
    connectionId: m.integration_connection_id || null,
    type: m.integration_connection_id ? 'gateway' as const : 'native' as const,
  }))

  // 2. Pasarelas de pago online (integration_connections activas/conectadas)
  // Solo agregar las que NO ya están en organization_payment_methods
  const existingConnectionIds = new Set(methods.filter((m: any) => m.connectionId).map((m: any) => m.connectionId))

  const { data: gateways } = await (supabase as any)
    .from('integration_connections')
    .select(`
      id, environment, status,
      integration_connectors!inner (code, name)
    `)
    .eq('organization_id', organizationId)
    .in('status', ['active', 'connected'])
    .in('integration_connectors.code', [
      'wompi_co', 'mp_checkout', 'payu_co', 'stripe_payments', 'paypal_checkout', 'bold_link'
    ])

  const gatewayMethods = (gateways || [])
    .filter((conn: any) => !existingConnectionIds.has(conn.id))
    .map((conn: any) => ({
      code: conn.integration_connectors.code,
      name: conn.integration_connectors.name,
      description: null,
      icon: null,
      requiresReference: false,
      connectionId: conn.id,
      type: 'gateway' as const,
    }))

  return [...methods, ...gatewayMethods]
}

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Checkout' }
  return {
    title: `Checkout | ${ctx.organization.name}`,
  }
}

export default async function CheckoutPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />

  const { organization, primaryColor, branchId, outlet, sedePorPrefijo } = ctx
  const isRestaurant = organization.type_id === 1
  const [paymentMethods, metaPixelId, googleAdsConfig, sucursales, datosSede, pixeles] = await Promise.all([
    getWebsitePaymentMethods(organization.id),
    getMetaPixelId(organization.id),
    getGoogleAdsConfig(organization.id),
    // Lista cacheada (SETTINGS_TTL); solo restaurante la usa para el horario y la banda de sede.
    isRestaurant ? getOrganizationBranches(organization.id) : Promise.resolve([]),
    // Sedes para «Cambiar sede» (SelectorSede de C, con el href de cada sede ya calculado) y el
    // aviso del carrito de otra sede. Mismas lecturas cacheadas que el layout de las demás páginas.
    isRestaurant ? getDatosSedeLayout(organization, outlet, (organization.website_settings as any) ?? null) : Promise.resolve(null),
    // Píxeles tipados de Analítica: de la fila del principal ya cacheada (sin consulta nueva).
    getPixelesSitio(organization.id),
  ])
  // Enlaces internos con el prefijo de la sede servida por ruta (contrato de C, rutaSitio).
  const ruta = (r: string) => rutaSitio(r, outlet, sedePorPrefijo)
  // Pedido en línea apagado (restaurante): la misma regla que el 403 de /api/orders, sobre los
  // ajustes efectivos de la petición (la sede gana a la global). En vez de dejar armar el pedido y
  // rechazarlo al final, se avisa aquí.
  const pedidoApagado = pedidoEnLineaApagado(isRestaurant, (organization.website_settings as any)?.enable_online_ordering)

  // Sede del pedido: la del sitio de sede o, en el sitio principal, la misma que elige
  // /api/orders (sedePorDefectoPedido). Su horario y su zona alimentan «¿Para cuándo?» con la
  // misma regla que valida el servidor.
  const listaSedes = (sucursales || []) as any[]
  const sedeFila = typeof branchId === 'number'
    ? listaSedes.find((b) => Number(b.id) === branchId) ?? null
    : sedePorDefectoPedido(listaSedes)
  const sedePedido = isRestaurant && sedeFila
    ? {
        id: Number(sedeFila.id),
        nombre: String(sedeFila.name || ''),
        direccion: sedeFila.address ? String(sedeFila.address) : null,
        // Solo con ORDERS_ENFORCE_BRANCH_HOURS: el checkout y /api/orders aplican el horario a la vez,
        // y los dos con horarioDeSede (el horario por defecto del ERP no restringe nada).
        horario: horarioSedeObligatorio() ? horarioDeSede(sedeFila.opening_hours) : null,
        zona: String(sedeFila.timezone || (organization as any).timezone || ZONA_POR_DEFECTO),
      }
    : null

  // Impuesto: solo si hay uno marcado como predeterminado (cacheado 300s)
  const defaultTax = await getDefaultTax(organization.id)

  // Shipping + delivery: desde tabla website_settings
  const supabaseWs = createAdminClient() || createPublicClient()
  const { data: wsRow } = await (supabaseWs as any)
    .from('website_settings')
    .select('checkout_mode, available_delivery_types, shipping_flat_rate, free_shipping_threshold, enable_shipping, tax_included, shipping_flat_rate_title, shipping_flat_rate_description, checkout_show_trust_badges, checkout_trust_badges, checkout_show_stock_warning, checkout_stock_warning_threshold, checkout_show_payment_logos, checkout_show_countdown, countdown_enabled, countdown_mode, countdown_end_date, countdown_timezone, countdown_reset_hour, countdown_title, countdown_show_in_cart, custom_scripts, analytics_id')
    .eq('organization_id', organization.id)
    // La fila global: con filas por sede, `.single()` sin este filtro fallaría y el checkout caería
    // a todos los valores por defecto.
    .is('branch_id', null)
    .maybeSingle()

  const checkoutSettings = {
    checkoutMode: (wsRow?.checkout_mode as 'steps' | 'one_page') || 'steps',
    taxRate: defaultTax ? Number(defaultTax.rate) : 0,
    taxName: defaultTax?.name || 'IVA',
    taxIncluded: defaultTax?.taxIncluded ?? wsRow?.tax_included ?? false,
    // 10000 y 100000 son los DEFAULT de las columnas (MCP 2026-10-06: ninguna fila en NULL). Solo
    // aplican sin fila de website_settings, y en ese caso resolverEnvio (servidor) no decide y
    // /api/orders conserva el envío del checkout: el cliente ve lo mismo que se cobra.
    shippingFlatRate: Number(wsRow?.shipping_flat_rate ?? 10000),
    freeShippingThreshold: Number(wsRow?.free_shipping_threshold ?? 100000),
    enableShipping: wsRow?.enable_shipping !== false,
    availableDeliveryTypes: wsRow?.available_delivery_types || ['pickup', 'delivery_own', 'delivery_third_party'],
    shippingTitle: wsRow?.shipping_flat_rate_title || 'Envío',
    shippingDescription: wsRow?.shipping_flat_rate_description || '',
    showTrustBadges: wsRow?.checkout_show_trust_badges ?? true,
    trustBadges: wsRow?.checkout_trust_badges || [{ icon: '🔒', text: 'Compra segura' }, { icon: '✅', text: 'Devolución garantizada' }, { icon: '🚚', text: 'Envío rastreado' }],
    showStockWarning: wsRow?.checkout_show_stock_warning ?? false,
    showPaymentLogos: wsRow?.checkout_show_payment_logos ?? true,
    showCountdown: wsRow?.checkout_show_countdown ?? false,
    countdownConfig: {
      countdown_enabled: wsRow?.countdown_enabled ?? false,
      countdown_mode: wsRow?.countdown_mode || 'daily_reset',
      countdown_end_date: wsRow?.countdown_end_date || '',
      countdown_timezone: wsRow?.countdown_timezone || 'America/Bogota',
      countdown_reset_hour: wsRow?.countdown_reset_hour ?? 0,
      countdown_title: wsRow?.countdown_title || '',
      countdown_show_in_cart: wsRow?.countdown_show_in_cart ?? false,
    },
  }

  const logoUrl = organization.logo_url
  const orgName = organization.name

  const showCurrencyCode = (organization.website_settings as any)?.show_currency_code ?? false
  const currencyPosition = (organization.website_settings as any)?.currency_position ?? 'left'

  return (
    <CurrencyProvider showCurrencyCode={showCurrencyCode} currencyPosition={currencyPosition}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mini header: logo + volver + moneda */}
      <header className="bg-white border-b py-2 md:py-3 px-4">
        <div className="container mx-auto flex items-center justify-between">
          <a href={ruta('/')} className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-4 md:h-4"><path d="m15 18-6-6 6-6"/></svg>
            Seguir comprando
          </a>
          <div className="flex items-center gap-2">
            {logoUrl && <img src={logoUrl} alt={orgName} className="h-8 md:h-12 w-auto" />}
            {!logoUrl && <span className="font-semibold text-gray-900 text-sm md:text-lg">{orgName}</span>}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <CurrencySelector primaryColor={primaryColor} compactClassName="px-1.5 py-1 text-xs md:px-2 md:py-1.5 md:text-sm" />
            <div className="flex items-center gap-1 text-[10px] md:text-xs text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-3.5 md:h-3.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Pago seguro
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-grow">
        {pedidoApagado ? (
          <div className="max-w-lg mx-auto text-center py-16 px-4" role="status">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No recibimos pedidos en línea</h1>
            <p className="text-gray-600 mb-8">{MENSAJE_PEDIDO_EN_LINEA_APAGADO}</p>
            <a
              href={ruta('/menu')}
              className="inline-block px-6 py-3 rounded-lg text-white font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Ver la carta
            </a>
          </div>
        ) : (
          <>
            <MetaPixelInitiateCheckout />
            <CheckoutWizard
              organizationId={organization.id}
              primaryColor={primaryColor}
              paymentMethods={paymentMethods}
              checkoutSettings={checkoutSettings}
              isRestaurant={isRestaurant}
              organizationSubdomain={organization.subdomain || ''}
              branchId={branchId}
              sedePedido={sedePedido}
              sedesSelector={datosSede?.sedesSelector ?? []}
              sedeActualId={datosSede?.sedeActualId ?? (typeof branchId === 'number' ? branchId : null)}
              prefijoSede={datosSede?.prefijoSede ?? ctx.prefijoSede ?? ''}
              rutaSeguirPidiendo={ruta(isRestaurant ? '/menu' : '/productos')}
            />
          </>
        )}
      </main>

      {/* Mini footer */}
      <footer className="bg-white border-t py-4 text-center text-xs text-gray-400">
        <p>&copy; {new Date().getFullYear()} {orgName}. Todos los derechos reservados.</p>
      </footer>

      {/* Tracking scripts. El checkout no usa OrganizationLayout, así que hay
          que repetir aquí lo que ese layout inyecta: sin `custom_scripts` las
          tiendas cuyo pixel vive ahí (y no en la integración Meta) no tenían
          pixel en /checkout y InitiateCheckout nunca se registraba. */}
      {/* Misma regla que el layout (lib/seo/reglaPixeles.ts): InitiateCheckout va al mismo píxel
          que la página del producto. Sin píxeles tipados, lo de antes: integración, scripts
          propios, Google Ads y GA4. */}
      <PixelesSitio
        pixeles={pixeles}
        integracion={{ metaPixelId, googleAds: googleAdsConfig }}
        customScripts={wsRow?.custom_scripts ?? null}
        analyticsId={wsRow?.analytics_id ?? null}
      />
      <CartEventTracker organizationSubdomain={organization.subdomain || ''} branchId={branchId} />
    </div>
    </CurrencyProvider>
  )
}
