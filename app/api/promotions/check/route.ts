import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createPublicClient } from '@/lib/supabase/server'

function getSupabase() {
  return createAdminClient() || createPublicClient()
}

interface CartItem {
  id: number | string
  name: string
  price: number
  quantity: number
  categoryId?: number
}

interface AppliedPromotion {
  id: string
  name: string
  description: string | null
  promotion_type: string
  discount_value: number
  discount: number
  affectedItems: string[]
}

/**
 * POST /api/promotions/check
 * Detecta y calcula promociones automáticas para los items del carrito.
 * Body: { organizationId, items: CartItem[], subtotal }
 * Returns: { promotions: AppliedPromotion[], totalDiscount }
 */
export async function POST(request: NextRequest) {
  try {
    const { organizationId, items, subtotal } = await request.json()

    if (!organizationId || !items || items.length === 0) {
      return NextResponse.json({ promotions: [], totalDiscount: 0 })
    }

    const supabase = getSupabase()
    const sb = supabase as any
    const now = new Date().toISOString()

    // Buscar promociones activas y vigentes
    const { data: promotions, error } = await sb
      .from('promotions')
      .select('*, promotion_rules(id, rule_type, product_id, category_id)')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .lte('start_date', now)
      .order('priority', { ascending: true })

    if (error || !promotions || promotions.length === 0) {
      return NextResponse.json({ promotions: [], totalDiscount: 0 })
    }

    // Filtrar las que no han expirado y no superaron usage_limit
    const validPromos = promotions.filter((p: any) => {
      if (p.end_date && new Date(p.end_date) < new Date()) return false
      if (p.usage_limit && p.usage_count >= p.usage_limit) return false
      return true
    })

    const orderSubtotal = Number(subtotal || 0)
    const cartItemIds = items.map((i: CartItem) => Number(i.id))
    const cartCategoryIds = items.map((i: CartItem) => i.categoryId).filter(Boolean)

    const applied: AppliedPromotion[] = []
    let hasNonCombinable = false

    for (const promo of validPromos) {
      // Si ya hay una promo no combinable, no agregar más
      if (hasNonCombinable) break

      // Validar monto mínimo
      if (promo.min_purchase_amount && orderSubtotal < Number(promo.min_purchase_amount)) continue

      // Determinar items afectados según applies_to + rules
      let affectedItems: CartItem[] = []
      const rules = promo.promotion_rules || []
      const includeRules = rules.filter((r: any) => r.rule_type === 'include')
      const excludeRules = rules.filter((r: any) => r.rule_type === 'exclude')

      if (promo.applies_to === 'all') {
        affectedItems = [...items]
      } else if (promo.applies_to === 'category') {
        const includeCatIds = includeRules.map((r: any) => r.category_id).filter(Boolean)
        if (includeCatIds.length > 0) {
          affectedItems = items.filter((i: CartItem) => i.categoryId && includeCatIds.includes(i.categoryId))
        } else {
          affectedItems = [...items]
        }
        const excludeCatIds = excludeRules.map((r: any) => r.category_id).filter(Boolean)
        affectedItems = affectedItems.filter((i: CartItem) => !i.categoryId || !excludeCatIds.includes(i.categoryId))
      } else if (promo.applies_to === 'product') {
        const includeProductIds = includeRules.map((r: any) => r.product_id).filter(Boolean)
        if (includeProductIds.length > 0) {
          affectedItems = items.filter((i: CartItem) => includeProductIds.includes(Number(i.id)))
        }
        const excludeProductIds = excludeRules.map((r: any) => r.product_id).filter(Boolean)
        affectedItems = affectedItems.filter((i: CartItem) => !excludeProductIds.includes(Number(i.id)))
      }

      if (affectedItems.length === 0) continue

      // Calcular descuento según tipo
      let discount = 0
      const affectedSubtotal = affectedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0)

      switch (promo.promotion_type) {
        case 'percentage':
          discount = Math.round(affectedSubtotal * Number(promo.discount_value) / 100)
          break
        case 'fixed':
          discount = Number(promo.discount_value)
          break
        case 'buy_x_get_y': {
          // Para cada item afectado, si qty >= buy_quantity, aplicar get_quantity gratis
          const buyQty = promo.buy_quantity || 2
          const getQty = promo.get_quantity || 1
          for (const item of affectedItems) {
            const sets = Math.floor(item.quantity / (buyQty + getQty))
            discount += sets * getQty * item.price
          }
          break
        }
        case 'bundle':
          discount = Number(promo.discount_value)
          break
      }

      // Aplicar tope de descuento
      if (promo.max_discount_amount && discount > Number(promo.max_discount_amount)) {
        discount = Number(promo.max_discount_amount)
      }

      if (discount <= 0) continue

      // No puede exceder el subtotal de los items afectados
      if (discount > affectedSubtotal) {
        discount = affectedSubtotal
      }

      applied.push({
        id: promo.id,
        name: promo.name,
        description: promo.description,
        promotion_type: promo.promotion_type,
        discount_value: Number(promo.discount_value),
        discount,
        affectedItems: affectedItems.map(i => i.name),
      })

      if (!promo.is_combinable) {
        hasNonCombinable = true
      }
    }

    const totalDiscount = applied.reduce((sum, p) => sum + p.discount, 0)

    return NextResponse.json({ promotions: applied, totalDiscount })
  } catch (error) {
    console.error('[Promotions] Check error:', error)
    return NextResponse.json({ promotions: [], totalDiscount: 0 }, { status: 500 })
  }
}
