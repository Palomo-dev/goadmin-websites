'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { reemplazarCarrito } from '@/lib/cart'
import type { DatosClienteRetomar, LineaRetoma } from '@/lib/orders/compraPendiente'

function guardarCliente(subdomain: string, cliente: DatosClienteRetomar) {
  const key = `checkout_customer_${subdomain}`
  let prev: Record<string, unknown> = {}
  try {
    const crudo = JSON.parse(localStorage.getItem(key) || '{}')
    if (crudo && typeof crudo === 'object') prev = crudo as Record<string, unknown>
  } catch {
    prev = {}
  }
  const next: Record<string, unknown> = { ...prev }
  if (cliente.firstName || cliente.lastName) {
    next.firstName = cliente.firstName
    next.lastName = cliente.lastName
  }
  if (cliente.email) next.email = cliente.email
  if (cliente.phone) next.phone = cliente.phone
  localStorage.setItem(key, JSON.stringify(next))
}

/**
 * Vuelve a dejar en el navegador los productos del pedido y abre el checkout.
 * Si falta alguno, se queda en esta página para decirlo.
 */
export function RetomarCompra({
  lineas,
  omitidos,
  subdomain,
  branchId,
  rutaCheckout,
  cliente,
  color,
  textoBoton,
}: {
  lineas: LineaRetoma[]
  omitidos: { nombre: string; detalle: string }[]
  subdomain: string
  branchId: number | null
  rutaCheckout: string
  cliente: DatosClienteRetomar
  color: string
  textoBoton: string
}) {
  const router = useRouter()

  function armar() {
    if (lineas.length === 0) return
    reemplazarCarrito(subdomain, branchId, lineas)
    guardarCliente(subdomain, cliente)
  }

  useEffect(() => {
    if (lineas.length === 0) return
    armar()
    if (omitidos.length === 0) router.push(rutaCheckout)
    // El carrito se escribe una vez al abrir el enlace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (lineas.length === 0) return null

  return (
    <div className="mt-6">
      {omitidos.length === 0 ? (
        <p className="text-sm text-gray-500">Te llevamos al checkout.</p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          armar()
          router.push(rutaCheckout)
        }}
        className="mt-4 inline-block rounded-lg px-6 py-3 text-sm font-semibold"
        style={{ backgroundColor: color, color: textoBoton }}
      >
        Retomar mi compra
      </button>
    </div>
  )
}
