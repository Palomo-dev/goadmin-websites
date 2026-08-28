'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductCard, getProductImageUrl, getProductPrice, getProductComparePrice } from './ProductCard'

interface ProductsListProps {
  content: Record<string, any>
  primaryColor?: string
  data?: Record<string, any>
  organization?: { subdomain?: string; website_settings?: any }
}

export function ProductsList({ content, primaryColor = '#3B82F6', data, organization }: ProductsListProps) {
  const router = useRouter()
  const organizationSubdomain = organization?.subdomain || ''
  const showBuyNow = organization?.website_settings?.show_buy_now_button !== false
  const allProducts = (data?.products || []) as any[]
  const maxItems = content.max_items || 12
  const selectedIds: number[] = content.selected_category_ids || []

  // Filtrar por categorías seleccionadas
  const filtered = selectedIds.length > 0
    ? allProducts.filter((p) => selectedIds.includes(p.category_id))
    : allProducts

  // Ordenar
  const sortOrder = content.sort_order || 'default'
  const sorted = [...filtered]
  if (sortOrder === 'price_asc') sorted.sort((a, b) => (getProductPrice(a) ?? 0) - (getProductPrice(b) ?? 0))
  else if (sortOrder === 'price_desc') sorted.sort((a, b) => (getProductPrice(b) ?? 0) - (getProductPrice(a) ?? 0))
  else if (sortOrder === 'name') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  else if (sortOrder === 'sales') sorted.sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))

  const products = maxItems > 0 ? sorted.slice(0, maxItems) : sorted

  const [addedToCart, setAddedToCart] = useState<Set<number>>(new Set())

  const addToCart = (product: any) => {
    const price = getProductPrice(product)
    if (price === null) return
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const sub = organizationSubdomain || host.split('.')[0]
    const cartKey = `cart_${sub}`
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    const idx = cart.findIndex((item: any) => item.id === product.id)
    if (idx >= 0) {
      cart[idx].quantity += 1
    } else {
      const imgUrl = getProductImageUrl(product)
      const cp = getProductComparePrice(product)
      cart.push({ id: product.id, name: product.name, price, quantity: 1, ...(imgUrl && { imageUrl: imgUrl }), ...(cp && { comparePrice: cp }) })
    }
    localStorage.setItem(cartKey, JSON.stringify(cart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setAddedToCart((prev) => new Set(prev).add(product.id))
    setTimeout(() => {
      setAddedToCart((prev) => { const n = new Set(prev); n.delete(product.id); return n })
    }, 1500)
  }

  const buyNow = (product: any) => {
    addToCart(product)
    router.push('/checkout')
  }

  return (
    <div>
      {content.title && (
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-3 text-gray-900 dark:text-white">{content.title}</h2>
      )}
      {content.subtitle && (
        <p className="text-gray-600 dark:text-gray-300 text-center mb-8">{content.subtitle}</p>
      )}

      {products.length > 0 ? (
        (() => {
          const cols = content.columns || content.desktop_columns || 1
          const rows = content.rows || content.desktop_rows
          const maxItemsByRows = rows ? cols * rows : 0
          const visibleProducts = maxItemsByRows > 0 ? products.slice(0, maxItemsByRows) : products
          const isGrid = cols > 1
          return (
            <div
              className={isGrid ? 'grid gap-4 max-w-6xl mx-auto' : 'space-y-4 max-w-4xl mx-auto'}
              style={isGrid ? { gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0, 1fr))` } : undefined}
            >
              {visibleProducts.map((product: any) => {
                const isAdded = addedToCart.has(product.id)
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    primaryColor={primaryColor}
                    variant="list"
                    cardStyle={content}
                    badges={content.badges}
                    cardButtons={content.card_buttons}
                    buttonsPosition={content.buttons_position}
                    buttonsLayout={content.buttons_layout}
                    buttonsFullWidth={content.buttons_full_width !== false}
                    iconOnly={content.icon_only}
                    showBuyNow={showBuyNow}
                    onAddToCart={addToCart}
                    onBuyNow={buyNow}
                    isAdded={isAdded}
                    organizationSubdomain={organizationSubdomain}
                  />
                )
              })}
            </div>
          )
        })()
      ) : (
        <div className="text-center text-gray-400 py-12 border-2 border-dashed dark:border-gray-700 rounded-lg">
          <p className="text-4xl mb-3">📦</p>
          <p>No hay productos disponibles</p>
        </div>
      )}
    </div>
  )
}
