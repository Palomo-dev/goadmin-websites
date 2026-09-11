/**
 * Motor de promociones automáticas del escaparate web.
 *
 * Espejo de `src/lib/services/promotionEngine.ts` del ERP (canal `web`), para
 * que el cliente vea en el carrito/checkout exactamente el mismo descuento que
 * luego calcula el POS/ERP. Mantener ambos alineados: mismos valores de
 * `promotion_type`, `applies_to` y `rule_type` que permite el CHECK de la tabla.
 *
 * Dos capas:
 *  - `calculatePromotions(...)`: pura, sin BD. Recibe promociones ya cargadas y
 *    los items con su `category_id` / `parent_product_id` resueltos.
 *  - `evaluateCartPromotions(...)`: carga promociones y productos desde Supabase
 *    y delega en la anterior. Es la que usan `/api/promotions/check` y
 *    `/api/orders` (recalcula en servidor: el descuento del cliente no se confía).
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type PromotionType = 'percentage' | 'fixed_amount' | 'buy_x_get_y' | 'bundle' | 'free_shipping'
export type PromotionAppliesTo = 'all' | 'categories' | 'products' | 'brands'
export type PromotionRuleType =
  | 'include_product' | 'exclude_product'
  | 'include_category' | 'exclude_category'
  | 'include_brand' | 'exclude_brand'

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
const JS_DAY_TO_WEEKDAY: WeekDay[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export interface PromotionRule {
  id?: string
  rule_type: PromotionRuleType | string
  product_id: number | null
  category_id: number | null
}

export interface PromotionRow {
  id: string
  name: string
  description: string | null
  promotion_type: PromotionType | string
  discount_value: number | string | null
  buy_quantity: number | null
  get_quantity: number | null
  min_purchase_amount: number | string | null
  max_discount_amount: number | string | null
  applies_to: PromotionAppliesTo | string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_limit: number | null
  usage_count: number | null
  is_combinable: boolean | null
  priority: number | null
  branches: number[] | null
  applies_to_web: boolean | null
  applicable_days: WeekDay[] | string[] | null
  promotion_rules?: PromotionRule[] | null
  rules?: PromotionRule[] | null
}

/** Línea del carrito tal como la mandan drawer/checkout/orders. */
export interface PromoCartItem {
  /** Id de línea. Puede ser compuesto (`123_4-5`) cuando hay modificadores. */
  id: number | string
  /** Id real del producto cuando `id` es compuesto. */
  productId?: number | null
  name: string
  price: number
  quantity: number
}

/** Línea ya enriquecida con los datos del producto necesarios para las reglas. */
export interface ResolvedPromoItem extends PromoCartItem {
  product_id: number
  parent_product_id: number | null
  category_id: number | null
}

export interface AppliedPromotion {
  id: string
  name: string
  description: string | null
  promotion_type: string
  discount_value: number
  /** Monto total descontado por esta promoción (entero, en la moneda base). */
  discount: number
  /** Nombres de las líneas afectadas (para mostrar). */
  affectedItems: string[]
  /** Ids de línea de carrito afectados (para pintar el badge en cada item). */
  affectedItemIds: Array<number | string>
}

export interface PromotionEvaluation {
  promotions: AppliedPromotion[]
  totalDiscount: number
  /** Descuento acumulado por id de línea de carrito (string). */
  itemDiscounts: Record<string, number>
}

const EMPTY: PromotionEvaluation = { promotions: [], totalDiscount: 0, itemDiscounts: {} }

// ── Utilidades ───────────────────────────────────────────────────────────────

export function realProductId(item: PromoCartItem): number {
  if (item.productId != null && Number.isFinite(Number(item.productId))) return Number(item.productId)
  if (typeof item.id === 'number') return item.id
  // `123_4-5` → 123 ; `123` → 123
  const head = String(item.id).split(/[_:-]/)[0]
  return Number(head)
}

