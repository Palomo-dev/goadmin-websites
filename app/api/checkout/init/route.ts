import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'
import { getOrder, organizacionDelPedido } from '@/lib/checkout/pedido-web'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { checkRateLimit, getClientIP } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// Connector IDs
const CONNECTOR_IDS: Record<string, string> = {
  wompi_co: '39950173-5f7c-48a9-a242-c6fdf5a07aee',
  wompi: '39950173-5f7c-48a9-a242-c6fdf5a07aee',
  mp_checkout: 'b00cfe3f-efa6-4656-93da-f42bf3073ab4',
  payu_co: 'dc652aa4-5146-45cc-9df7-f58c7098ad00',
  stripe_payments: 'a2b84a76-9557-4fee-88ba-8ee517ed8b88',
  paypal_checkout: '944c6b76-e8bf-49f9-90ea-06f906e152e7',
  bold_link: '6d732ae3-e9ff-41be-9d75-aa29ba86d927',
}

// Mapeo de payment_method_code → gateway code para el switch de pasarela
const GATEWAY_CODE_MAP: Record<string, string> = {
  wompi: 'wompi_co',
  card: 'wompi_co',
}

/**
 * Obtiene credenciales de una conexión de pasarela.
 * Busca en integration_credentials y opcionalmente en Vault.
 */
async function getCredentials(
  supabase: any,
  connectionId: string
): Promise<Record<string, string>> {
  const { data: credentials } = await supabase
    .from('integration_credentials')
    .select('credential_type, secret_ref, purpose')
    .eq('connection_id', connectionId)
    .eq('status', 'active')

  if (!credentials || credentials.length === 0) return {}

  const result: Record<string, string> = {}

  for (const cred of credentials) {
    const key = cred.purpose || cred.credential_type
    let value = cred.secret_ref

    // Intentar leer del Vault de Supabase
    try {
      const { data: secret } = await supabase
        .rpc('get_decrypted_secret', { secret_name: cred.secret_ref })
      if (secret) value = secret
    } catch {
      // Vault no disponible — usar secret_ref directamente
    }

    result[key] = value
  }

  return result
}

/**
 * Obtiene una reservación por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
async function getReservation(supabase: any, reservationId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .select('id, organization_id, total_estimated, status, metadata, customer_id')
    .eq('id', reservationId)
    .single()

  if (error || !data) return null

  // Generar referencia corta para la pasarela: RES-{primeros 8 chars del UUID}
  const shortRef = `RES-${data.id.substring(0, 8).toUpperCase()}`

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: Number(data.total_estimated),
    currency: 'COP',
    status: data.status,
    payment_status: data.status === 'confirmed' ? 'paid' : 'pending',
    customer_email: data.metadata?.customer_email || '',
    customer_name: data.metadata?.customer_name || '',
    _source: 'reservation' as const,
  }
}

/**
 * Genera URL de checkout para Wompi Colombia
 */
