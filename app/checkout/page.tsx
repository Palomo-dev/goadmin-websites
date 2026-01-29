'use client'

import { useState, useEffect } from 'react'
import { SiteHeader } from '@/components/site/SiteHeader'
import { SiteFooter } from '@/components/site/SiteFooter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Trash2, Plus, Minus, CreditCard, Truck, Check, ShoppingBag } from 'lucide-react'
import Link from 'next/link'

interface CartItem {
  id: number
  name: string
  price: number
  quantity: number
  image?: string
}

export default function CheckoutPage() {
  const [organization, setOrganization] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  
  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    notes: ''
  })
  
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer'>('card')
  
  useEffect(() => {
    const loadData = async () => {
      try {
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        const res = await fetch(`/api/organization?subdomain=${subdomain}`)
        const data = await res.json()
        if (data.data) {
          setOrganization(data.data)
        }
        
        // Cargar carrito desde localStorage
        const savedCart = localStorage.getItem(`cart_${subdomain}`)
        if (savedCart) {
          setCartItems(JSON.parse(savedCart))
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])
  
  const updateQuantity = (id: number, delta: number) => {
    setCartItems(items => {
      const updated = items.map(item => {
        if (item.id === id) {
          const newQty = Math.max(0, item.quantity + delta)
          return { ...item, quantity: newQty }
        }
        return item
      }).filter(item => item.quantity > 0)
      
      // Guardar en localStorage
      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      localStorage.setItem(`cart_${subdomain}`, JSON.stringify(updated))
      
      return updated
    })
  }
  
  const removeItem = (id: number) => {
    setCartItems(items => {
      const updated = items.filter(item => item.id !== id)
      const host = window.location.hostname
      const subdomain = host.split('.')[0]
      localStorage.setItem(`cart_${subdomain}`, JSON.stringify(updated))
      return updated
    })
  }
  
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  const shipping = subtotal > 100000 ? 0 : 10000
  const total = subtotal + shipping
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: organization.id,
          customer: customerData,
          items: cartItems,
          subtotal,
          shipping,
          total,
          paymentMethod
        })
      })
      
      if (res.ok) {
        setOrderComplete(true)
        // Limpiar carrito
        const host = window.location.hostname
        const subdomain = host.split('.')[0]
        localStorage.removeItem(`cart_${subdomain}`)
        setCartItems([])
      }
    } catch (error) {
      console.error('Error creating order:', error)
    } finally {
      setSubmitting(false)
    }
  }
  
  const primaryColor = organization?.website_settings?.primary_color || organization?.primary_color || '#3B82F6'
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: primaryColor }}></div>
      </div>
    )
  }
  
  if (!organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Organización no encontrada</p>
      </div>
    )
  }
  
  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteHeader organization={organization} primaryColor={primaryColor} />
        
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-lg mx-auto text-center">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Check className="h-10 w-10" style={{ color: primaryColor }} />
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">¡Pedido Realizado!</h1>
            <p className="text-gray-600 mb-8">
              Tu pedido ha sido recibido exitosamente. Te enviaremos un correo de confirmación a {customerData.email} con los detalles de tu compra.
            </p>
            
            <div className="flex gap-4 justify-center">
              <Link href="/">
                <Button variant="outline">Volver al inicio</Button>
              </Link>
              <Link href="/productos">
                <Button style={{ backgroundColor: primaryColor }}>
                  Seguir comprando
                </Button>
              </Link>
            </div>
          </div>
        </main>
        
        <SiteFooter organization={organization} settings={organization.website_settings} primaryColor={primaryColor} />
      </div>
    )
  }
  
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <SiteHeader organization={organization} primaryColor={primaryColor} />
        
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-lg mx-auto text-center">
            <ShoppingBag className="h-20 w-20 mx-auto text-gray-300 mb-6" />
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Tu carrito está vacío</h1>
            <p className="text-gray-600 mb-8">Agrega productos para comenzar tu compra</p>
            <Link href="/productos">
              <Button style={{ backgroundColor: primaryColor }}>
                Ver productos
              </Button>
            </Link>
          </div>
        </main>
        
        <SiteFooter organization={organization} settings={organization.website_settings} primaryColor={primaryColor} />
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader organization={organization} primaryColor={primaryColor} />
      
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Link 
            href="/productos"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Seguir comprando
          </Link>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div 
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'text-white' : 'bg-gray-200 text-gray-500'
                }`}
                style={step >= s ? { backgroundColor: primaryColor } : {}}
              >
                {s}
              </div>
              {s < 3 && (
                <div 
                  className={`w-20 h-1 mx-2 ${step > s ? '' : 'bg-gray-200'}`}
                  style={step > s ? { backgroundColor: primaryColor } : {}}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tu Carrito</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 py-4 border-b last:border-0">
                        <div 
                          className="w-20 h-20 rounded-lg flex items-center justify-center text-3xl"
                          style={{ backgroundColor: `${primaryColor}10` }}
                        >
                          📦
                        </div>
                        
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{item.name}</h3>
                          <p className="text-sm text-gray-500">
                            ${item.price.toLocaleString()} c/u
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-semibold">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <p className="font-bold w-24 text-right" style={{ color: primaryColor }}>
                          ${(item.price * item.quantity).toLocaleString()}
                        </p>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    className="w-full mt-6"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => setStep(2)}
                  >
                    Continuar
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Datos de Envío</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                        <Input
                          required
                          value={customerData.firstName}
                          onChange={(e) => setCustomerData({ ...customerData, firstName: e.target.value })}
                          placeholder="Juan"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                        <Input
                          required
                          value={customerData.lastName}
                          onChange={(e) => setCustomerData({ ...customerData, lastName: e.target.value })}
                          placeholder="Pérez"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input
                        type="email"
                        required
                        value={customerData.email}
                        onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                        placeholder="tu@email.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <Input
                        type="tel"
                        required
                        value={customerData.phone}
                        onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                        placeholder="+57 300 123 4567"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                      <Input
                        required
                        value={customerData.address}
                        onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                        placeholder="Calle 123 #45-67"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                      <Input
                        required
                        value={customerData.city}
                        onChange={(e) => setCustomerData({ ...customerData, city: e.target.value })}
                        placeholder="Medellín"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
                      <Input
                        value={customerData.notes}
                        onChange={(e) => setCustomerData({ ...customerData, notes: e.target.value })}
                        placeholder="Instrucciones especiales de entrega..."
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStep(1)}
                      >
                        Atrás
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        style={{ backgroundColor: primaryColor }}
                        onClick={() => setStep(3)}
                        disabled={!customerData.firstName || !customerData.email || !customerData.phone || !customerData.address}
                      >
                        Continuar
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
            
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>Método de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { id: 'card', icon: <CreditCard className="h-5 w-5" />, label: 'Tarjeta de crédito/débito' },
                      { id: 'transfer', icon: <Truck className="h-5 w-5" />, label: 'Transferencia bancaria' },
                      { id: 'cash', icon: <ShoppingBag className="h-5 w-5" />, label: 'Pago contra entrega' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id as any)}
                        className={`w-full p-4 rounded-lg border-2 flex items-center gap-4 transition-colors ${
                          paymentMethod === method.id 
                            ? 'border-current' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        style={paymentMethod === method.id ? { borderColor: primaryColor, color: primaryColor } : {}}
                      >
                        {method.icon}
                        <span className="font-medium text-gray-900">{method.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(2)}
                    >
                      Atrás
                    </Button>
                    <Button
                      type="button"
                      className="flex-1"
                      style={{ backgroundColor: primaryColor }}
                      onClick={handleSubmit}
                      disabled={submitting}
                    >
                      {submitting ? 'Procesando...' : `Pagar $${total.toLocaleString()}`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Order Summary */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Resumen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600">{item.name} x{item.quantity}</span>
                      <span className="font-medium">${(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  
                  <div className="border-t pt-3 mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Envío</span>
                      <span>{shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString()}`}</span>
                    </div>
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>${total.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {shipping === 0 && (
                    <p className="text-xs text-green-600 text-center mt-2">
                      ¡Envío gratis por compras mayores a $100.000!
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      
      <SiteFooter organization={organization} settings={organization.website_settings} primaryColor={primaryColor} />
    </div>
  )
}
