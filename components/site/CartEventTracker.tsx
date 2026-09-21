'use client'

import { useEffect, useRef } from 'react'
import { getCartKey } from '@/lib/utils'
import { trackMetaAddToCart } from './MetaPixelEvents'

interface CartLine {
  id: number | string
  productId?: number | null
  sku?: string | null
  name?: string
  price?: number
  quantity?: number
}

/**
 * Dispara `AddToCart` del Meta Pixel para CUALQUIER camino que agregue al
 * carrito, sin que cada componente tenga que acordarse.
 *
 * Hay más de diez sitios que escriben el carrito (card, detalle, sticky,
 * quick view, sugeridos, reordenar, drawer +1…) y solo dos llamaban al pixel;
 * el resto (incluido el detalle de producto, que es el principal) no
 * registraba nada, y por eso el comerciante intentaba configurar los eventos
 * a mano con la herramienta de Meta, elemento por elemento.
 *
 * Cómo funciona: todos esos sitios ya disparan `cart-updated` tras escribir
 * localStorage. Aquí se guarda una foto del carrito y, en cada evento, se
 * compara: cada línea cuya cantidad subió es un AddToCart por la diferencia.
 * Quitar o bajar cantidad no dispara nada. Se monta una vez por página
 * (OrganizationLayout y /checkout).
 */
export function CartEventTracker({
  organizationSubdomain,
  branchId,
}: {
  organizationSubdomain: string
  branchId?: number | null
}) {
  const snapshot = useRef<Map<string, number>>(new Map())
  const cartKey = getCartKey(organizationSubdomain, branchId)

  useEffect(() => {
    const readCart = (): CartLine[] => {
      try {
        const raw = JSON.parse(localStorage.getItem(cartKey) || '[]')
        return Array.isArray(raw) ? raw : []
      } catch {
        return []
      }
    }
    const toMap = (lines: CartLine[]) => {
      const m = new Map<string, number>()
      for (const l of lines) m.set(String(l.id), (m.get(String(l.id)) || 0) + (Number(l.quantity) || 0))
      return m
    }

    // Foto inicial: lo que ya había en el carrito no cuenta como "agregado".
    snapshot.current = toMap(readCart())

    const onCartUpdated = () => {
      const lines = readCart()
      const next = toMap(lines)
      for (const line of lines) {
        const key = String(line.id)
        const before = snapshot.current.get(key) || 0
        const after = next.get(key) || 0
        const added = after - before
        if (added <= 0) continue
        // content_ids debe coincidir con el `retailer_id` del catálogo de Meta,
        // que el ERP sincroniza como SKU; si la línea no trae SKU, el id.
        const contentId = line.sku || String(line.productId ?? String(line.id).split(/[_:-]/)[0])
        const unitPrice = Number(line.price) || 0
        trackMetaAddToCart(contentId, line.name || '', unitPrice * added, 'COP', added)
        // GA4 / Google Ads (gtag), si la organización lo tiene instalado.
        const gtag = (window as any).gtag
        if (typeof gtag === 'function') {
          gtag('event', 'add_to_cart', {
            currency: 'COP',
            value: unitPrice * added,
            items: [{ item_id: contentId, item_name: line.name || '', price: unitPrice, quantity: added }],
          })
        }
        // Marcar como contado para que un segundo evento con el mismo carrito
        // (varios componentes despachan tras la misma escritura) no duplique.
        snapshot.current.set(key, after)
      }
      snapshot.current = next
    }

    window.addEventListener('cart-updated', onCartUpdated)
    return () => window.removeEventListener('cart-updated', onCartUpdated)
  }, [cartKey])

  return null
}
