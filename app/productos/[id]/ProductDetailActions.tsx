'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AddToCartButton } from '@/components/site/AddToCartButton'
import { VariantSelector } from '@/components/site/VariantSelector'
import { ProductModifierSelector, type ProductModifierSelectorRef, type SelectedModifier, type ModifierGroup } from '@/components/site/ProductModifierSelector'
import { Zap, Minus, Plus, Loader2 } from 'lucide-react'
import { isOutOfStock } from '@/lib/stock'
import { agregarPlatoAlCarrito, MAX_NOTA_COCINA } from '@/lib/cart'
import { useCurrency } from '@/components/site/CurrencyProvider'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getVariantImageUrl(variant: any): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find((img: any) => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

interface ProductDetailActionsProps {
  product: any
  variants: any[]
  price: number
  comparePrice?: number | null
  imageUrl: string | null
  primaryColor: string
  isParent: boolean
  organizationSubdomain?: string
  modifierGroups?: ModifierGroup[]
  trackStock?: boolean
  stockLevels?: { qty_on_hand: number; qty_reserved: number }[]
  buttonsLayout?: 'stacked' | 'inline' | 'split'
  branchId?: number | null
  /**
   * Modo restaurante (organización type_id = 1, decidido en el servidor): «Agotado hoy en
   * <sede> · vuelve…» en vez de «Sin stock» y «Nota para la cocina».
   */
  restaurante?: {
    /** «Agotado hoy en Sede Norte · vuelve mañana», ya formateado en la zona de la organización. */
    textoAgotado: string | null
  } | null
  /** Pedido en línea activo (`website_settings.enable_online_ordering`). Sin él, no hay botones de compra. */
  puedePedir?: boolean
}

export function ProductDetailActions({
  product,
  variants,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent,
  organizationSubdomain,
  modifierGroups = [],
  trackStock,
  stockLevels,
  buttonsLayout = 'stacked',
  branchId,
  restaurante = null,
  puedePedir = true,
}: ProductDetailActionsProps) {
  const router = useRouter()
  const { formatPrice } = useCurrency()
  const [nota, setNota] = useState('')
  const sub = () => organizationSubdomain || window.location.hostname.split('.')[0]
  const modifierRef = useRef<ProductModifierSelectorRef>(null)
  const [selectedModifiers, setSelectedModifiers] = useState<SelectedModifier[]>([])
  const [quantity, setQuantity] = useState(1)
  const [comprando, setComprando] = useState(false)

  // /checkout es dinámico: traer su límite de carga por adelantado para que
  // «Comprar ahora» responda al instante.
  useEffect(() => {
    router.prefetch('/checkout')
  }, [router])

  // Al volver con «Atrás» la página puede restaurarse tal cual: soltar el botón.
  useEffect(() => {
    const alVolver = () => setComprando(false)
    window.addEventListener('pageshow', alVolver)
    return () => window.removeEventListener('pageshow', alVolver)
  }, [])

  // Navegación con respuesta visible y respaldo: si la navegación del cliente
  // no arranca en unos segundos, se hace una navegación completa.
  const irAlCheckout = () => {
    const desde = window.location.pathname
    setComprando(true)
    router.push('/checkout')
    window.setTimeout(() => {
      if (window.location.pathname === desde) window.location.assign('/checkout')
    }, 6000)
  }

  const modifiersExtraTotal = selectedModifiers.reduce((sum, m) => sum + (m.extraPrice || 0), 0)
  const effectivePrice = price + modifiersExtraTotal

  const outOfStock = isOutOfStock({ track_stock: trackStock, stock_levels: stockLevels })

  // Una sola escritura del carrito (lib/cart.ts) para variante, plato con opciones y producto
  // simple: id de línea, opciones y nota con el mismo formato que la carta.
  const lineaVariante = (variant: any, qty: number, mods: SelectedModifier[] = []) => {
    const variantPrice = Number(variant.product_prices?.[0]?.price ?? price) || 0
    const variantComparePrice = variant.product_prices?.[0]?.compare_price
    const extras = mods.reduce((t, m) => t + (m.extraPrice || 0), 0)
    return {
      productId: Number(variant.id),
      name: variant.name,
      sku: variant.sku ?? null,
      unitPrice: variantPrice + extras,
      quantity: Math.max(1, qty),
      imageUrl: getVariantImageUrl(variant) || imageUrl,
      comparePrice: extras === 0 && variantComparePrice ? Number(variantComparePrice) : null,
      modifiers: mods,
      notes: nota,
      variantAttributes: variant.variant_data ?? null,
    }
  }

  const handleVariantSelect = (variant: any, qty: number = 1, mods: SelectedModifier[] = []) => {
    agregarPlatoAlCarrito(sub(), branchId, lineaVariante(variant, qty, mods))
  }

  const handleBuyNowVariant = (variant: any, qty: number = 1, mods: SelectedModifier[] = []) => {
    // «Comprar ahora»: el carrito queda solo con esta línea.
    agregarPlatoAlCarrito(sub(), branchId, lineaVariante(variant, qty, mods), { reemplazar: true })
    irAlCheckout()
  }

  const lineaSimple = () => ({
    productId: Number(product.id),
    name: product.name,
    sku: product.sku ?? null,
    unitPrice: Number(effectivePrice),
    quantity,
    imageUrl,
    comparePrice: comparePrice ? Number(comparePrice) : null,
    modifiers: selectedModifiers,
    notes: nota,
  })

  const handleBuyNowSimple = () => {
    if (modifierGroups.length > 0 && modifierRef.current) {
      if (!modifierRef.current.validate()) return
    }
    agregarPlatoAlCarrito(sub(), branchId, lineaSimple(), { reemplazar: true })
    irAlCheckout()
  }

  const handleAddWithQuantity = () => {
    if (modifierGroups.length > 0 && modifierRef.current) {
      if (!modifierRef.current.validate()) return
    }
    agregarPlatoAlCarrito(sub(), branchId, lineaSimple())
  }

  const campoNota = restaurante && puedePedir ? (
    <div>
      <label htmlFor="nota-cocina" className="mb-1.5 block text-sm font-semibold text-gray-900 dark:text-white">
        Nota para la cocina <span className="font-normal text-gray-500">(opcional)</span>
      </label>
      <textarea
        id="nota-cocina"
        value={nota}
        onChange={(e) => setNota(e.target.value.slice(0, MAX_NOTA_COCINA))}
        maxLength={MAX_NOTA_COCINA}
        rows={2}
        placeholder="Ej.: sin cilantro, por favor"
        className="w-full resize-none rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm dark:border-gray-700"
      />
    </div>
  ) : null

  if (isParent && variants.length > 0) {
    if (!puedePedir) return null
    return (
      <div className="space-y-3 pt-4">
        <VariantSelector
          parentName={product.name}
          variants={variants}
          primaryColor={primaryColor}
          mode="inline"
          onSelect={handleVariantSelect}
          onBuyNow={handleBuyNowVariant}
          buyNowPending={comprando}
          modifierGroups={modifierGroups}
        />
        {campoNota}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-4">
      {/* Selector de modificadores (nuevo sistema ERP) */}
      {modifierGroups.length > 0 && (
        <ProductModifierSelector
          ref={modifierRef}
          groups={modifierGroups}
          primaryColor={primaryColor}
          onChange={setSelectedModifiers}
        />
      )}

      {/* Badge Agotado */}
      {outOfStock && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {restaurante ? restaurante.textoAgotado || 'Agotado' : 'Producto agotado'}
          </span>
        </div>
      )}

      {!puedePedir && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          El pedido en línea no está disponible en este momento.
        </p>
      )}

      {campoNota}

      {/* Selector de cantidad */}
      {puedePedir && (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Cantidad:</span>
        <div className={`flex items-center border rounded-lg ${outOfStock ? 'opacity-50 pointer-events-none' : ''}`}>
          <button
            type="button"
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            className="p-2 hover:bg-gray-100 rounded-l-lg transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="px-4 py-2 min-w-[3rem] text-center font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(q => q + 1)}
            className="p-2 hover:bg-gray-100 rounded-r-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      )}

      {/* Precio con extras (base + extras: no es un descuento, no va tachado) */}
      {modifiersExtraTotal > 0 && (
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            {formatPrice(effectivePrice)}
          </span>
          <span className="text-xs text-gray-500">{formatPrice(price)} + {formatPrice(modifiersExtraTotal)} en extras</span>
        </div>
      )}

      {/* Botones de acción */}
      {puedePedir && (
      <div className={buttonsLayout === 'inline' ? 'flex gap-3' : 'space-y-3'}>
        <AddToCartButton
          productId={product.id}
          productName={product.name}
          price={effectivePrice}
          imageUrl={imageUrl}
          primaryColor={primaryColor}
          variant="full"
          quantity={quantity}
          organizationSubdomain={organizationSubdomain}
          onClick={handleAddWithQuantity}
          disabled={outOfStock}
          className={buttonsLayout === 'inline' ? 'flex-1' : undefined}
          branchId={branchId}
        />

        <Button
          size="lg"
          variant="outline"
          className={buttonsLayout === 'inline' ? 'flex-1' : 'w-full'}
          style={{ borderColor: primaryColor, color: primaryColor }}
          onClick={handleBuyNowSimple}
          disabled={outOfStock || comprando}
          aria-busy={comprando}
        >
          {outOfStock ? (restaurante ? 'Agotado' : 'Sin stock') : comprando ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" />Abriendo el pago…</>) : (<><Zap className="h-5 w-5 mr-2" />Comprar ahora</>)}
        </Button>
      </div>
      )}
    </div>
  )
}