async function buildWompiCheckoutUrl(
  creds: Record<string, string>,
  order: any,
  returnUrl: string,
  environment: string
): Promise<string> {
  const publicKey = creds.public_key || ''
  const integritySecret = creds.integrity_secret || ''
  const amountInCents = Math.round(Number(order.total) * 100)
  const currency = order.currency || 'COP'
  const reference = order.order_number

  // Generar firma de integridad: SHA256(reference + amountInCents + currency + integritySecret)
  const { createHash } = await import('crypto')
  const signatureString = `${reference}${amountInCents}${currency}${integritySecret}`
  const signature = createHash('sha256').update(signatureString).digest('hex')

  // Wompi checkout URL — construir manualmente para evitar que URLSearchParams
  // codifique el ':' en 'signature:integrity' como %3A
  const baseUrl = 'https://checkout.wompi.co/p/'

  const params = new URLSearchParams({
    'public-key': publicKey,
    'currency': currency,
    'amount-in-cents': String(amountInCents),
    'reference': reference,
    'redirect-url': `${returnUrl}?ref=${reference}`,
  })

  // Pre-llenar datos del cliente (Wompi usa parámetros customer-data:*)
  // Nota: URLSearchParams codifica ':' como %3A, pero Wompi requiere ':' literal.
  // Por eso construimos los parámetros customer-data:* manualmente.
  const fullName = (order.customer_name || '').trim()
  const email = (order.customer_email || '').trim()
  const rawPhone = (order.customer_phone || '').trim()
  const city = (order.customer_city || '').trim()
  const street = (order.customer_address || '').trim()

  // Wompi requiere phone-number y phone-number-prefix por separado:
  // phone-number-prefix = "+57" (prefijo internacional con +)
  // phone-number = "3001234567" (número sin prefijo, sin +)
  let phoneNumber = ''
  let phonePrefix = ''
  if (rawPhone) {
    const phoneMatch = rawPhone.match(/^(\+\d{1,4})\s?(\d[\d\s]*)$/)
    if (phoneMatch) {
      phonePrefix = phoneMatch[1] // ej: "+57"
      phoneNumber = phoneMatch[2].replace(/\D/g, '') // ej: "3001234567"
    } else {
      // Sin prefijo: asumir Colombia (+57) si el número tiene 10 dígitos
      const digits = rawPhone.replace(/\D/g, '')
      if (digits.length === 10) {
        phonePrefix = '+57'
        phoneNumber = digits
      } else if (digits.length > 10) {
        // Probablemente incluye el código de país: los últimos 10 son el número
        phonePrefix = `+${digits.slice(0, -10)}`
        phoneNumber = digits.slice(-10)
      } else {
        phoneNumber = digits
      }
    }
  }

  const customerParams: string[] = []
  if (email) customerParams.push(`customer-data:email=${encodeURIComponent(email)}`)
  if (fullName) customerParams.push(`customer-data:full-name=${encodeURIComponent(fullName)}`)
  if (phoneNumber) {
    customerParams.push(`customer-data:phone-number=${phoneNumber}`)
    if (phonePrefix) customerParams.push(`customer-data:phone-number-prefix=${encodeURIComponent(phonePrefix)}`)
  }
  if (city) customerParams.push(`customer-data:city=${encodeURIComponent(city)}`)
  if (street) customerParams.push(`customer-data:street=${encodeURIComponent(street)}`)

  // Agregar signature:integrity y customer-data con ':' literal (Wompi no acepta %3A)
  const customerQuery = customerParams.length > 0 ? '&' + customerParams.join('&') : ''
  const finalUrl = `${baseUrl}?${params.toString()}${customerQuery}&signature:integrity=${signature}`
  console.log('[Wompi Checkout URL] phone raw:', rawPhone, '| prefix:', phonePrefix, '| number:', phoneNumber, '| full URL:', finalUrl)
  return finalUrl
}

/**
 * Crea una preferencia de pago en MercadoPago y retorna init_point
 */
async function buildMercadoPagoCheckout(
  creds: Record<string, string>,
  order: any,
  returnUrl: string
): Promise<string | null> {
  const accessToken = creds.access_token || ''

  // Construir payer con datos del cliente para pre-llenar el checkout
  const fullName = (order.customer_name || '').trim()
  const nameParts = fullName.split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  const email = (order.customer_email || '').trim()
  const phone = (order.customer_phone || '').trim()
  // Teléfono CO: 10 dígitos, área 57 + número sin leading 0
  const phoneArea = phone.length >= 10 ? '57' : ''
  const phoneNumber = phone.replace(/\D/g, '')

  const payer: any = {}
  if (email) payer.email = email
  if (firstName) payer.name = firstName
  if (lastName) payer.surname = lastName
  if (phoneNumber) {
    payer.phone = { number: phoneNumber }
    if (phoneArea) payer.phone.area_code = phoneArea
  }

  const preference: any = {
    items: [{
      title: `Pedido ${order.order_number}`,
      quantity: 1,
      unit_price: Number(order.total),
      currency_id: 'COP',
    }],
    external_reference: order.order_number,
    back_urls: {
      success: `${returnUrl}?ref=${order.order_number}&status=approved`,
      failure: `${returnUrl}?ref=${order.order_number}&status=failed`,
      pending: `${returnUrl}?ref=${order.order_number}&status=pending`,
    },
    auto_return: 'approved',
    notification_url: undefined, // Se configura en el dashboard de MP
  }

  // Solo agregar payer si hay al menos un dato
  if (Object.keys(payer).length > 0) {
    preference.payer = payer
  }

  try {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const data = await res.json()
    return data.init_point || data.sandbox_init_point || null
  } catch (error) {
    console.error('[Checkout Init] MercadoPago error:', error)
    return null
  }
}

