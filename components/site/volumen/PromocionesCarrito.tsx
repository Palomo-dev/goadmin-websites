'use client'

/**
 * Promociones en el cajón del carrito (Figma «16 Sitio web» S5 3009:117007, S6 3009:117283):
 *  - por línea: precio por unidad con la promoción y el normal tachado («$ 9.500 c/u $ 11.000»),
 *    total de la línea con su tachado, chip con el nombre de la promoción y el ahorro, y el
 *    empujón del precio por volumen («Agrega 6 más y cada una te queda en $ 8.800 · +6», que
 *    suma esas unidades) y el de «compra X lleva Y» («Agrega 1 más y llévala gratis (2×1).
 *    · Agregar 1»);
 *  - en el pie: «Promociones −$ …» con el desglose por promoción y «Ahorras $ … con promociones».
 *
 * Todo sale de la respuesta de /api/promotions/check (`useCartPromotions`): el mismo cálculo que
 * cobra /api/orders. Aquí no se calcula ningún descuento.
 */
import { Tag, TrendingUp } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { promotionsForItem, type AppliedPromotion } from '@/lib/hooks/useCartPromotions'
import type { FreeUnitHint, VolumeHint } from '@/lib/promotions'

const VERDE = '#15803D'

interface LineaCarrito {
  id: number | string
  price: number
  quantity: number
  comparePrice?: number | null
}

/** Tipos cuyo descuento se puede leer como «precio por unidad» (no un regalo ni un paquete). */
const POR_UNIDAD = new Set(['percentage', 'fixed_amount', 'volume_tiers'])

/** «Agrega 1 más y llévala gratis (2×1).» y sus variantes con más unidades. */
export function textoEmpujonGratis(p: Pick<FreeUnitHint, 'missing' | 'freeUnits' | 'label'>): string {
  if (p.freeUnits > 1) return `Agrega ${p.missing} más y ${p.freeUnits} te salen gratis (${p.label}).`
  if (p.missing === 1) return `Agrega 1 más y llévala gratis (${p.label}).`
  return `Agrega ${p.missing} más y una te sale gratis (${p.label}).`
}

export function PreciosPromoLinea({ item, promotions, itemDiscounts, volumeHints, freeHints, primaryColor, onSumar }: {
  item: LineaCarrito
  promotions: AppliedPromotion[]
  itemDiscounts: Record<string, number>
  volumeHints?: Record<string, VolumeHint>
  /** Empujón de «compra X lleva Y» por línea (`freeHints` de /api/promotions/check). */
  freeHints?: Record<string, FreeUnitHint>
  primaryColor: string
  /** Suma unidades a la línea (empujón «+6»). */
  onSumar: (unidades: number) => void
}) {
  const clave = String(item.id)
  const promos = promotionsForItem(promotions, item.id)
  const descuento = itemDiscounts[clave] || 0
  const cantidad = Math.max(1, Number(item.quantity) || 1)
  const bruto = Number(item.price) * cantidad
  const pista = volumeHints?.[clave]
  // La pista vale si su promoción es la que se aplicó a la línea (otra pudo ganarle).
  const pistaAplicada = !!pista && promos.some((p) => p.id === pista.promotionId)
  const porUnidad = descuento > 0 && promos.length > 0 && promos.every((p) => POR_UNIDAD.has(p.promotion_type))
  const unitario = porUnidad ? Math.round((bruto - descuento) / cantidad) : Number(item.price)
  const anterior = porUnidad
    ? Number(item.price)
    : item.comparePrice && Number(item.comparePrice) > Number(item.price) ? Number(item.comparePrice) : null
  // Empujón: solo si la promoción por volumen aplica (o aún no llega a ningún escalón).
  const siguiente = pista?.next && (pistaAplicada || descuento === 0) ? pista.next : null
  // «Compra X lleva Y»: con la misma condición (su promoción es la aplicada o la línea no tiene otra).
  const gratis = freeHints?.[clave]
  const empujonGratis = gratis && gratis.missing > 0 && (promos.some((p) => p.id === gratis.promotionId) || descuento === 0) ? gratis : null

  return (
    <div className="mt-0.5 space-y-1" data-promo-linea="">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="flex items-baseline gap-1.5 text-sm">
          <Price value={unitario} className="text-gray-600 dark:text-gray-300" />
          {(porUnidad || pistaAplicada) && <span className="text-xs text-gray-500">c/u</span>}
          {anterior !== null && <Price value={anterior} className="text-xs text-gray-400 line-through" />}
        </span>
        <span className="text-right">
          <Price value={bruto - descuento} className="block text-sm font-bold" style={{ color: primaryColor }} />
          {descuento > 0 && <Price value={bruto} className="block text-[11px] text-gray-400 line-through" />}
        </span>
      </div>

      {promos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {promos.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium dark:bg-green-900/30"
              style={{ color: VERDE }}
              title={p.name}
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              <span className="max-w-[12rem] truncate">{p.name}</span>
              {promos.length === 1 && descuento > 0 && <>{' · −'}<Price value={descuento} /></>}
            </span>
          ))}
        </div>
      )}

      {siguiente && siguiente.missing > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }} data-empujon-volumen="">
          <span className="flex items-start gap-1.5">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>Agrega {siguiente.missing} más y cada una te queda en <Price value={siguiente.unitPrice} />.</span>
          </span>
          <button type="button" onClick={() => onSumar(siguiente.missing)} className="flex-shrink-0 font-semibold hover:underline" aria-label={`Agregar ${siguiente.missing} unidades más`}>
            +{siguiente.missing}
          </button>
        </div>
      )}

      {empujonGratis && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ backgroundColor: `${primaryColor}14`, color: primaryColor }} data-empujon-gratis="">
          <span className="flex items-start gap-1.5">
            <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>{textoEmpujonGratis(empujonGratis)}</span>
          </span>
          <button type="button" onClick={() => onSumar(empujonGratis.missing)} className="flex-shrink-0 font-semibold hover:underline">
            Agregar {empujonGratis.missing}
          </button>
        </div>
      )}
    </div>
  )
}

/** «Promociones −$ …» con el desglose por promoción (pie del cajón y /carrito). */
export function DesglosePromociones({ promotions, totalDiscount, titulo = 'Promociones' }: {
  promotions: AppliedPromotion[]
  totalDiscount: number
  titulo?: string
}) {
  if (promotions.length === 0 || !(totalDiscount > 0)) return null
  return (
    <div className="space-y-0.5" data-desglose-promociones="">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-900 dark:text-white">{titulo}</span>
        <span className="font-medium" style={{ color: VERDE }}>−<Price value={totalDiscount} /></span>
      </div>
      {promotions.map((p) => (
        <div key={p.id} className="flex items-center justify-between pl-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="mr-2 truncate">{p.name}</span>
          <span className="flex-shrink-0">−<Price value={p.discount} /></span>
        </div>
      ))}
    </div>
  )
}

/** Franja «Ahorras $ … con promociones». */
export function AhorroPromociones({ monto, texto = 'con promociones' }: { monto: number; texto?: string }) {
  if (!(monto > 0)) return null
  return (
    <p className="rounded-lg bg-green-50 px-3 py-1.5 text-center text-sm font-medium dark:bg-green-900/20" style={{ color: VERDE }} data-ahorro-promociones="">
      Ahorras <Price value={monto} /> {texto}
    </p>
  )
}
