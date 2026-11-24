'use client'

/**
 * Promociones en el resumen del checkout (Figma «16 Sitio web» S7 3010:76051, S8 3010:76225).
 * Archivo aparte para no reescribir `CheckoutWizard.tsx` (ruta del dinero): el wizard solo monta
 * estas piezas en los dos puntos donde antes pintaba lo mismo a mano.
 *
 * Paso 1 (extracción, sin cambio de comportamiento): `DescuentosPorPromocion` con `agrupar=false`
 * pinta exactamente las filas de antes (una por promoción, verde, con su ícono).
 * Paso 2 (diseño aprobado): con `agrupar` (lo que usa el wizard), «Descuentos por promoción −$ …»
 * y el desglose en una caja verde; y por línea, `PromoDeLinea`: «Mayoristas de bebidas · $ 8.800
 * c/u» (el Figma dice «12 o más a $ 8.800 c/u»; la pista del servidor trae el precio, no el escalón).
 *
 * Solo pinta lo que devolvió /api/promotions/check (`useCartPromotions`); los montos los vuelve a
 * calcular /api/orders.
 */
import { Tag } from 'lucide-react'
import type { AppliedPromotion, VolumeHint } from '@/lib/promotions'

const VERDE = '#15803D'

export function DescuentosPorPromocion({ promotions, totalDiscount, fmt, agrupar = true }: {
  promotions: AppliedPromotion[]
  totalDiscount: number
  fmt: (n: number) => string
  /** false = las filas de antes (paso 1 de la extracción). */
  agrupar?: boolean
}) {
  if (!agrupar) {
    return (
      <>
        {promotions.map((promo) => (
          <div key={promo.id} className="flex justify-between text-sm mt-1 text-green-600">
            <span className="flex items-center gap-1 truncate flex-1 mr-2" title={promo.description || promo.name}>
              <Tag className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{promo.name}</span>
            </span>
            <span className="flex-shrink-0">-{fmt(promo.discount)}</span>
          </div>
        ))}
      </>
    )
  }
  if (promotions.length === 0) return null
  return (
    <div className="mt-1" data-descuentos-promocion="">
      <div className="flex justify-between text-sm font-semibold text-gray-900">
        <span>Descuentos por promoción</span>
        <span style={{ color: VERDE }}>−{fmt(totalDiscount)}</span>
      </div>
      <div className="mt-1 space-y-0.5 rounded-lg bg-green-50 px-3 py-2 text-xs" style={{ color: VERDE }}>
        {promotions.map((promo) => (
          <div key={promo.id} className="flex justify-between gap-2">
            <span className="truncate" title={promo.description || promo.name}>{promo.name}</span>
            <span className="flex-shrink-0">−{fmt(promo.discount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * La promoción de una línea del resumen: «Mayoristas de bebidas · 12 o más a $ 8.800 c/u» si es
 * precio por volumen (pista del servidor), o su nombre.
 */
export function PromoDeLinea({ promos, pista, fmt }: {
  promos: AppliedPromotion[]
  pista?: VolumeHint | null
  fmt: (n: number) => string
}) {
  if (promos.length === 0) return null
  return (
    <span className="mt-0.5 block text-xs" style={{ color: VERDE }} data-promo-linea="">
      {promos.map((p) => {
        const volumen = pista && pista.promotionId === p.id && p.promotion_type === 'volume_tiers'
        return (
          <span key={p.id} className="flex items-start gap-1">
            <Tag className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span>
              {p.name}
              {volumen && ` · ${fmt(pista!.unitPrice)} c/u`}
            </span>
          </span>
        )
      })}
    </span>
  )
}
