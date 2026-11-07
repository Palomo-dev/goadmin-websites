'use client'

/**
 * «Agregar todo» de «Completa el look»: una llamada a `addProductToCart` (lib/cart.ts, la misma
 * línea que escriben las tarjetas) por pieza. Las piezas ya vienen filtradas en el servidor:
 * simples, con precio y con stock. El total y la disponibilidad los vuelve a validar el pedido.
 */

import { useState } from 'react'
import { Check, ShoppingBag } from 'lucide-react'
import { addProductToCart } from '@/lib/cart'

export interface PiezaLook {
  id: number
  name: string
  price: number
  sku: string | null
  imageUrl: string | null
  comparePrice: number | null
}

interface AgregarTodoLookProps {
  piezas: PiezaLook[]
  primaryColor: string
  organizationSubdomain: string
  branchId: number | null
}

export function AgregarTodoLook({ piezas, primaryColor, organizationSubdomain, branchId }: AgregarTodoLookProps) {
  const [agregado, setAgregado] = useState(false)

  const agregarTodo = () => {
    const subdominio = organizationSubdomain || window.location.hostname.split('.')[0]
    for (const pieza of piezas) addProductToCart(subdominio, branchId, pieza)
    setAgregado(true)
    window.setTimeout(() => setAgregado(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={agregarTodo}
      className="inline-flex items-center gap-2 rounded-[var(--radio-boton,9999px)] border px-4 py-2 text-sm font-medium transition-colors hover:opacity-90"
      style={{ borderColor: primaryColor, color: primaryColor }}
    >
      {agregado ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
      {agregado ? 'Agregado al carrito' : `Agregar todo (${piezas.length})`}
    </button>
  )
}
