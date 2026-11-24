import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getOrgIdDelHost } from '@/lib/get-org-context'
import { getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { leerCumpleanos, limpiarDocumento } from '@/lib/cuenta/reglasCuenta'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/customer/profile — Mis datos (Figma «16 Sitio web» F 2977:72278).
 *
 * La organización sale del HOST y la ficha de la sesión: el `customer_id`/`organization_id` del
 * body (formulario viejo) se ignora. Una sección por guardado:
 * - `personales`: nombre, apellido, celular y cumpleaños (`preferences.cumpleanos`, «MM-DD»). El
 *   correo NO se cambia aquí (es con el que entra).
 * - `factura`: persona o empresa (`customer_type`), tipo y número de documento
 *   (`identification_*`; `doc_type`/`doc_number` son GENERATED), razón social y DV de empresa,
 *   y correo para facturas (`preferences.correo_factura`, sin columna propia).
 * - `avisos`: avisos de pedidos por WhatsApp y correo (`preferences.avisos_pedido`) y ofertas
 *   (`contact_consents` por canal, el mismo registro que usa la baja de correos del CRM).
 * Sin `seccion` (formulario viejo): nombre, apellido, teléfono, documento, dirección y ciudad,
 * como antes.
 */
const texto = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function PUT(request: NextRequest) {
  try {
    const orgId = await getOrgIdDelHost()
    if (orgId === null) return NextResponse.json({ error: 'Tienda no encontrada' }, { status: 404 })
    const cuenta = await getCuentaCliente(orgId)
    if (!cuenta) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const cliente = cuenta.cliente
    if (!cliente) return NextResponse.json({ error: 'No encontramos tu ficha en esta tienda' }, { status: 404 })
    const supabase = createAdminClient() as any
    if (!supabase) return NextResponse.json({ error: 'No disponible' }, { status: 503 })

    const body = await request.json().catch(() => ({}))
    const seccion = body.seccion
    const ahora = new Date().toISOString()
    const preferencias = cliente.preferences && typeof cliente.preferences === 'object' ? { ...(cliente.preferences as Record<string, unknown>) } : {}
    let cambios: Record<string, unknown>

    if (seccion === 'personales') {
      const cumple = typeof body.cumpleanos === 'string' && body.cumpleanos ? leerCumpleanos(body.cumpleanos) : null
      if (typeof body.cumpleanos === 'string' && body.cumpleanos && !cumple) return NextResponse.json({ error: 'La fecha de cumpleaños no es válida' }, { status: 400 })
      if (cumple) preferencias.cumpleanos = `${String(cumple.mes).padStart(2, '0')}-${String(cumple.dia).padStart(2, '0')}`
      else delete preferencias.cumpleanos
      cambios = { first_name: texto(body.first_name) ?? '', last_name: texto(body.last_name) ?? '', phone: texto(body.phone, 30), preferences: preferencias }
    } else if (seccion === 'factura') {
      const tipoPersona = body.customer_type === 'company' ? 'company' : 'person'
      const tipoDoc = texto(body.identification_type, 20)?.toLowerCase() ?? null
      const numero = body.identification_number ? limpiarDocumento(body.identification_number) : null
      if (body.identification_number && !numero) return NextResponse.json({ error: 'El número de documento no es válido' }, { status: 400 })
      if (tipoDoc) {
        // Solo tipos del catálogo del país (el mismo del ERP).
        const { data: tipo } = await supabase.from('country_identification_types').select('code, for_person, for_company').eq('country_code', 'COL').eq('code', tipoDoc).eq('is_active', true).maybeSingle()
        if (!tipo || (tipoPersona === 'company' ? tipo.for_company === false : tipo.for_person === false)) {
          return NextResponse.json({ error: 'Elige un tipo de documento de la lista' }, { status: 400 })
        }
      }
      if (tipoPersona === 'company' && !texto(body.company_name, 200)) return NextResponse.json({ error: 'Escribe la razón social de la empresa' }, { status: 400 })
      const dv = tipoPersona === 'company' && /^\d$/.test(String(body.dv ?? '')) ? Number(body.dv) : null
      const correoFactura = texto(body.correo_factura, 254)
      if (correoFactura && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correoFactura)) return NextResponse.json({ error: 'El correo para facturas no es válido' }, { status: 400 })
      if (correoFactura) preferencias.correo_factura = correoFactura.toLowerCase()
      else delete preferencias.correo_factura
      cambios = {
        customer_type: tipoPersona,
        identification_type: tipoDoc,
        identification_number: numero,
        company_name: tipoPersona === 'company' ? texto(body.company_name, 200) : null,
        dv,
        // Persona natural = 2, jurídica = 1 (lo que lee el envío a Factus).
        legal_organization_id: tipoPersona === 'company' ? 1 : 2,
        // Sin `city`: `customers.city` es la de la dirección principal y escribirla aquí la
        // cambiaría (trigger `trg_sync_customer_to_address`).
        preferences: preferencias,
      }
    } else if (seccion === 'avisos') {
      preferencias.avisos_pedido = { whatsapp: body.whatsapp !== false, correo: body.correo !== false, en: ahora }
      cambios = { preferences: preferencias }
      if (typeof body.ofertas === 'boolean') {
        const estado = body.ofertas ? 'opted_in' : 'opted_out'
        const filas = (['email', 'whatsapp'] as const).map((channel) => ({
          organization_id: orgId,
          customer_id: cliente.id,
          channel,
          status: estado,
          source: 'tienda_mi_cuenta',
          evidence: { via: 'mi-cuenta', en: ahora },
          changed_at: ahora,
        }))
        const { error: errConsent } = await supabase.from('contact_consents').upsert(filas, { onConflict: 'organization_id,customer_id,channel' })
        if (errConsent) {
          console.error('[mis-datos] No se pudo guardar la autorización de ofertas', { orgId, error: errConsent.message })
          return NextResponse.json({ error: 'No pudimos guardar tus preferencias' }, { status: 500 })
        }
      }
    } else {
      // Formulario anterior (sin sección): los mismos campos de siempre.
      cambios = {
        first_name: texto(body.first_name),
        last_name: texto(body.last_name),
        phone: texto(body.phone, 30),
        identification_type: texto(body.doc_type, 20),
        identification_number: texto(body.doc_number, 20),
        address: texto(body.address, 200),
        city: texto(body.city),
      }
    }

    const { error } = await supabase
      .from('customers')
      .update({ ...cambios, updated_at: ahora })
      .eq('id', cliente.id)
      .eq('organization_id', orgId)
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ese documento ya está registrado en otra cuenta de la tienda' }, { status: 409 })
      console.error('[mis-datos] No se pudo guardar', { orgId, seccion, error: error.message })
      return NextResponse.json({ error: 'No pudimos guardar los cambios' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[mis-datos] Error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