/**
 * Crea un Checkout Session en Stripe y retorna la URL
 */
async function buildStripeCheckout(
  creds: Record<string, string>,
  order: any,
  returnUrl: string
): Promise<string | null> {
  const secretKey = creds.secret_key || ''

  try {
    const params = new URLSearchParams()
    params.append('payment_method_types[0]', 'card')
    params.append('line_items[0][price_data][currency]', 'cop')
    params.append('line_items[0][price_data][unit_amount]', String(Math.round(Number(order.total) * 100)))
    params.append('line_items[0][price_data][product_data][name]', `Pedido ${order.order_number}`)
    params.append('line_items[0][quantity]', '1')
    params.append('mode', 'payment')
    params.append('success_url', `${returnUrl}?ref=${order.order_number}&status=approved`)
    params.append('cancel_url', `${returnUrl}?ref=${order.order_number}&status=cancelled`)
    params.append('metadata[order_number]', order.order_number)
    params.append('customer_email', order.customer_email || '')

    // Pre-llenar datos del cliente en metadata (Stripe usa customer_email para email)
    const fullName = (order.customer_name || '').trim()
    const phone = (order.customer_phone || '').trim()
    if (fullName) params.append('metadata[customer_name]', fullName)
    if (phone) {
      params.append('metadata[customer_phone]', phone)
      params.append('phone', phone)
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await res.json()
    return data.url || null
  } catch (error) {
    console.error('[Checkout Init] Stripe error:', error)
    return null
  }
}

/**
 * Genera form data para PayU WebCheckout
 */
function buildPayUCheckoutUrl(
  creds: Record<string, string>,
  order: any,
  returnUrl: string,
  environment: string
): string {
  const merchantId = creds.merchant_id || ''
  const accountId = creds.account_id || ''
  const apiKey = creds.api_key || ''
  const amount = String(Number(order.total).toFixed(2))
  const reference = order.order_number
  const currency = 'COP'

  // PayU WebCheckout URL
  const baseUrl = environment === 'sandbox'
    ? 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/'
    : 'https://checkout.payulatam.com/ppp-web-gateway-payu/'

  // Firma MD5: apiKey~merchantId~referenceCode~amount~currency
  // Se genera en el cliente o servidor. Para redirect, construimos la URL con parámetros.
  const signatureString = `${apiKey}~${merchantId}~${reference}~${amount}~${currency}`

  // MD5 usando Web Crypto no está disponible directamente; usamos simple hash
  // Para PayU, el form se auto-submits desde el frontend
  const params = new URLSearchParams({
    merchantId,
    accountId,
    description: `Pedido ${reference}`,
    referenceCode: reference,
    amount,
    currency,
    buyerEmail: order.customer_email || '',
    responseUrl: `${returnUrl}?ref=${reference}`,
    confirmationUrl: `${new URL(returnUrl).origin}/api/webhooks/payu`,
  })

  // Pre-llenar datos del comprador en PayU WebCheckout
  const fullName = (order.customer_name || '').trim()
  const phone = (order.customer_phone || '').trim()
  if (fullName) params.append('buyerFullName', fullName)
  if (phone) params.append('telephone', phone)
  if (order.customer_address) params.append('shippingAddress', order.customer_address)
  if (order.customer_city) params.append('shippingCity', order.customer_city)
  if (order.customer_city) params.append('buyerCity', order.customer_city)

  return `${baseUrl}?${params.toString()}`
}

/**
 * Crea una orden en PayPal y retorna el approve link
 */
async function buildPayPalCheckout(
  creds: Record<string, string>,
  order: any,
  returnUrl: string,
  environment: string
): Promise<string | null> {
  const clientId = creds.client_id || ''
  const clientSecret = creds.client_secret || ''

  const baseUrl = environment === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

  try {
    // 1. Obtener access token
    const authRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    const authData = await authRes.json()
    const accessToken = authData.access_token

    if (!accessToken) return null

    // 2. Crear orden (PayPal usa USD, convertir si es COP)
    // Por ahora pasamos el total como está — la org debe configurar USD
    const totalStr = Number(order.total).toFixed(2)

    // Pre-llenar datos del pagador
    const fullName = (order.customer_name || '').trim()
    const nameParts = fullName.split(' ')
    const givenName = nameParts[0] || ''
    const surname = nameParts.slice(1).join(' ') || ''
    const email = (order.customer_email || '').trim()
    const phone = (order.customer_phone || '').replace(/\D/g, '')

    const payer: any = {}
    if (email) payer.email_address = email
    if (givenName || surname) {
      payer.name = {}
      if (givenName) payer.name.given_name = givenName
      if (surname) payer.name.surname = surname
    }
    if (phone) {
      payer.phone = { phone_number: { national_number: phone } }
    }
    if (order.customer_address || order.customer_city) {
      payer.address = {}
      if (order.customer_address) payer.address.address_line_1 = order.customer_address
      if (order.customer_city) payer.address.admin_area_2 = order.customer_city
      payer.address.country_code = 'CO'
    }

    const orderPayload: any = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.order_number,
        custom_id: order.order_number,
        amount: {
          currency_code: 'USD',
          value: totalStr,
        },
        description: `Pedido ${order.order_number}`,
      }],
      application_context: {
        return_url: `${returnUrl}?ref=${order.order_number}&status=approved`,
        cancel_url: `${returnUrl}?ref=${order.order_number}&status=cancelled`,
        brand_name: order.customer_name || 'Tienda',
        user_action: 'PAY_NOW',
      },
    }

    // Solo agregar payer si hay al menos un dato
    if (Object.keys(payer).length > 0) {
      orderPayload.payer = payer
    }

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    })

    const orderData = await orderRes.json()
    const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')
    return approveLink?.href || null
  } catch (error) {
    console.error('[Checkout Init] PayPal error:', error)
    return null
  }
}

