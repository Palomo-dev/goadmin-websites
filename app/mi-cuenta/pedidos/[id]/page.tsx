import { Metadata } from 'next'
import { Package } from 'lucide-react'
import { getOrgContext } from '@/lib/get-org-context'
import { isValidUUID } from '@/lib/utils'
import { NotFoundPage } from '@/components/site/NotFoundPage'
import { getCuentaCliente, pedidoDeCuenta } from '@/lib/cuenta/cuentaCliente'
import { tokenSeguimiento } from '@/lib/orders/tokenSeguimiento'
import { OrderTracker } from '@/app/pedido/[id]/OrderTracker'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getOrgContext()
  if (!ctx) return { title: 'Detalle del pedido' }
  return { title: `Detalle del pedido | ${ctx.organization.name}`, robots: { index: false, follow: false } }
}

/**
 * Detalle de un pedido en la cuenta: la MISMA página del pedido rediseñada (OrderTracker, Figma
 * «21 Logística» › 10), con el token de seguimiento porque el pedido es de esta cuenta (sus fichas
 * en la organización del host, o su correo verificado). Así el pago, la entrega, la factura, la
 * calificación y «Volver a comprar» son los de la página pública, sin una segunda versión.
 */
export default async function PedidoCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgContext()
  if (!ctx) return <NotFoundPage />
  const { id } = await params
  if (!isValidUUID(id)) return <NotFoundPage />
  const { organization, primaryColor } = ctx

  const cuenta = await getCuentaCliente(organization.id)
  const pedido = cuenta ? await pedidoDeCuenta(organization.id, cuenta, id) : null

  // «Volver a Mis pedidos»: el ← y las migas los pinta el layout de Mi cuenta (VolverMiCuenta).

  if (!pedido) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 rounded-[14px] border border-slate-200 bg-white p-8 text-center">
          <Package aria-hidden="true" className="h-8 w-8 text-slate-400" />
          <p className="font-semibold text-slate-900">Pedido no encontrado</p>
          <p className="text-sm text-slate-600">No está entre los pedidos de tu cuenta.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 [&_.container]:px-0 [&_.container]:pt-0">
      <OrderTracker
        orderIdentifier={pedido.order_number}
        primaryColor={primaryColor}
        token={tokenSeguimiento(organization.id, pedido.id)}
        rutaSeguirPidiendo={organization.type_id === 1 ? '/menu' : '/productos'}
      />
    </div>
  )
}
