'use client'
import { urlPublicaStorage } from '@/lib/storage/urlPublica'

import { useState, useEffect, useMemo, useId } from 'react'
import { estadoStockCompra, primeraVarianteDisponible, cupoDisponible, AVISO_TOPE_CARRITO } from '@/lib/stock'
import { getProductQtyInCart, useCartProductQty } from '@/lib/cart'
import { emitirVariante, escucharVariante, escucharCantidad } from '@/lib/products/varianteSeleccionada'
import { getCartKey as getCartKeyUtil } from '@/lib/utils'
import { ordenarValoresAtributo, type OrdenAtributos } from '@/lib/products/ordenAtributos'
import { useIrAlCheckout } from '@/components/site/ficha/useIrAlCheckout'
import { TEXTOS_SELECTOR_FICHA, textoElegirOpcion } from '@/lib/website/v2/contrato/seccionesTienda'

/**
 * Lógica de compra de la barra fija de la ficha (celular y computador): variantes y su
 * sincronización con el selector principal, stock, tope del carrito, cantidad, agregar y
 * «Comprar ahora». Salió tal cual de StickyAddToCart para que las dos barras no la dupliquen
 * (Figma 2836:69391, propuesta 9). Una sola instancia por ficha: la llama StickyAddToCart y le
 * pasa el resultado a cada barra.
 */

export interface VariantData {
  id: number
  name: string
  variant_data?: Record<string, string>
  track_stock?: boolean
  stock_levels?: { qty_on_hand: number; qty_reserved: number }[] | null
  product_prices?: { price: number; compare_price?: number | null }[]
  product_images?: { storage_path: string | null; is_primary: boolean; shared_images?: { storage_path: string } | null }[]
}

export interface DatosCompraBarraFija {
  productId: number
  productName: string
  price: number
  comparePrice?: number | null
  imageUrl?: string | null
  isParent?: boolean
  variants?: VariantData[]
  organizationSubdomain?: string
  trackStock?: boolean
  stockLevels?: { qty_on_hand: number; qty_reserved: number }[]
  branchId?: number | null
  /** `display_order` del catálogo. Sin él, XS…XXXL y números de menor a mayor. */
  ordenAtributos?: OrdenAtributos | null
  /**
   * «Botones de compra › Al abrir la ficha · Que el cliente elija» (`initial_variant: 'customer'`):
   * la barra tampoco elige talla sola. Ausente = primera disponible (lo de siempre).
   */
  clienteElige?: boolean
  /** Texto de «Elige tu {opción}» del editor (`choose_text`). Ausente = el de siempre. */
  textoElegir?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://taqjemqjtumhwptchcxk.supabase.co'

function getCartKey(orgSubdomain?: string, branchId?: number | null): string {
  const subdomain = orgSubdomain || window.location.hostname.split('.')[0]
  return getCartKeyUtil(subdomain, branchId)
}

export function getVariantImg(variant: VariantData): string | null {
  if (!variant.product_images || variant.product_images.length === 0) return null
  const primary = variant.product_images.find(img => img.is_primary) || variant.product_images[0]
  const path = primary.storage_path || primary.shared_images?.storage_path
  if (!path) return null
  return urlPublicaStorage(path, 'product-images', SUPABASE_URL)
}

export function useCompraBarraFija({
  productId,
  productName,
  price,
  comparePrice,
  imageUrl,
  isParent = false,
  variants = [],
  organizationSubdomain,
  trackStock,
  stockLevels,
  branchId,
  ordenAtributos = null,
  clienteElige = false,
  textoElegir = TEXTOS_SELECTOR_FICHA.elegir,
}: DatosCompraBarraFija) {
  const [added, setAdded] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariant, setSelectedVariant] = useState<VariantData | null>(null)
  const ORIGEN = useId()
  // Cantidad elegida en el selector principal (o en la barra), por producto/variante (sin dato: 1, como antes).
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  useEffect(() => escucharCantidad(ORIGEN, (id, cantidad) => setCantidades((c) => ({ ...c, [id]: cantidad }))), [ORIGEN])
  const [subdominio, setSubdominio] = useState(organizationSubdomain || '')
  useEffect(() => {
    if (!organizationSubdomain) setSubdominio(window.location.hostname.split('.')[0])
  }, [organizationSubdomain])
  const { comprando, irAlCheckout } = useIrAlCheckout()

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