/**
 * Crea los parámetros para el Botón de Pagos de Bold (checkout hosted).
 * Genera la firma de integridad server-side y devuelve una URL a /checkout/bold
 * con todos los parámetros necesarios, incluyendo datos del cliente pre-llenados.
 */
async function buildBoldCheckout(
  creds: Record<string, string>,
  order: any,
  returnUrl: string
): Promise<string | null> {
  const identityKey = creds.identity_key || ''
  const secretKey = creds.secret_key || ''

  const amount = Math.round(Number(order.total))
  const reference = order.order_number
  const currency = order.currency || 'COP'
  const description = `Pedido ${reference}`

  // Generar firma de integridad: SHA256(reference + amount + currency + secretKey)
  const { createHash } = await import('crypto')
  const signatureString = `${reference}${amount}${currency}${secretKey}`
  const integritySignature = createHash('sha256').update(signatureString).digest('hex')

  // Datos del cliente para pre-llenar el formulario de Bold
  const fullName = (order.customer_name || '').trim()
  const email = (order.customer_email || '').trim()
  const phone = (order.customer_phone || '').replace(/\D/g, '')

  const customerData: Record<string, string> = {}
  if (email) customerData.email = email
  if (fullName) customerData.fullName = fullName
  if (phone) {
    customerData.phone = phone
    customerData.dialCode = '+57'
  }

  // Datos de facturación/dirección
  const billingAddress: Record<string, string> = {}
  if (order.customer_address) billingAddress.address = order.customer_address
  if (order.customer_city) billingAddress.city = order.customer_city
  billingAddress.country = 'CO'

  // Construir URL a nuestra página intermedia /checkout/bold
  const params = new URLSearchParams({
    apiKey: identityKey,
    orderId: reference,
    amount: String(amount),
    currency,
    description,
    integritySignature,
    redirectionUrl: `${returnUrl}?ref=${reference}`,
  })

  if (Object.keys(customerData).length > 0) {
    params.append('customerData', JSON.stringify(customerData))
  }
  if (Object.keys(billingAddress).length > 0) {
    params.append('billingAddress', JSON.stringify(billingAddress))
  }

  return `/checkout/bold?${params.toString()}`
}

