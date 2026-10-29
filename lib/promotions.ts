/**
 * Motor de promociones automáticas del escaparate web.
 *
 * Espejo del motor puro del ERP (`src/lib/promotions/motorPromociones.ts`,
 * canal `web`), para que el cliente vea en el carrito/checkout exactamente el
 * mismo descuento que luego calcula el POS. Mantener ambos alineados: mismos
 * valores de `promotion_type`, `applies_to` y `rule_type`, y la misma cuenta
 * de cantidad mínima, compra mínima, repetición cada N y paquetes. La cantidad mínima es
 * solo `min_quantity`. Vacía es sin mínimo: `buy_quantity` no se usa
 * para deducirla. Compra X Lleva Y no la mira. El redondeo de aquí sigue
 * siendo a pesos enteros; el del ERP, a centavos.
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
  /** Unidades de este producto en un paquete. Nulo = 1. */
  quantity?: number | null
}

export interface PromotionRow {
  id: string
  name: string
  description: string | null
  promotion_type: PromotionType | string
  discount_value: number | string | null
  buy_quantity: number | string | null
  get_quantity: number | null
  min_purchase_amount: number | string | null
  /** `eligible` = líneas de la promo. `cart` = toda la cuenta. Nulo = se deriva. */
  min_purchase_scope?: string | null
  /** Unidades mínimas de las líneas que entran. Solo porcentaje, monto fijo y paquete. */
  min_quantity?: number | string | null
  /**
   * Repite el descuento cada N unidades. Nulo = el comportamiento de siempre:
   * porcentaje sobre todas las unidades, monto fijo una vez, paquete sin tope.
   */
  repeat_every_quantity?: number | string | null
  max_discount_amount: number | string | null
  applies_to: PromotionAppliesTo | string
  start_date: string | null
  end_date: string | null
  is_active: boolean
  usage_limit: number | null
  usage_count: number | null
  is_combinable: boolean | null
  priority: number | null
  /** Desempate cuando el descuento y la prioridad coinciden: gana la más antigua. */
  created_at?: string | null
  branches: number[] | null
  applies_to_web: boolean | null
  /** ERP 20261028180000: métodos con los que aplica. NULL/[]/ausente = cualquier método. */
  payment_method_codes?: string[] | null
  applicable_days: WeekDay[] | string[] | null
  /** `HH:mm` o `HH:mm:ss` en la zona del negocio. Nulo = todo el día. */
  start_time?: string | null
  end_time?: string | null
  /** Precio del paquete. Si es mayor que cero, manda sobre el porcentaje. */
  bundle_price?: number | string | null
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
  /**
   * La línea no recibe promoción y no cuenta para mínimos, paquetes,
   * «lleve X» ni «cada N». El POS la marca al quitar la promoción.
   */
  promo_excluded?: boolean | null
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

/**
 * Unidades gratis de «compra X lleva Y».
 * Si Y < X, la etiqueta es «XxY» (llevas X, pagas Y): de cada X, X−Y de regalo.
 * Si Y ≥ X, Y son unidades gratis además de las X que se pagan.
 * Misma regla que `unidadesGratisCompraLleva` del ERP.
 */
export function unidadesGratisCompraLleva(unidades: number, compra: number, lleva: number): number {
  const n = Math.floor(unidades)
  const x = Math.trunc(compra)
  const y = Math.trunc(lleva)
  if (n <= 0 || x <= 0 || y <= 0) return 0
  if (y < x) return Math.floor(n / x) * (x - y)
  return Math.floor(n / (x + y)) * y
}

function horaEnZona(date: Date, timeZone = 'America/Bogota'): string {
  try {
    const partes = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone,
    }).formatToParts(date)
    const tomar = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)?.value ?? '00'
    return `${tomar('hour')}:${tomar('minute')}:${tomar('second')}`
  } catch {
    return '00:00:00'
  }
}

function horaNormalizada(valor: string | null | undefined): string | null {
  if (valor == null || valor === '') return null
  const m = String(valor).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const hh = m[1].padStart(2, '0')
  const mm = m[2]
  const ss = (m[3] ?? '00').padStart(2, '0')
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) return null
  return `${hh}:${mm}:${ss}`
}

