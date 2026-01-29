'use client'

import { useState } from 'react'
import { SiteHeader } from '../SiteHeader'
import { SiteFooter } from '../SiteFooter'
import { CartDrawer } from '../CartDrawer'
import { HeroBanner, CategoriesGrid, FeaturedProducts, PromoBanners, Newsletter } from '../sections/retail'
import { ContactSection } from '../sections/ContactSection'
import type { OrganizationWithDetails } from '@/types/database'
import type { TemplateConfig } from '@/lib/templates'

interface Product {
  id: number
  name: string
  description?: string
  category_id?: number
  product_prices?: { price: number; compare_price?: number }[]
}

interface Category {
  id: number
  name: string
  slug: string
  description?: string
}

interface RetailTemplateProps {
  organization: OrganizationWithDetails
  template: TemplateConfig
  primaryColor: string
  products: Product[]
  categories: Category[]
}

export function RetailTemplate({ 
  organization, 
  template, 
  primaryColor, 
  products,
  categories 
}: RetailTemplateProps) {
  const [cartOpen, setCartOpen] = useState(false)
  const settings = organization.website_settings as any
  const subdomain = organization.subdomain || ''
  
  const addToCart = (product: Product) => {
    const price = product.product_prices?.[0]?.price || 0
    const cartKey = `cart_${subdomain}`
    const existingCart = JSON.parse(localStorage.getItem(cartKey) || '[]')
    
    const existingIndex = existingCart.findIndex((item: any) => item.id === product.id)
    
    if (existingIndex >= 0) {
      existingCart[existingIndex].quantity += 1
    } else {
      existingCart.push({
        id: product.id,
        name: product.name,
        price: Number(price),
        quantity: 1
      })
    }
    
    localStorage.setItem(cartKey, JSON.stringify(existingCart))
    window.dispatchEvent(new CustomEvent('cart-updated'))
    setCartOpen(true)
  }
  
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader 
        organization={organization} 
        primaryColor={primaryColor} 
        template={template}
        onCartClick={() => setCartOpen(true)}
        showCart={true}
      />
      
      <main>
        {/* Hero Banner */}
        <HeroBanner 
          organizationName={organization.name}
          tagline={settings?.hero_subtitle || undefined}
          primaryColor={primaryColor}
          backgroundImage={settings?.hero_image || undefined}
        />
        
        {/* Promo Banners & Features */}
        <PromoBanners primaryColor={primaryColor} />
        
        {/* Categories Grid */}
        <CategoriesGrid 
          categories={categories}
          primaryColor={primaryColor}
        />
        
        {/* Featured Products */}
        <FeaturedProducts 
          products={products}
          primaryColor={primaryColor}
          onAddToCart={addToCart}
        />
        
        {/* Newsletter */}
        <Newsletter 
          primaryColor={primaryColor}
          organizationName={organization.name}
        />
        
        {/* Contact */}
        <ContactSection 
          organization={organization}
          primaryColor={primaryColor}
          settings={settings}
        />
      </main>
      
      <SiteFooter 
        organization={organization} 
        settings={settings} 
        primaryColor={primaryColor}
        template={template}
      />
      
      {/* Cart Drawer */}
      <CartDrawer 
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        primaryColor={primaryColor}
        organizationSubdomain={subdomain}
      />
    </div>
  )
}