/** Día de la semana en la zona horaria del negocio (por defecto Colombia). */
export function weekdayInTimezone(date: Date, timeZone = 'America/Bogota'): WeekDay {
  try {
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(date).toLowerCase()
    if ((JS_DAY_TO_WEEKDAY as string[]).includes(name)) return name as WeekDay
  } catch { /* zona inválida: caer al día local */ }
  return JS_DAY_TO_WEEKDAY[date.getDay()]
}

// Los precios del escaparate son enteros (COP); el descuento también.
const round = (n: number) => Math.round(n)

// ── Filtros de vigencia ──────────────────────────────────────────────────────

export interface PromotionFilterContext {
  branchId?: number | null
  date?: Date
  timeZone?: string
}

/**
 * Deja solo las promociones aplicables al canal web en este momento/sucursal.
 * (La consulta ya filtra org, is_active, start_date y applies_to_web; aquí va
 * lo que PostgREST no puede expresar cómodo en una sola query.)
 */
export function filterActivePromotions(promos: PromotionRow[], ctx: PromotionFilterContext = {}): PromotionRow[] {
  const date = ctx.date || new Date()
  const dayName = weekdayInTimezone(date, ctx.timeZone)

  return promos.filter((p) => {
    if (!p.is_active) return false
    if (p.applies_to_web === false) return false
    if (p.start_date && new Date(p.start_date) > date) return false
    if (p.end_date && new Date(p.end_date) < date) return false
    if (p.usage_limit && Number(p.usage_count || 0) >= Number(p.usage_limit)) return false
    if (Array.isArray(p.applicable_days) && p.applicable_days.length > 0 && !p.applicable_days.includes(dayName)) return false
    // `branches` jsonb: null/[] = todas las sucursales.
    if (Array.isArray(p.branches) && p.branches.length > 0) {
      if (ctx.branchId == null) return false
      if (!p.branches.map(Number).includes(Number(ctx.branchId))) return false
    }
    return true
  })
}

// ── Reglas ───────────────────────────────────────────────────────────────────

function itemMatchesRules(item: ResolvedPromoItem, rules: PromotionRule[], appliesTo: string): boolean {
  if (appliesTo === 'all') return true
  if (!rules || rules.length === 0) return false

  let included = false
  let excluded = false

  // Una regla sobre un producto alcanza al propio producto y, si el ítem es una
  // variante, a su padre (promocionar "Camiseta" cubre "Camiseta XL").
  const matchesProduct = (ruleProductId: number | null) =>
    ruleProductId != null &&
    (ruleProductId === item.product_id || ruleProductId === item.parent_product_id)

  for (const rule of rules) {
    switch (rule.rule_type) {
      case 'include_product':
      case 'include_brand': // marca resuelta vía producto, igual que en el ERP
        if (matchesProduct(rule.product_id)) included = true
        break
      case 'exclude_product':
      case 'exclude_brand':
        if (matchesProduct(rule.product_id)) excluded = true
        break
      case 'include_category':
        if (rule.category_id != null && item.category_id === rule.category_id) included = true
        break
      case 'exclude_category':
        if (rule.category_id != null && item.category_id === rule.category_id) excluded = true
        break
    }
  }

  const hasIncludeRules = rules.some((r) => String(r.rule_type).startsWith('include_'))
  if (hasIncludeRules) return included && !excluded
  // Solo reglas de exclusión: todo salvo lo excluido.
  return !excluded
}

function rulesOf(p: PromotionRow): PromotionRule[] {
  // PostgREST embebe con el nombre de la tabla (`promotion_rules`).
  return (p.promotion_rules ?? p.rules ?? []) as PromotionRule[]
}

// ── Cálculo por promoción ────────────────────────────────────────────────────

interface PromoDiscountResult {
  discount: number
  perItem: Record<string, number> // id de línea → monto
}