/**
 * Obtiene un ticket de transporte por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
async function getTripTicket(supabase: any, ticketId: string) {
  const { data, error } = await supabase
    .from('trip_tickets')
    .select('id, organization_id, ticket_number, passenger_name, passenger_email, total, currency, status, payment_status')
    .eq('id', ticketId)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: data.ticket_number,
    total: Number(data.total || 0),
    currency: data.currency || 'COP',
    status: data.status,
    payment_status: data.payment_status === 'paid' ? 'paid' : 'pending',
    customer_email: data.passenger_email || '',
    customer_name: data.passenger_name || '',
    _source: 'trip_ticket' as const,
  }
}

/**
 * Obtiene un pase de parking por ID para generar pago.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
async function getParkingPass(supabase: any, passId: string) {
  const { data, error } = await supabase
    .from('parking_passes')
    .select('id, organization_id, customer_id, plan_name, price, status')
    .eq('id', passId)
    .single()

  if (error || !data) return null

  const shortRef = `PKP-${data.id.substring(0, 8).toUpperCase()}`

  // Buscar email del customer
  const { data: customer } = await supabase
    .from('customers')
    .select('email, first_name, last_name')
    .eq('id', data.customer_id)
    .single()

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: Number(data.price || 0),
    currency: 'COP',
    status: data.status,
    payment_status: data.status === 'active' ? 'paid' : 'pending',
    customer_email: customer?.email || '',
    customer_name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
    _source: 'parking_pass' as const,
  }
}

/**
 * Obtiene una factura pendiente por ID para generar pago online.
 * Devuelve un objeto compatible con la interfaz de "order" para las pasarelas.
 */
