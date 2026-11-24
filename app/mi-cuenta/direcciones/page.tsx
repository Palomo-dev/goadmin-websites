import { Metadata } from 'next'
import { getOrgContext } from '@/lib/get-org-context'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { createAdminClient } from '@/lib/supabase/server'
import { getCuentaCliente } from '@/lib/cuenta/cuentaCliente'
import { normalizarMunicipio } from '@/lib/shipping/cotizarZonas'
import { DireccionesClient, type DireccionCuenta } from './DireccionesClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Direcciones' }
  return { title: `Mis direcciones | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

/**
 * Direcciones (Figma «16 Sitio web» G 2977:72598): cada dirección con su cobertura y costo del
 * domicilio, y el formulario «Nueva dirección» que avisa si hay domicilio, cuánto cuesta y cuándo
 * llega con el MISMO cálculo del checkout (/api/shipping/quote → `logistica_cotizar_envio`).
 * Para cotizar una dirección guardada se necesita el departamento (código DANE): sale de su
 * `municipality_id` o, en las viejas, del nombre del departamento y la ciudad. Dos consultas.
 */
export default async function DireccionesPage() {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { organization } = ctx
  const cuenta = await getCuentaCliente(organization.id)
  const sb = createAdminClient() as any
  let direcciones: DireccionCuenta[] = []

  if (cuenta?.cliente && sb) {
    const { data } = await sb
      .from('customer_addresses')
      .select('id, label, address_line1, address_line2, city, department, country_code, delivery_instructions, is_default, municipality_id')
      .eq('organization_id', organization.id)
      .eq('customer_id', cuenta.cliente.id)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(20)
    const filas = (data ?? []) as {
      id: string
      label: string | null
      address_line1: string
      address_line2: string | null
      city: string
      department: string | null
      country_code: string | null
      delivery_instructions: string | null
      is_default: boolean | null
      municipality_id: string | null
    }[]
    const conMunicipio = filas.map((f) => f.municipality_id).filter((x): x is string => !!x)
    const departamentos = Array.from(new Set(filas.filter((f) => !f.municipality_id && f.department).map((f) => f.department as string)))
    const [porId, porDepto] = await Promise.all([
      conMunicipio.length > 0 ? sb.from('municipalities').select('id, state_code').in('id', conMunicipio) : Promise.resolve({ data: [] }),
      departamentos.length > 0 ? sb.from('municipalities').select('name, state_code, state_name').eq('country_code', 'COL').in('state_name', departamentos) : Promise.resolve({ data: [] }),
    ])
    const deptoDeMunicipio = new Map<string, string>(((porId.data ?? []) as { id: string; state_code: string }[]).map((m) => [m.id, m.state_code]))
    const municipiosPorDepto = (porDepto.data ?? []) as { name: string; state_code: string; state_name: string }[]
    direcciones = filas.map((f) => {
      let departamento = f.municipality_id ? deptoDeMunicipio.get(f.municipality_id) ?? null : null
      if (!departamento && f.department) {
        const iguales = municipiosPorDepto.filter((m) => m.state_name === f.department && normalizarMunicipio(m.name) === normalizarMunicipio(f.city))
        departamento = iguales.length === 1 ? iguales[0].state_code : null
      }
      return {
        id: f.id,
        nombre: f.label || 'Dirección',
        linea: f.address_line1,
        barrio: f.address_line2,
        ciudad: f.city,
        departamentoNombre: f.department,
        indicaciones: f.delivery_instructions,
        principal: !!f.is_default,
        // Cotizable solo en Colombia y con el departamento conocido (igual que el checkout).
        cotizar: departamento && (f.country_code || 'CO').toUpperCase().startsWith('CO') ? { pais: 'COL', departamento, ciudad: f.city, barrio: f.address_line2 } : null,
      }
    })
  }

  return <DireccionesClient direcciones={direcciones} />
}