function calculatePromotionDiscount(promo: PromotionRow, items: ResolvedPromoItem[]): PromoDiscountResult {
  const perItem: Record<string, number> = {}
  let total = 0
  const add = (item: ResolvedPromoItem, amount: number) => {
    const d = round(amount)
    if (d <= 0) return
    const key = String(item.id)
    perItem[key] = (perItem[key] || 0) + d
    total += d
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const value = Number(promo.discount_value || 0)

  switch (promo.promotion_type) {
    case 'percentage': {
      const pct = value / 100
      for (const item of items) add(item, item.price * item.quantity * pct)
      break
    }
    case 'fixed_amount': {
      // Monto fijo repartido proporcionalmente entre las líneas aplicables.
      if (subtotal > 0 && value > 0) {
        const capped = Math.min(value, subtotal)
        for (const item of items) add(item, capped * ((item.price * item.quantity) / subtotal))
      }
      break
    }
    case 'buy_x_get_y': {
      // Por cada (X+Y) unidades del mismo producto, Y unidades gratis (las más baratas).
      const buyQty = Number(promo.buy_quantity || 0)
      const getQty = Number(promo.get_quantity || 0)
      if (buyQty > 0 && getQty > 0) {
        const byProduct = new Map<number, ResolvedPromoItem[]>()
        for (const item of items) {
          const arr = byProduct.get(item.product_id) || []
          arr.push(item)
          byProduct.set(item.product_id, arr)
        }
        for (const group of byProduct.values()) {
          const totalQty = group.reduce((s, i) => s + i.quantity, 0)
          const sets = Math.floor(totalQty / (buyQty + getQty))
          if (sets <= 0) continue
          let remainingFree = sets * getQty
          for (const item of [...group].sort((a, b) => a.price - b.price)) {
            if (remainingFree <= 0) break
            const free = Math.min(remainingFree, item.quantity)
            add(item, free * item.price)
            remainingFree -= free
          }
        }
      }
      break
    }
    case 'bundle': {
      // Simplificación (igual que el ERP): porcentaje sobre el subtotal aplicable.
      const pct = value / 100
      for (const item of items) add(item, item.price * item.quantity * pct)
      break
    }
    // 'free_shipping' no descuenta productos; se ignora aquí.
  }

  // Tope de descuento, repartido proporcionalmente.
  const cap = Number(promo.max_discount_amount || 0)
  if (cap > 0 && total > cap) {
    const ratio = cap / total
    let acc = 0
    const keys = Object.keys(perItem)
    keys.forEach((k, idx) => {
      // El último absorbe el redondeo para que la suma sea exactamente el tope.
      perItem[k] = idx === keys.length - 1 ? cap - acc : round(perItem[k] * ratio)
      acc += perItem[k]
    })
    total = cap
  }

  return { discount: total, perItem }
}

// ── Evaluación (pura) ────────────────────────────────────────────────────────

export interface CalculateOptions extends PromotionFilterContext {
  /** Si ya se filtró vigencia fuera, poner `false` para no repetir. */
  applyFilters?: boolean
}

export function calculatePromotions(
  promotionsInput: PromotionRow[],
  items: ResolvedPromoItem[],
  opts: CalculateOptions = {},
): PromotionEvaluation {
  if (!items.length || !promotionsInput.length) return EMPTY

  const promotions = opts.applyFilters === false ? promotionsInput : filterActivePromotions(promotionsInput, opts)
  const cartSubtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)

  const eligible = promotions
    .filter((p) => !(p.min_purchase_amount && cartSubtotal < Number(p.min_purchase_amount)))
    // Mayor prioridad primero (mismo criterio que el ERP).
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))

  const forPromo = (p: PromotionRow) => {
    const applicable = items.filter((i) => itemMatchesRules(i, rulesOf(p), p.applies_to))
    return applicable.length ? { applicable, ...calculatePromotionDiscount(p, applicable) } : null
  }

  // Estrategia del ERP: una no-combinable compite contra la suma de las
  // combinables; gana lo que más descuenta. Entre las no-combinables se toma la
  // que más descuenta para ESTE carrito (empate → mayor prioridad, ya ordenadas):
  // una no-combinable que no toca ningún item del carrito no debe bloquear al
  // resto.
  const nonCombinable = eligible.filter((p) => !p.is_combinable)
  const combinable = eligible.filter((p) => !!p.is_combinable)

  let toApply: PromotionRow[] = combinable
  if (nonCombinable.length > 0) {
    let best: PromotionRow | null = null
    let bestDiscount = 0
    for (const p of nonCombinable) {
      const d = forPromo(p)?.discount ?? 0
      if (d > bestDiscount) { best = p; bestDiscount = d }
    }
    const combinableDiscount = combinable.reduce((s, p) => s + (forPromo(p)?.discount ?? 0), 0)
    if (best && bestDiscount >= combinableDiscount) toApply = [best]
  }

  const applied: AppliedPromotion[] = []
  const itemDiscounts: Record<string, number> = {}
  let totalDiscount = 0

  for (const promo of toApply) {
    const res = forPromo(promo)
    if (!res || res.discount <= 0) continue
    for (const [k, amt] of Object.entries(res.perItem)) itemDiscounts[k] = (itemDiscounts[k] || 0) + amt
    totalDiscount += res.discount
    applied.push({
      id: promo.id,
      name: promo.name,
      description: promo.description ?? null,
      promotion_type: String(promo.promotion_type),
      discount_value: Number(promo.discount_value || 0),
      discount: res.discount,
      affectedItems: res.applicable.map((i) => i.name),
      affectedItemIds: res.applicable.map((i) => i.id),
    })
  }

  // Nunca descontar más que el subtotal del carrito.
  if (totalDiscount > cartSubtotal) totalDiscount = cartSubtotal

  return { promotions: applied, totalDiscount, itemDiscounts }
}

