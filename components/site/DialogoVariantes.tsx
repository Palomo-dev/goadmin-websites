'use client'

/**
 * Diálogo para elegir la variante de un producto padre y agregarla al carrito (VariantSelector).
 *
 * Lo usan el catálogo (`ProductGrid`, «Elegir») y la tarjeta de producto con el contador de
 * cantidad (`ProductCard`, el «+» de un padre). Carga las variantes de
 * `/api/products/[id]/variants` (con sede, la carta de la sede: el mismo precio que cobra
 * /api/orders) y escribe la línea con `agregarPlatoAlCarrito`, como siempre.
 */
import { useState, type ReactNode } from 'react'
import { VariantSelector } from './VariantSelector'
import { agregarPlatoAlCarrito } from '@/lib/cart'
import type { ModifierGroup, SelectedModifier } from './ProductModifierSelector'

type ProductoPadre = { id: number | string; name: string; product_prices?: { price?: number | null }[] | null }

export function useDialogoVariantes({
  organizationId,
  organizationSubdomain,
  branchId,
  primaryColor,
  imagenDe,
}: {
  organizationId?: number | null
  organizationSubdomain: string
  branchId?: number | null
  primaryColor: string
  /** URL de la foto de la variante (cada pantalla tiene la suya). */
  imagenDe: (variante: any) => string | null
}): { abrir: (padre: ProductoPadre) => Promise<void>; dialogo: ReactNode } {
  const [padre, setPadre] = useState<ProductoPadre | null>(null)
  const [variantes, setVariantes] = useState<any[]>([])
  const [grupos, setGrupos] = useState<ModifierGroup[]>([])
  const [orden, setOrden] = useState<Record<string, Record<string, number>> | null>(null)

  const cerrar = () => {
    setPadre(null)
    setVariantes([])
    setGrupos([])
    setOrden(null)
  }

  const abrir = async (producto: ProductoPadre) => {
    if (!organizationId) return
    setPadre(producto)
    try {
      // Con sede, la ruta aplica su carta (mismo precio que cobra /api/orders).
      const sedeParam = typeof branchId === 'number' ? `&branchId=${branchId}` : ''
      const res = await fetch(`/api/products/${producto.id}/variants?organizationId=${organizationId}${sedeParam}`)
      const data = await res.json()
      // Cada variante lleva sus grupos propios (si tiene); las demás heredan los del padre
      // (acompañante…), con la regla del cobro (`gruposDeProducto`, en VariantSelector).
      const propios: Record<string, ModifierGroup[]> = data.variantModifierGroups || {}
      setVariantes(((data.variants || []) as any[]).map((v) => (propios[String(v.id)] ? { ...v, modifier_groups: propios[String(v.id)] } : v)))
      setGrupos(Array.isArray(data.modifierGroups) ? data.modifierGroups : [])
      setOrden(data.ordenAtributos && typeof data.ordenAtributos === 'object' ? data.ordenAtributos : null)
    } catch (err) {
      console.error('Error loading variants:', err)
      setVariantes([])
      setGrupos([])
      setOrden(null)
    }
  }

  const dialogo = padre ? (
    <VariantSelector
      parentName={padre.name}
      variants={variantes}
      primaryColor={primaryColor}
      mode="dialog"
      modifierGroups={grupos}
      ordenAtributos={orden}
      onClose={cerrar}
      onSelect={(variant, qty = 1, mods: SelectedModifier[] = []) => {
        const v = variant as any
        const base = Number(v.product_prices?.[0]?.price ?? padre.product_prices?.[0]?.price ?? 0)
        agregarPlatoAlCarrito(organizationSubdomain, branchId, {
          productId: Number(v.id),
          name: v.name,
          sku: v.sku ?? null,
          unitPrice: base + mods.reduce((t, m) => t + (m.extraPrice || 0), 0),
          quantity: qty,
          imageUrl: imagenDe(v),
          comparePrice: mods.length === 0 && v.product_prices?.[0]?.compare_price ? Number(v.product_prices[0].compare_price) : null,
          modifiers: mods,
          variantAttributes: v.variant_data ?? null,
        })
        cerrar()
      }}
    />
  ) : null

  return { abrir, dialogo }
}