  // Pre-seleccionar primera variante (salvo «Que el cliente elija»)
  useEffect(() => {
    if (clienteElige) return
    if (variants.length > 0 && !selectedVariant) {
      const inicial = primeraVarianteDisponible(variants)!
      setSelectedVariant(inicial)
      setSelectedAttributes(inicial.variant_data || {})
    }
  }, [variants, clienteElige])

  // Sincroniza con el otro selector de la ficha (barra fija ⇄ selector principal).
  useEffect(() => {
    return escucharVariante(ORIGEN, (id) => {
      const v = variants.find((x) => Number(x.id) === id)
      if (!v) return
      setSelectedVariant(v)
      setSelectedAttributes(v.variant_data || {})
    })
  }, [variants, ORIGEN])

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

  /** Cantidad que se agregará (la del selector principal o la de la barra). */
  const cantidad = Math.max(1, Math.trunc(cantidades[idLinea] ?? 1) || 1)
  /** La cantidad compacta de la barra: entre 1 y el cupo (sin tope si no se lleva stock). */
  const cambiarCantidad = (n: number) => {
    const tope = cupo === null ? Infinity : Math.max(1, cupo)
    const nueva = Math.min(tope, Math.max(1, Math.trunc(n) || 1))
    setCantidades((c) => ({ ...c, [idLinea]: nueva }))
  }

  /**
   * Escribe la línea en el carrito. `reemplazar` («Comprar ahora»): el carrito queda solo con
   * esta línea, como en los botones de la ficha. Devuelve si agregó.
   */
  const escribirLinea = (reemplazar: boolean): boolean => {
    if (outOfStock) return false
    // Producto con tallas y ninguna elegida («Que el cliente elija»): nunca se agrega el padre.
    if (isParent && variants.length > 0 && !selectedVariant) {
      setAviso(textoElegirOpcion(textoElegir, Object.keys(attributeGroups).find((a) => !selectedAttributes[a]) ?? Object.keys(attributeGroups)[0]))
      setTimeout(() => setAviso(null), 3000)
      const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById('product-actions')?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' })
      return false
    }
    try {
      const cartKey = getCartKey(organizationSubdomain, branchId)
      const cart = reemplazar ? [] : JSON.parse(localStorage.getItem(cartKey) || '[]')
      const activePrice = getActivePrice()
      const activeCp = getActiveComparePrice()

      // Tope: unidades del producto ya en el carrito (todas sus líneas) contra el stock disponible.
      const idProducto = isParent && selectedVariant ? selectedVariant.id : productId
      const yaEnCarrito = reemplazar ? 0 : getProductQtyInCart(organizationSubdomain || window.location.hostname.split('.')[0], branchId, idProducto)
      const cupoAhora = cupoDisponible(stockDisponible, yaEnCarrito)
      if (cupoAhora === 0) {
        setAviso(AVISO_TOPE_CARRITO)
        setTimeout(() => setAviso(null), 3000)
        return false
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
      return true
    } catch (e) {
      return false
    }
  }

  /** «Agregar al carrito»: verde con «Agregado» 2 s (hoy). Devuelve si agregó. */
  const agregar = (): boolean => {
    const ok = escribirLinea(false)
    if (ok) {
      setAdded(true)
      setTimeout(() => setAdded(false), 2000)
    }
    return ok
  }

  /** «Comprar ahora»: el carrito queda solo con esta línea y se va al checkout. */
  const comprarAhora = () => {
    if (escribirLinea(true)) irAlCheckout()
  }

  const activePrice = getActivePrice()
  const activeComparePrice = getActiveComparePrice()
  const hasVariants = isParent && variants.length > 0
  const imagenActiva = (isParent && selectedVariant ? getVariantImg(selectedVariant) : null) || imageUrl || null

  return {
    added,
    aviso,
    outOfStock,
    sinCupo,
    cupo,
    attributeGroups,
    selectedAttributes,
    selectedVariant,
    hasVariants,
    activePrice,
    activeComparePrice,
    imagenActiva,
    cantidad,
    cambiarCantidad,
    handleAttributeSelect,
    agregar,
    comprarAhora,
    comprando,
  }
}

export type CompraBarraFija = ReturnType<typeof useCompraBarraFija>
