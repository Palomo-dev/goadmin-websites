import { Metadata } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { createAdminClient } from '@/lib/supabase/server'
import { getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { facturaCompleta, fechaAutorizacionDatos, identidadCuenta, leerAvisos, leerCumpleanos } from '@/lib/cuenta/reglasCuenta'
import { PestanasCuenta } from '@/components/site/cuenta/PestanasCuenta'
import { AvatarCuenta } from '@/components/site/cuenta/avatar/AvatarCuenta'
import { enlaceWhatsapp } from '@/lib/website/ajustesSitio'
import { DatosCliente, type TipoDocumentoOpcion } from './DatosCliente'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Mis datos' }
  return { title: `Mis datos | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

/** Respaldo si el catálogo no responde: los tipos más usados (mismos códigos de `country_identification_types`). */
const TIPOS_RESPALDO: TipoDocumentoOpcion[] = [
  { code: 'cc', name: 'Cédula de ciudadanía', persona: true, empresa: false },
  { code: 'nit', name: 'NIT (empresa)', persona: true, empresa: true },
  { code: 'ce', name: 'Cédula de extranjería', persona: true, empresa: false },
  { code: 'passport', name: 'Pasaporte', persona: true, empresa: false },
]

/**
 * Mis datos (Figma «16 Sitio web» F 2977:72278): datos personales (el correo no se edita aquí),
 * datos para la factura electrónica (persona natural o empresa), avisos y privacidad, y seguridad
 * (contraseña opcional, cerrar las demás sesiones, solicitar la eliminación de la cuenta).
 * Arriba, la tarjeta con el avatar y el nombre de la ficha (Figma 3044:78726, pantalla 8); sin
 * nombre se muestra el correo y «Agrega tu nombre» lleva al campo. Sin «Agregar foto»: no hay
 * dónde guardarla.
 * La ruta sigue siendo /mi-cuenta/perfil para no romper enlaces.
 */
export default async function MisDatosPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization, effectiveSettings, primaryColor } = ctx
  const cuenta = await getCuentaCliente(organization.id)
  const cliente = cuenta?.cliente ?? null
  if (!cuenta || !cliente) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold text-slate-900 md:text-[28px]">Mis datos</h1>
        <PestanasCuenta />
        <p className="rounded-[14px] border border-slate-200 bg-white p-6 text-sm text-slate-600">No encontramos tus datos en esta tienda. Sal y vuelve a entrar con el código que te enviamos al correo.</p>
      </div>
    )
  }

  const sb = createAdminClient() as any
  const [tiposRes, consentRes] = sb
    ? await Promise.all([
        sb.from('country_identification_types').select('code, name, for_person, for_company, sort_order').eq('country_code', 'COL').eq('is_active', true).order('sort_order', { ascending: true }),
        sb.from('contact_consents').select('channel, status').eq('organization_id', organization.id).eq('customer_id', cliente.id),
      ])
    : [{ data: null }, { data: null }]
  const tipos: TipoDocumentoOpcion[] = Array.isArray(tiposRes.data) && tiposRes.data.length > 0
    ? (tiposRes.data as { code: string; name: string; for_person: boolean | null; for_company: boolean | null }[]).map((t) => ({ code: t.code, name: t.name, persona: t.for_person !== false, empresa: t.for_company !== false }))
    : TIPOS_RESPALDO
  const consent = (consentRes.data ?? []) as { channel: string; status: string }[]
  const ofertas = consent.some((c) => c.status === 'opted_in') && !consent.some((c) => c.status === 'opted_out')

  const ajustes = (effectiveSettings ?? {}) as Record<string, unknown>
  const whatsapp = typeof ajustes.whatsapp_number === 'string' && ajustes.whatsapp_number.replace(/\D/g, '').length >= 7
    ? enlaceWhatsapp({ numero: ajustes.whatsapp_number, saludo: 'Hola, quiero solicitar la eliminación de mi cuenta en la tienda.' })
    : null
  const correoTienda = (typeof ajustes.contact_email === 'string' && ajustes.contact_email) || (organization as { email?: string | null }).email || null
  const prefs = cliente.preferences as Record<string, unknown> | null
  const cumple = leerCumpleanos(prefs?.cumpleanos)
  const identidad = identidadCuenta(cliente, cuenta.correo)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 md:text-[28px]">Mis datos</h1>
        <PestanasCuenta />
      </div>
      <section aria-label="Tu cuenta" className="flex items-center gap-4 rounded-[14px] border border-slate-200 bg-white p-4 md:p-5">
        <AvatarCuenta iniciales={identidad.iniciales} primaryColor={primaryColor} tam={56} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">{identidad.titulo}</p>
          {identidad.nombre ? (
            identidad.correo && <p className="truncate text-sm text-slate-600">{identidad.correo}</p>
          ) : (
            <a href="#dato-nombre" className="text-sm font-semibold hover:underline" style={{ color: 'var(--primary-color)' }}>
              Agrega tu nombre
            </a>
          )}
        </div>
      </section>
      <DatosCliente
        correo={cuenta.correo}
        personales={{
          first_name: cliente.first_name ?? '',
          last_name: cliente.last_name ?? '',
          phone: cliente.phone ?? '',
          cumpleanos: cumple ? `${String(cumple.mes).padStart(2, '0')}-${String(cumple.dia).padStart(2, '0')}` : '',
        }}
        factura={{
          customer_type: cliente.customer_type === 'company' ? 'company' : 'person',
          identification_type: cliente.identification_type ?? '',
          identification_number: cliente.identification_number ?? '',
          company_name: cliente.company_name ?? '',
          dv: cliente.dv === null || cliente.dv === undefined ? '' : String(cliente.dv),
          correo_factura: typeof prefs?.correo_factura === 'string' ? prefs.correo_factura : '',
          ciudad: cliente.city ?? '',
          completa: facturaCompleta(cliente),
        }}
        avisos={{ ...leerAvisos(prefs), ofertas }}
        autorizadoEn={fechaAutorizacionDatos(prefs)}
        tipos={tipos}
        contactoEliminar={{ whatsapp, correo: correoTienda }}
        nombreTienda={organization.name}
      />
    </div>
  )
}
