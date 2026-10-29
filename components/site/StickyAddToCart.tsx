'use client'

import { useState, useEffect, useMemo, useId } from 'react'
import { ShoppingCart, Check, X, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { estadoStockCompra, primeraVarianteDisponible, cupoDisponible, AVISO_TOPE_CARRITO } from '@/lib/stock'
import { getProductQtyInCart, useCartProductQty } from '@/lib/cart'
import { emitirVariante, escucharVariante, escucharCantidad } from '@/lib/products/varianteSeleccionada'
import { useCurrency } from '@/components/site/CurrencyProvider'
import { getCartKey as getCartKeyUtil } from '@/lib/utils'
import { ordenarValoresAtributo, type OrdenAtributos } from '@/lib/products/ordenAtributos'

interface VariantData {
  id: number
  name: string
  variant_data?: Record<string, string>
  track_stock?: boolean
  stock_levels?: { qty_on_hand: number; qty_reserved: number }[] | null
  product_prices?: { price: number; compare_price?: number | null }[]
  product_images?: { storage_path: string | null; is_primary: boolean; shared_images?: { storage_path: string } | null }[]
}

interface StickyAddToCartProps {
  productId: number
  productName: string
  price: number
  comparePrice?: number | null
  imageUrl?: string | null
  primaryColor: string
  isParent?: boolean
  variants?: VariantData[]
  organizationSubdomain?: string
  trackStock?: boolean
  stockLevels?: { qty_on_hand: number; qty_reserved: number }[]
  branchId?: number | null
  /** `display_order` del catálogo. Sin él, XS…XXXL y números de menor a mayor. */
  ordenAtributos?: OrdenAtributos | null
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jgmgphmzusbluqhuqihj.supabase.co'

function getCartKey(orgSubdomain?: string, branchId?: number | null): string {
  const subdomain = orgSubdomain || window.location.hostname.split('.')[0]
  return getCartKeyUtil(subdomain, branchId)
}

function getVariantImg(variant: VariantData): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find(img => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`
}

export function StickyAddToCart({
  productId,
  productName,
  price,
  comparePrice,
  imageUrl,
  primaryColor,
  isParent = false,
  variants = [],
  organizationSubdomain,
  trackStock,
  stockLevels,
  branchId,
  ordenAtributos = null,
}: StickyAddToCartProps) {
  const [added, setAdded] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<VariantData | null>(null)
  const ORIGEN = useId()
  // Cantidad elegida en el selector principal, por producto/variante (sin dato: 1, como antes).
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  useEffect(() => escucharCantidad(ORIGEN, (id, cantidad) => setCantidades((c) => ({ ...c, [id]: cantidad }))), [ORIGEN])
  const [subdominio, setSubdominio] = useState(organizationSubdomain || '')
  useEffect(() => {
    if (!organizationSubdomain) setSubdominio(window.location.hostname.split('.')[0])
  }, [organizationSubdomain])
  const { formatPrice } = useCurrency()

  // Padre con variantes: manda la variante elegida (el padre suele tener stock 0).
  const { stock: stockDisponible, agotado: outOfStock } = estadoStockCompra({
    producto: { track_stock: trackStock, stock_levels: stockLevels },
    esPadre: isParent,
    variantes: variants,
    variante: selectedVariant,
  })

  const idLinea = isParent && selectedVariant ? selectedVariant.id : productId
  const enCarrito = useCartProductQty(subdominio, branchId, subdominio ? idLinea : null)
  const cupo = cupoDisponible(stockDisponible, enCarrito)
  const sinCupo = !outOfStock && cupo === 0

  // Extraer grupos de atributos
  const attributeGroups = useMemo(() => {
    const groups: Record<string, Set<string>> = {}
    variants.forEach(v => {
      if (v.variant_data) {
        Object.entries(v.variant_data).forEach(([key, value]) => {
          if (!groups[key]) groups[key] = new Set()
          groups[key].add(value)
        })
      }
    })
    const result: Record<string, string[]> = {}
    Object.entries(groups).forEach(([key, values]) => {
      result[key] = ordenarValoresAtributo(key, Array.from(values), ordenAtributos)
    })
    return result
  }, [variants, ordenAtributos])

  // Pre-seleccionar primera variante
  useEffect(() => {
    if (variants.length > 0 && !selectedVariant) {
      const inicial = primeraVarianteDisponible(variants)!
      setSelectedVariant(inicial)
      setSelectedAttributes(inicial.variant_data || {})
    }
  }, [variants])

  // Sincroniza con el otro selector de la ficha (barra fija ⇄ selector principal).
  useEffect(() => {
    return escucharVariante(ORIGEN, (id) => {
      const v = variants.find((x) => Number(x.id) === id)
      if (!v) return
      setSelectedVariant(v)
      setSelectedAttributes(v.variant_data || {})
    })
  }, [variants, ORIGEN])

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const findMatchingVariant = (attrs: Record<string, string>) => {
    return variants.find(v => {
      if (!v.variant_data) return false
      return Object.entries(attrs).every(([key, value]) => v.variant_data![key] === value)
    })
  }

  const handleAttributeSelect = (attrName: string, value: string) => {
    const newAttrs = { ...selectedAttributes, [attrName]: value }
    setSelectedAttributes(newAttrs)
    const matching = findMatchingVariant(newAttrs)
    if (matching) {
      setSelectedVariant(matching)
      emitirVariante(Number(matching.id), ORIGEN)
    }
  }

  const getActivePrice = () => {
    if (isParent && selectedVariant) {
      return Number(selectedVariant.product_prices?.[0]?.price || price)
    }
    return price
  }

  const getActiveComparePrice = () => {
    if (isParent && selectedVariant) {
      return selectedVariant.product_prices?.[0]?.compare_price ? Number(selectedVariant.product_prices[0].compare_price) : null
    }
    return comparePrice
  }

  const handleAddToCart = () => {
    if (outOfStock) return
    try {
      const cartKey = getCartKey(organizationSubdomain, branchId)
      const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
      const activePrice = getActivePrice()
      const activeCp = getActiveComparePrice()

      // Tope: unidades del producto ya en el carrito (todas sus líneas) contra el stock disponible.
      const idProducto = isParent && selectedVariant ? selectedVariant.id : productId
      const yaEnCarrito = getProductQtyInCart(organizationSubdomain || window.location.hostname.split('.')[0], branchId, idProducto)
      const cupoAhora = cupoDisponible(stockDisponible, yaEnCarrito)
      if (cupoAhora === 0) {
        setAviso(AVISO_TOPE_CARRITO)
        setTimeout(() => setAviso(null), 3000)
        return
      }
      // La cantidad elegida arriba, sin pasar del cupo.
      const elegida = Math.max(1, Math.trunc(cantidades[idProducto] ?? 1) || 1)
      const n = cupoAhora === null ? elegida : Math.min(elegida, cupoAhora)

      if (isParent && selectedVariant) {
        const variantImgUrl = getVariantImg(selectedVariant) || imageUrl
        const idx = cart.findIndex((c: any) => c.id === selectedVariant.id)
        if (idx >= 0) {
          cart[idx].quantity += n
        } else {
          cart.push({
            id: selectedVariant.id,
            name: selectedVariant.name,
            price: activePrice,
            quantity: n,
            ...(variantImgUrl && { imageUrl: variantImgUrl }),
            ...(activeCp && { comparePrice: activeCp }),
            ...(selectedVariant.variant_data && { variantAttributes: selectedVariant.variant_data })
          })
        }
      } else {
        const idx = cart.findIndex((c: any) => c.id === productId)
        if (idx >= 0) {
          cart[idx].quantity += n
        } else {
          cart.push({
            id: productId,
            name: productName,
            price: activePrice,
            quantity: n,
            ...(imageUrl && { imageUrl }),
            ...(activeCp && { comparePrice: activeCp })
          })
        }
      }

      localStorage.setItem(cartKey, JSON.stringify(cart))
      window.dispatchEvent(new CustomEvent('cart-updated'))
      setAdded(true)
      setExpanded(false)
      setTimeout(() => setAdded(false), 2000)
    } catch (e) {}
  }

  const activePrice = getActivePrice()
  const activeCp = getActiveComparePrice()
  const hasVariants = isParent && variants.length > 0

  return (
    <>
      {/* Overlay cuando está expandido */}
      {expanded && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setExpanded(false)} />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-transform duration-300 lg:hidden ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Panel expandido de variantes */}
        {expanded && hasVariants && (
          <div className="px-4 pt-4 pb-2 border-b max-h-[50vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-medium text-gray-700">Selecciona opciones</p>
              <button onClick={() => setExpanded(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {Object.entries(attributeGroups).map(([attrName, values]) => (
              <div key={attrName} className="mb-3">
                <label className="text-xs font-medium text-gray-600 capitalize mb-1 block">{attrName}:</label>
                <div className="flex flex-wrap gap-2">
                  {values.map((value) => {
                    const isSelected = selectedAttributes[attrName] === value
                    return (
                      <button
                        key={value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isSelected
                            ? 'text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-300'
                        }`}
                        style={isSelected ? { backgroundColor: primaryColor } : {}}
                        onClick={() => handleAttributeSelect(attrName, value)}
                      >
                        {value}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {(aviso || sinCupo) && (
          <p role="status" className="px-4 pt-2 text-center text-sm text-amber-700">{aviso || AVISO_TOPE_CARRITO}</p>
        )}

        {/* Barra principal */}
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {activeCp && activeCp > activePrice && (
                  <span className="text-xs text-gray-400 line-through">{formatPrice(activeCp)}</span>
                )}
                <span className="text-lg font-bold" style={{ color: primaryColor }}>
                  {formatPrice(activePrice)}
                </span>
              </div>
              {hasVariants && selectedVariant?.variant_data && (
                <p className="text-xs text-gray-500 truncate">
                  {Object.entries(selectedVariant.variant_data).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                </p>
              )}
            </div>

            {hasVariants && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="p-2 rounded-full border border-gray-300 hover:bg-gray-50"
              >
                <ChevronUp className="h-4 w-4 text-gray-600" />
              </button>
            )}

            <Button
              onClick={handleAddToCart}
              className={`px-6 py-2 transition-all ${added ? 'bg-green-500 hover:bg-green-600' : ''} ${outOfStock || sinCupo ? 'opacity-50' : ''}`}
              style={!added && !outOfStock && !sinCupo ? { backgroundColor: primaryColor } : {}}
              disabled={outOfStock || sinCupo}
            >
              {added ? (
                <><Check className="h-4 w-4 mr-1" /> Agregado</>
              ) : outOfStock ? (
                <><ShoppingCart className="h-4 w-4 mr-1" /> Sin stock</>
              ) : (
                <><ShoppingCart className="h-4 w-4 mr-1" /> Agregar al carrito</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