/** Sin horas, todo el día. Si el fin es anterior al inicio, cruza la medianoche. */
function enFranjaHoraria(inicio: string | null | undefined, fin: string | null | undefined, hora: string): boolean {
  const a = horaNormalizada(inicio)
  const b = horaNormalizada(fin)
  if (!a && !b) return true
  if (a && !b) return hora >= a
  if (!a && b) return hora <= b
  if (a! <= b!) return hora >= a! && hora <= b!
  return hora >= a! || hora <= b!
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

// ── Método de pago (ERP 20261028180000) ─────────────────────────────────────

/** Códigos válidos de `payment_method_codes`; null si no restringe (NULL, [], ausente). */
export function codigosMetodoPromocion(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const codigos = v.map((c) => String(c ?? '').trim()).filter(Boolean)
  return codigos.length > 0 ? codigos : null
}

/** ¿La promoción aplica con este método? Sin restricción, siempre; con restricción, solo con uno de la lista. */
export function promocionAplicaConMetodo(codigosPromocion: unknown, metodo: string | null | undefined): boolean {
  const codigos = codigosMetodoPromocion(codigosPromocion)
  if (!codigos) return true
  if (typeof metodo !== 'string' || !metodo.trim()) return false
  return codigos.includes(metodo.trim())
}

// ── Filtros de vigencia ──────────────────────────────────────────────────────

export interface PromotionFilterContext {
  branchId?: number | null
  /**
   * Método de pago elegido (código de organization_payment_methods). Una
   * promoción con `payment_method_codes` solo aplica con uno de ellos; sin
   * método elegido (drawer, /carrito) todavía no aplica. NULL = cualquiera.
   */
  paymentMethod?: string | null
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
    if (!enFranjaHoraria(p.start_time, p.end_time, horaEnZona(date, ctx.timeZone))) return false
    // `branches` jsonb: null/[] = todas las sucursales.
    if (Array.isArray(p.branches) && p.branches.length > 0) {
      if (ctx.branchId == null) return false
      if (!p.branches.map(Number).includes(Number(ctx.branchId))) return false
    }
    if (!promocionAplicaConMetodo(p.payment_method_codes, ctx.paymentMethod)) return false
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

function positiveInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Toda la cuenta si la promo es general o el alcance es `cart`. Si no, las líneas que entran. */
function purchaseScope(p: PromotionRow): 'eligible' | 'cart' {
  if (p.min_purchase_scope === 'cart' || p.min_purchase_scope === 'eligible') return p.min_purchase_scope
  return p.applies_to === 'all' ? 'cart' : 'eligible'
}

function eligibleUnits(items: ResolvedPromoItem[]): number {
  return items.reduce((s, i) => s + Number(i.quantity), 0)
}

/**
 * Porcentaje, monto fijo y paquete. Solo `min_quantity`. Vacía es sin
 * mínimo. Compra X Lleva Y devuelve null. Igual que el POS.
 */
function cantidadMinimaEfectiva(p: PromotionRow): number | null {
  const tipo = String(p.promotion_type)
  if (tipo !== 'percentage' && tipo !== 'fixed_amount' && tipo !== 'bundle') return null
  return positiveInt(p.min_quantity)
}

function bundleRequirements(promo: PromotionRow): Array<{ productId: number; perPackage: number }> {
  const map = new Map<number, number>()
  for (const r of rulesOf(promo)) {
    if (r.rule_type !== 'include_product' || r.product_id == null) continue
    const q = positiveInt(r.quantity) ?? 1
    map.set(r.product_id, Math.max(map.get(r.product_id) ?? 0, q))
  }
  return Array.from(map.entries()).map(([productId, perPackage]) => ({ productId, perPackage }))
}

function assignBundle(item: ResolvedPromoItem, reqs: Array<{ productId: number }>): number | null {
  if (reqs.some((r) => r.productId === item.product_id)) return item.product_id
  if (item.parent_product_id != null && reqs.some((r) => r.productId === item.parent_product_id)) {
    return item.parent_product_id
  }
  return null
}

/** Reparte un entero en proporción. La última entrada absorbe el redondeo. */
function splitAmount(amount: number, weights: Array<{ key: string; weight: number }>): Record<string, number> {
  const out: Record<string, number> = {}
  const sum = weights.reduce((s, w) => s + w.weight, 0)
  if (!(amount > 0) || !(sum > 0)) return out
  let acc = 0
  weights.forEach((w, i) => {
    const part = i === weights.length - 1 ? amount - acc : round((amount * w.weight) / sum)
    if (part > 0) out[w.key] = (out[w.key] || 0) + part
    acc += part > 0 ? part : 0
  })
  return out
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
      const every = positiveInt(promo.repeat_every_quantity)
      if (every == null) {
        for (const item of items) add(item, item.price * item.quantity * pct)
      } else {
        let left = Math.floor(eligibleUnits(items) / every) * every
        for (const item of items) {
          if (left <= 0) break
          const take = Math.min(Number(item.quantity), left)
          add(item, take * item.price * pct)
          left -= take
        }
      }
      break
    }
    case 'fixed_amount': {
      // Un monto, o floor(unidades/N) veces ese monto, repartido entre las
      // líneas que entran y nunca más que su subtotal.
      const every = positiveInt(promo.repeat_every_quantity)
      let amount = value
      if (every != null) {
        const groups = Math.floor(eligibleUnits(items) / every)
        amount = groups > 0 ? groups * value : 0
      }
      if (subtotal > 0 && amount > 0) {
        const capped = Math.min(amount, subtotal)
        for (const item of items) add(item, capped * ((item.price * item.quantity) / subtotal))
      }
      break
    }
    case 'buy_x_get_y': {
      // Misma regla que el ERP: Y < X regala X−Y por cada X; si no, Y gratis por cada X+Y.
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
          let remainingFree = unidadesGratisCompraLleva(totalQty, buyQty, getQty)
          if (remainingFree <= 0) continue
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
      const precio = Number(promo.bundle_price || 0)
      const reqs = bundleRequirements(promo)
      if (precio > 0 && reqs.length > 0) {
        const assigned = new Map<number, ResolvedPromoItem[]>()
        for (const item of items) {
          const dest = assignBundle(item, reqs)
          if (dest == null) continue
          const arr = assigned.get(dest) || []
          arr.push(item)
          assigned.set(dest, arr)
        }
        let packages = Number.POSITIVE_INFINITY
        for (const req of reqs) {
          const qty = (assigned.get(req.productId) || []).reduce((s, i) => s + Number(i.quantity), 0)
          packages = Math.min(packages, Math.floor(qty / req.perPackage))
        }
        if (Number.isFinite(packages) && packages > 0) {
          // Con N, como máximo floor(unidades que entran / N) paquetes llevan
          // el precio. NULL no limita: todos los paquetes completos, como antes.
          const every = positiveInt(promo.repeat_every_quantity)
          if (every != null) packages = Math.min(packages, Math.floor(eligibleUnits(items) / every))
        }
        if (Number.isFinite(packages) && packages > 0) {
          const consumed: Array<{ key: string; weight: number }> = []
          for (const req of reqs) {
            let left = packages * req.perPackage
            for (const item of assigned.get(req.productId) || []) {
              if (left <= 0) break
              const take = Math.min(Number(item.quantity), left)
              const worth = take * Number(item.price)
              if (worth > 0) consumed.push({ key: String(item.id), weight: worth })
              left -= take
            }
          }
          const worth = consumed.reduce((s, c) => s + c.weight, 0)
          const discount = round(worth - packages * precio)
          if (discount > 0) {
            const parts = splitAmount(discount, consumed)
            for (const item of items) {
              const part = parts[String(item.id)]
              if (part > 0) add(item, part)
            }
          }
        }
      } else if (!(precio > 0) && value > 0) {
        // Sin precio de paquete es un porcentaje, con la misma repetición.
        const pct = value / 100
        const every = positiveInt(promo.repeat_every_quantity)
        if (every == null) {
          for (const item of items) add(item, item.price * item.quantity * pct)
        } else {
          let left = Math.floor(eligibleUnits(items) / every) * every
          for (const item of items) {
            if (left <= 0) break
            const take = Math.min(Number(item.quantity), left)
            add(item, take * item.price * pct)
            left -= take
          }
        }
      }
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

// ── Exclusividad por líneas que se solapan ──────────────────────────────────
// Misma regla que `evaluarPromociones` del ERP. Una promoción de cuenta
// (`applies_to = all` o compra mínima sobre toda la cuenta) toca todas las
// líneas y compite como antes. Dos no combinables sobre productos distintos
// no se pisan y se aplican las dos. Dentro de un grupo, gana la de mayor
// prioridad; empate, la que más descuenta; sigue el empate, la más antigua.

interface CalculoWeb {
  promo: PromotionRow
  applicable: ResolvedPromoItem[]
  discount: number
  perItem: Record<string, number>
  grupo: string[]
}

function esDeCuenta(p: PromotionRow): boolean {
  return p.applies_to === 'all' || purchaseScope(p) === 'cart'
}

function seCruzanIds(a: string[], b: string[]): boolean {
  const menor = a.length <= b.length ? a : b
  const mayor = new Set(a.length <= b.length ? b : a)
  return menor.some((id) => mayor.has(id))
}

function componentesWeb(calculos: CalculoWeb[]): CalculoWeb[][] {
  const n = calculos.length
  const padre = Array.from({ length: n }, (_, i) => i)
  const encontrar = (i: number): number => {
    let x = i
    while (padre[x] !== x) {
      padre[x] = padre[padre[x]]
      x = padre[x]
    }
    return x
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!seCruzanIds(calculos[i].grupo, calculos[j].grupo)) continue
      const ra = encontrar(i)
      const rb = encontrar(j)
      if (ra !== rb) padre[rb] = ra
    }
  }
  const grupos = new Map<number, CalculoWeb[]>()
  calculos.forEach((c, i) => {
    const r = encontrar(i)
    const arr = grupos.get(r) ?? []
    arr.push(c)
    grupos.set(r, arr)
  })
  return Array.from(grupos.values())
}

function fechaPromo(v: string | null | undefined): number {
  const t = v ? new Date(v).getTime() : NaN
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
}

function compararCompetidorasWeb(a: CalculoWeb, b: CalculoWeb): number {
  const pa = Number(a.promo.priority || 0)
  const pb = Number(b.promo.priority || 0)
  if (pa !== pb) return pb - pa
  if (a.discount !== b.discount) return b.discount - a.discount
  const ca = fechaPromo(a.promo.created_at)
  const cb = fechaPromo(b.promo.created_at)
  if (ca !== cb) return ca < cb ? -1 : 1
  return String(a.promo.id) < String(b.promo.id) ? -1 : String(a.promo.id) > String(b.promo.id) ? 1 : 0
}

function elegirEnComponenteWeb(grupo: CalculoWeb[]): CalculoWeb[] {
  const combinables = grupo.filter((c) => !!c.promo.is_combinable)
  const exclusivas = grupo.filter((c) => !c.promo.is_combinable).sort(compararCompetidorasWeb)
  const suma = combinables.reduce((s, c) => s + c.discount, 0)
  const mejor = exclusivas[0] ?? null
  if (mejor && mejor.discount >= suma) return [mejor]
  return combinables
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
  // Una línea excluida no entra: ni descuento, ni mínimos, ni paquetes, ni «lleve X», ni «cada N».
  const vivos = items.filter((i) => i.promo_excluded !== true && Number(i.quantity) > 0 && Number(i.price) >= 0)
  const cartSubtotal = vivos.reduce((s, i) => s + i.price * i.quantity, 0)
  const idsVivos = vivos.map((i) => String(i.id))

  const passesGates = (p: PromotionRow, applicable: ResolvedPromoItem[]): boolean => {
    const minMoney = Number(p.min_purchase_amount || 0)
    if (minMoney > 0) {
      const base = purchaseScope(p) === 'cart'
        ? cartSubtotal
        : applicable.reduce((s, i) => s + i.price * i.quantity, 0)
      if (base < minMoney) return false
    }
    const minQty = cantidadMinimaEfectiva(p)
    if (minQty != null && eligibleUnits(applicable) < minQty) return false
    return true
  }

  const listos: CalculoWeb[] = []
  for (const p of promotions) {
    const applicable = vivos.filter((i) => itemMatchesRules(i, rulesOf(p), p.applies_to))
    if (!applicable.length || !passesGates(p, applicable)) continue
    const res = calculatePromotionDiscount(p, applicable)
    if (!(res.discount > 0)) continue
    listos.push({
      promo: p,
      applicable,
      discount: res.discount,
      perItem: res.perItem,
      grupo: esDeCuenta(p) ? idsVivos : applicable.map((i) => String(i.id)),
    })
  }

  const toApply = componentesWeb(listos).flatMap(elegirEnComponenteWeb)

  const applied: AppliedPromotion[] = []
  const itemDiscounts: Record<string, number> = {}
  let totalDiscount = 0

  for (const res of toApply) {
    if (res.discount <= 0) continue
    for (const [k, amt] of Object.entries(res.perItem)) itemDiscounts[k] = (itemDiscounts[k] || 0) + amt
    totalDiscount += res.discount
    applied.push({
      id: res.promo.id,
      name: res.promo.name,
      description: res.promo.description ?? null,
      promotion_type: String(res.promo.promotion_type),
      discount_value: Number(res.promo.discount_value || 0),
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
  /** Método de pago elegido (ver PromotionFilterContext.paymentMethod). */
  paymentMethod?: string | null
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
  const { organizationId, branchId, items, paymentMethod } = input
  if (!organizationId || !Array.isArray(items) || items.length === 0) return EMPTY

  const cleanItems: PromoCartItem[] = items
    .filter((i) => i && Number(i.quantity) > 0)
    .map((i) => ({
      id: i.id,
      productId: i.productId ?? null,
      name: String(i.name ?? ''),
      price: Number(i.price) || 0,
      quantity: Number(i.quantity) || 0,
      ...(i.promo_excluded === true ? { promo_excluded: true as const } : {}),
    }))
  if (cleanItems.length === 0) return EMPTY

  const now = (input.date || new Date()).toISOString()
  const { data: promos, error } = await supabase
    .from('promotions')
    .select('*, promotion_rules(id, rule_type, product_id, category_id, quantity)')
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

  return calculatePromotions(promos as PromotionRow[], resolved, { branchId, paymentMethod, date: input.date, timeZone: input.timeZone })
}