// ── Evaluación con BD ────────────────────────────────────────────────────────

export interface EvaluateCartInput {
  organizationId: number
  branchId?: number | null
  items: PromoCartItem[]
  date?: Date
  timeZone?: string
}

/**
 * Carga promociones web vigentes de la organización y los datos de producto
 * (categoría / padre) de las líneas, y calcula el descuento.
 * `supabase` es un cliente de servidor (admin o público).
 */
export async function evaluateCartPromotions(supabase: any, input: EvaluateCartInput): Promise<PromotionEvaluation> {
  const { organizationId, branchId, items } = input
  if (!organizationId || !Array.isArray(items) || items.length === 0) return EMPTY

  const cleanItems: PromoCartItem[] = items
    .filter((i) => i && Number(i.quantity) > 0)
    .map((i) => ({ id: i.id, productId: i.productId ?? null, name: String(i.name ?? ''), price: Number(i.price) || 0, quantity: Number(i.quantity) || 0 }))
  if (cleanItems.length === 0) return EMPTY

  const now = (input.date || new Date()).toISOString()
  const { data: promos, error } = await supabase
    .from('promotions')
    .select('*, promotion_rules(id, rule_type, product_id, category_id)')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .eq('applies_to_web', true)
    .lte('start_date', now)

  if (error) {
    console.error('[Promotions] Error cargando promociones:', error)
    return EMPTY
  }
  if (!promos || promos.length === 0) return EMPTY

  // Resolver categoría y padre de cada producto (el carrito no los guarda).
  const productIds = Array.from(new Set(cleanItems.map(realProductId).filter((n) => Number.isFinite(n))))
  const productMap = new Map<number, { category_id: number | null; parent_product_id: number | null }>()
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, category_id, parent_product_id')
      .eq('organization_id', organizationId)
      .in('id', productIds)
    for (const p of products || []) {
      productMap.set(Number(p.id), { category_id: p.category_id ?? null, parent_product_id: p.parent_product_id ?? null })
    }
  }

  const resolved: ResolvedPromoItem[] = cleanItems.map((i) => {
    const pid = realProductId(i)
    const meta = productMap.get(pid)
    return { ...i, product_id: pid, category_id: meta?.category_id ?? null, parent_product_id: meta?.parent_product_id ?? null }
  })

  return calculatePromotions(promos as PromotionRow[], resolved, { branchId, date: input.date, timeZone: input.timeZone })
}
