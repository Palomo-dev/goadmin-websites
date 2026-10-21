import { headers } from 'next/headers'
import type { ReactNode } from 'react'
import { Metadata } from 'next'
import { getOrganizationByHost } from '@/lib/supabase/queries'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { isValidUUID } from '@/lib/utils'
import { tokenSeguimientoValido } from '@/lib/orders/tokenSeguimiento'
import { cargarRetoma } from '@/lib/orders/cargarRetoma'
import { RetomarCompra } from '@/components/site/RetomarCompra'
import { colorMarca, textoSobreColor } from '@/lib/email/marcaCorreoPedido'

export const dynamic = 'force-dynamic'

async function getOrg() {
  const h = await headers()
  const identifier = h.get('x-custom-domain') || h.get('x-subdomain')
  if (!identifier) return null
  return getOrganizationByHost(identifier)
}

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrg()
  return {
    title: org ? `Tu compra | ${org.name}` : 'Tu compra',
    robots: { index: false, follow: false },
  }
}

function Tarjeta({
  children,
  color,
}: {
  children: ReactNode
  color: string
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 h-1.5 w-16 rounded-full" style={{ backgroundColor: color }} />
        {children}
      </div>
    </main>
  )
}

export default async function RetomarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const org = await getOrg()
  if (!org) return <NotFoundPage />

  const { id } = await params
  const { t } = await searchParams
  const token = typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t) ? t : null
  if (!isValidUUID(id) || !token || !tokenSeguimientoValido(org.id, id, token)) {
    return <NotFoundPage />
  }

  const color = colorMarca(org.website_settings?.primary_color) ?? colorMarca(org.primary_color) ?? '#111827'
  const textoBoton = textoSobreColor(color)
  const retoma = await cargarRetoma(org.id, id)
  if (retoma.tipo === 'no_encontrado') return <NotFoundPage />

  if (retoma.tipo === 'error') {
    return (
      <Tarjeta color={color}>
        <h1 className="text-2xl font-bold text-gray-900">No pudimos armar tu carrito</h1>
        <p className="mt-3 text-gray-600">Intenta abrir el enlace otra vez en un momento.</p>
      </Tarjeta>
    )
  }

  if (retoma.tipo === 'en_curso') {
    return (
      <Tarjeta color={color}>
        <h1 className="text-2xl font-bold text-gray-900">Tu pedido sigue en curso</h1>
        <p className="mt-3 text-gray-600">
          El pedido {retoma.numero} no está cancelado. No armamos otro carrito.
        </p>
        <a
          href={retoma.rutaSeguimiento}
          className="mt-6 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ backgroundColor: color, color: textoBoton }}
        >
          Seguir mi pedido
        </a>
      </Tarjeta>
    )
  }

  if (retoma.tipo === 'pagado') {
    return (
      <Tarjeta color={color}>
        <h1 className="text-2xl font-bold text-gray-900">Tu compra ya está hecha</h1>
        <p className="mt-3 text-gray-600">
          El pedido {retoma.numero} ya se pagó. No armamos otro carrito.
        </p>
        <a
          href={retoma.rutaSeguimiento}
          className="mt-6 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ backgroundColor: color, color: textoBoton }}
        >
          Seguir mi pedido
        </a>
      </Tarjeta>
    )
  }

  const saludo = retoma.nombre.trim() ? `Hola ${retoma.nombre.trim()}, ` : 'Hola, '
  const cuerpo = retoma.lineas.length > 0
    ? `tu pedido ${retoma.numero} no se completó. Tus productos siguen disponibles.`
    : retoma.omitidos.length > 0
      ? `tu pedido ${retoma.numero} no se completó. Estos productos ya no están.`
      : `tu pedido ${retoma.numero} no tiene productos para retomar.`

  return (
    <Tarjeta color={color}>
      <p className="text-sm font-medium text-gray-500">{org.name}</p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Tu compra quedó pendiente</h1>
      <p className="mt-3 text-gray-600">
        {saludo}{cuerpo}
      </p>
      {retoma.omitidos.length > 0 ? (
        <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Estos productos ya no están y no los incluimos:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {retoma.omitidos.map((p, i) => (
              <li key={`${p.nombre}-${i}`}>{p.nombre}{p.detalle ? ` — ${p.detalle}` : ''}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {retoma.lineas.length === 0 ? (
        <a
          href="/"
          className="mt-6 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
          style={{ backgroundColor: color, color: textoBoton }}
        >
          Ver la tienda
        </a>
      ) : (
        <RetomarCompra
          lineas={retoma.lineas}
          omitidos={retoma.omitidos}
          subdomain={org.subdomain || ''}
          branchId={retoma.branchId}
          rutaCheckout={retoma.rutaCheckout}
          cliente={retoma.cliente}
          color={color}
          textoBoton={textoBoton}
        />
      )}
    </Tarjeta>
  )
}
