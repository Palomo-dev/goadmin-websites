'use client'

/**
 * Página intermedia del Botón de pagos de Bold.
 *
 * Antes se cargaba la librería y DESPUÉS se agregaba un `<script data-bold-button>`: la
 * librería solo busca esos botones al cargar, así que el botón nunca aparecía y la página
 * quedaba en «Procesando pago con Bold» (lo vio el dueño el 2026-11-21 con llaves de prueba).
 *
 * Ahora se usa la integración personalizada documentada por Bold
 * (developers.bold.co › Botón de pagos › Integración personalizada): `new BoldCheckout({...})`
 * y `checkout.open()`. Se abre solo una vez al cargar y queda el botón «Pagar con Bold» por si
 * el navegador no lo abrió. La firma de integridad la arma el servidor (`checkout/init`).
 */
import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

const URL_LIBRERIA_BOLD = 'https://checkout.bold.co/library/boldPaymentButton.js'

interface InstanciaBold {
  open: () => void
}
type ConstructorBold = new (config: Record<string, string>) => InstanciaBold

function constructorBold(): ConstructorBold | null {
  const w = window as unknown as { BoldCheckout?: ConstructorBold }
  return typeof w.BoldCheckout === 'function' ? w.BoldCheckout : null
}

/** Carga la librería una sola vez; resuelve cuando `BoldCheckout` existe. */
function cargarLibreriaBold(): Promise<void> {
  if (constructorBold()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${URL_LIBRERIA_BOLD}"]`)
    const listo = () => (constructorBold() ? resolve() : reject(new Error('BoldCheckout no disponible')))
    if (script) {
      script.addEventListener('load', listo, { once: true })
      script.addEventListener('error', () => reject(new Error('No cargó la librería de Bold')), { once: true })
      // Ya había cargado antes de escuchar: comprobar en el siguiente ciclo.
      setTimeout(() => constructorBold() && resolve(), 0)
      return
    }
    script = document.createElement('script')
    script.src = URL_LIBRERIA_BOLD
    script.async = true
    script.onload = listo
    script.onerror = () => {
      script?.remove()
      reject(new Error('No cargó la librería de Bold'))
    }
    document.head.appendChild(script)
  })
}

function BoldButtonContent() {
  const { ruta } = useRutaSitio()
  const searchParams = useSearchParams()
  const checkoutRef = useRef<InstanciaBold | null>(null)
  const abiertoRef = useRef(false)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [intento, setIntento] = useState(0)

  const apiKey = searchParams.get('apiKey') || ''
  const orderId = searchParams.get('orderId') || ''
  const amount = searchParams.get('amount') || ''
  const currency = searchParams.get('currency') || 'COP'
  const description = searchParams.get('description') || ''
  const integritySignature = searchParams.get('integritySignature') || ''
  const redirectionUrl = searchParams.get('redirectionUrl') || ''
  const customerData = searchParams.get('customerData') || ''
  const billingAddress = searchParams.get('billingAddress') || ''

  const abrir = useCallback(() => {
    try {
      checkoutRef.current?.open()
    } catch (err) {
      console.error('[Bold] no se pudo abrir el pago', err)
      setEstado('error')
    }
  }, [])

  useEffect(() => {
    if (!apiKey || !orderId || !amount) return
    let vigente = true
    setEstado('cargando')
    cargarLibreriaBold()
      .then(() => {
        if (!vigente) return
        const Bold = constructorBold()
        if (!Bold) throw new Error('BoldCheckout no disponible')
        const config: Record<string, string> = { orderId, currency, amount, apiKey }
        if (description) config.description = description
        if (integritySignature) config.integritySignature = integritySignature
        if (redirectionUrl) config.redirectionUrl = redirectionUrl
        if (customerData) config.customerData = customerData
        if (billingAddress) config.billingAddress = billingAddress
        checkoutRef.current = new Bold(config)
        setEstado('listo')
        // Se abre solo una vez; si el navegador lo impide, queda el botón.
        if (!abiertoRef.current) {
          abiertoRef.current = true
          abrir()
        }
      })
      .catch((err) => {
        console.error('[Bold]', err)
        if (vigente) setEstado('error')
      })
    return () => {
      vigente = false
    }
  }, [apiKey, orderId, amount, currency, description, integritySignature, redirectionUrl, customerData, billingAddress, intento, abrir])

  if (!apiKey || !orderId || !amount) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-red-600 font-semibold mb-4">Faltan parámetros para iniciar el pago con Bold.</p>
          <a href={ruta('/checkout')} className="text-blue-600 hover:underline">Volver al checkout</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Pago con Bold</h1>
        <p className="text-gray-500 text-sm mb-6">
          Pedido: <strong>{orderId}</strong> — ${Number(amount).toLocaleString('es-CO')} {currency}
        </p>

        {estado === 'cargando' && <p className="text-gray-400 text-sm mb-6" role="status">Abriendo el pago seguro de Bold…</p>}

        {estado === 'listo' && (
          <>
            <p className="text-gray-400 text-xs mb-4">Si la ventana de pago no se abrió, toca el botón.</p>
            <button
              type="button"
              onClick={abrir}
              className="w-full h-12 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              Pagar con Bold
            </button>
          </>
        )}

        {estado === 'error' && (
          <div role="alert" className="mb-2">
            <p className="text-red-600 text-sm mb-4">No pudimos abrir el pago de Bold. Revisa tu conexión e inténtalo de nuevo.</p>
            <button
              type="button"
              onClick={() => setIntento((n) => n + 1)}
              className="w-full h-12 rounded-lg border border-gray-300 bg-white text-gray-900 font-semibold hover:bg-gray-50"
            >
              Reintentar
            </button>
          </div>
        )}

        <a href={ruta('/checkout')} className="inline-block mt-6 text-sm text-gray-400 hover:text-gray-600">
          ← Volver al checkout
        </a>
      </div>
    </div>
  )
}

export default function BoldCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-gray-400">Cargando pago...</div>
        </div>
      }
    >
      <BoldButtonContent />
    </Suspense>
  )
}