async function getInvoice(supabase: any, invoiceId: string) {
  const { data, error } = await supabase
    .from('invoice_sales')
    .select('id, organization_id, customer_id, number, total, balance, currency, status')
    .eq('id', invoiceId)
    .single()

  if (error || !data) return null

  // Solo facturas con balance pendiente
  const balance = Number(data.balance || 0)
  if (balance <= 0) return null

  const shortRef = `INV-${data.number || data.id.substring(0, 8).toUpperCase()}`

  const { data: customer } = await supabase
    .from('customers')
    .select('email, first_name, last_name')
    .eq('id', data.customer_id)
    .single()

  return {
    id: data.id,
    organization_id: data.organization_id,
    order_number: shortRef,
    total: balance,
    currency: data.currency || 'COP',
    status: data.status,
    payment_status: ['paid', 'cancelled'].includes(data.status) ? 'paid' : 'pending',
    customer_email: customer?.email || '',
    customer_name: `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim(),
    _source: 'invoice' as const,
  }
}

/** Respuesta 429 de esta ruta (mismo criterio que /api/orders). */
function demasiadosIntentos() {
  return NextResponse.json(
    { error: 'Recibimos demasiados intentos de pago seguidos. Espera unos minutos e inténtalo de nuevo.', code: 'DEMASIADOS_INTENTOS' },
    { status: 429 }
  )
}

/** 403 cuando el host pide cobrar algo de otra organización. Se registra. */
function organizacionAjena(detalle: Record<string, unknown>) {
  console.warn('[Checkout Init] El cobro pedido es de otra organización que la del host', detalle)
  return NextResponse.json(
    { error: 'Este pago no corresponde a este sitio' },
    { status: 403 }
  )
}

/**
 * POST /api/checkout/init
 *
 * Recibe orderNumber + gateway code → genera URL de checkout de la pasarela.
 *
 * La organización sale del HOST (CLAUDE.md, multi-tenancy): si el host resuelve
 * una organización, el pedido (o reserva, boleto, pase, factura) tiene que ser
 * suyo; si no, 403 y se registra. Si el host no resuelve (localhost sin
 * subdominio) se conserva el comportamiento anterior.
 * Límite por IP (60 / 10 min) y por correo del pedido (10 / 10 min), en memoria
 * por instancia, como /api/orders.
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient() || createPublicClient()

  try {
    const ip = getClientIP(request)
    if (!checkRateLimit(`checkout-init:ip:${ip}`, 60, 10 * 60 * 1000).allowed) {
      console.warn('[Checkout Init] Límite de intentos por IP alcanzado', { ip })
      return demasiadosIntentos()
    }

    const { orderNumber, gateway, returnUrl, source, sourceId } = await request.json()
    const hostOrgId = await getOrgIdDelHost()

    if (!gateway || !returnUrl) {
      return NextResponse.json(
        { error: 'Faltan parámetros: gateway, returnUrl' },
        { status: 400 }
      )
    }

    // 1. Obtener la orden, reservación, membresía, ticket, pase o factura según source
    let order: any = null
    const isReservation = source === 'reservation' && sourceId
    const isMembership = source === 'membership' && sourceId
    const isTripTicket = source === 'trip_ticket' && sourceId
    const isParkingPass = source === 'parking_pass' && sourceId
    const isInvoice = source === 'invoice' && sourceId

    if (isInvoice) {
      order = await getInvoice(supabase, sourceId)
    } else if (isParkingPass) {
      order = await getParkingPass(supabase, sourceId)
    } else if (isTripTicket) {
      order = await getTripTicket(supabase, sourceId)
    } else if (isMembership) {
      // Flujo retirado: la membresía se compra como su producto en un pedido web normal y la
      // activa el ERP al confirmarse el pago (`fn_membresias_activar_venta`). Este ramal leía
      // `memberships` por id sin filtrar organización y cobraba `membership_plans.price`
      // (obsoleto). No existe ninguna membresía cobrable por aquí (la compra directa nunca
      // pudo crear filas: la base rechaza `pending_payment`).
      return NextResponse.json(
        {
          error: 'La compra de membresías se hace desde la página de planes: agrega el plan al carrito y paga el pedido.',
          codigo: 'membresia_por_pedido_web',
        },
        { status: 410 }
      )
    } else if (isReservation) {
      order = await getReservation(supabase, sourceId)
    } else if (orderNumber) {
      if (hostOrgId !== null) {
        order = await getOrder(supabase, orderNumber, hostOrgId)
        if (!order) {
          const orgDelPedido = await organizacionDelPedido(supabase, orderNumber)
          if (orgDelPedido !== null && orgDelPedido !== hostOrgId) {
            return organizacionAjena({ fuente: 'web_order', orderNumber, hostOrgId, orgDelPedido })
          }
        }
      } else {
        order = await getOrder(supabase, orderNumber)
      }
    }

    if (!order) {
      const label = isInvoice ? 'Factura' : isParkingPass ? 'Pase' : isTripTicket ? 'Boleto' : isMembership ? 'Membresía' : isReservation ? 'Reservación' : 'Orden'
      return NextResponse.json(
        { error: `${label} no encontrado` },
        { status: 404 }
      )
    }

    // Reservas, boletos, pases y facturas se leen por id: también tienen que
    // ser de la organización del host.
    if (hostOrgId !== null && Number(order.organization_id) !== hostOrgId) {
      return organizacionAjena({ fuente: source || 'web_order', sourceId: sourceId ?? null, hostOrgId, orgDelPedido: order.organization_id })
    } else {
      // Host sin organización o cobro de la misma organización: sigue como antes.
    }

    const correo = typeof order.customer_email === 'string' ? order.customer_email.trim().toLowerCase() : ''
    if (correo && !checkRateLimit(`checkout-init:email:${correo}`, 10, 10 * 60 * 1000).allowed) {
      console.warn('[Checkout Init] Límite de intentos por correo alcanzado', { organizationId: order.organization_id })
      return demasiadosIntentos()
    }

    if (order.payment_status === 'paid') {
      const label = isInvoice ? 'Esta factura' : isParkingPass ? 'Este pase' : isTripTicket ? 'Este boleto' : isMembership ? 'Esta membresía' : isReservation ? 'Esta reservación' : 'Esta orden'
      return NextResponse.json(
        { error: `${label} ya fue pagado` },
        { status: 400 }
      )
    }

    // 2. Obtener conexión de la pasarela
    const connectorId = CONNECTOR_IDS[gateway]
    if (!connectorId) {
      return NextResponse.json({ error: `Pasarela no soportada: ${gateway}` }, { status: 400 })
    }

    const { data: connection } = await (supabase as any)
      .from('integration_connections')
      .select('id, environment, settings')
      .eq('organization_id', order.organization_id)
      .eq('connector_id', connectorId)
      .in('status', ['active', 'connected'])
      .limit(1)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: `La pasarela ${gateway} no está configurada para esta organización` },
        { status: 400 }
      )
    }

    // 3. Obtener credenciales
    const creds = await getCredentials(supabase, connection.id)
    const environment = connection.environment || 'production'

    // 4. Generar URL según pasarela
    let checkoutUrl: string | null = null

    // Resolver el gateway code real para el switch
    const resolvedGateway = GATEWAY_CODE_MAP[gateway] || gateway

    switch (resolvedGateway) {
      case 'wompi_co':
        checkoutUrl = await buildWompiCheckoutUrl(creds, order, returnUrl, environment)
        break

      case 'mp_checkout':
        checkoutUrl = await buildMercadoPagoCheckout(creds, order, returnUrl)
        break

      case 'stripe_payments':
        checkoutUrl = await buildStripeCheckout(creds, order, returnUrl)
        break

      case 'payu_co':
        checkoutUrl = buildPayUCheckoutUrl(creds, order, returnUrl, environment)
        break

      case 'paypal_checkout':
        checkoutUrl = await buildPayPalCheckout(creds, order, returnUrl, environment)
        break

      case 'bold_link':
        checkoutUrl = await buildBoldCheckout(creds, order, returnUrl)
        break

      default:
        return NextResponse.json({ error: `Gateway no implementado: ${gateway}` }, { status: 400 })
    }

    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'No se pudo generar la URL de pago. Verifica las credenciales de la pasarela.' },
        { status: 500 }
      )
    }

    // 5. Actualizar orden/reservación/membresía/ticket/pase con el gateway seleccionado
    if (isParkingPass) {
      await (supabase as any)
        .from('parking_passes')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
    } else if (isTripTicket) {
      await (supabase as any)
        .from('trip_tickets')
        .update({
          metadata: {
            ...(order.metadata || {}),
            payment_gateway: gateway,
            payment_reference: order.order_number,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
    } else if (isReservation) {
      const currentMetadata = (await (supabase as any)
        .from('reservations')
        .select('metadata')
        .eq('id', order.id)
        .single())?.data?.metadata || {}

      await (supabase as any)
        .from('reservations')
        .update({
          metadata: {
            ...currentMetadata,
            payment_gateway: gateway,
            payment_reference: order.order_number,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
    } else {
      await (supabase as any)
        .from('web_orders')
        .update({
          payment_method: gateway,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
    }

    const resolvedSource = isParkingPass ? 'parking_pass' : isTripTicket ? 'trip_ticket' : isMembership ? 'membership' : isReservation ? 'reservation' : 'web_order'

    return NextResponse.json({
      success: true,
      gateway,
      checkoutUrl,
      orderNumber: order.order_number,
      source: resolvedSource,
      sourceId: isParkingPass ? sourceId : isTripTicket ? sourceId : isMembership ? sourceId : isReservation ? sourceId : order.id,
    })
  } catch (error: any) {
    console.error('[Checkout Init] Error:', error)
    return NextResponse.json(
      { error: 'Error interno al iniciar el pago' },
      { status: 500 }
    )
  }
}
