'use client'

/**
 * Página intermedia del Botón de pagos de Bold: RESPALDO. El checkout abre Bold directo al
 * tocar «Pagar» (`abrirBoldDesdeUrl`); aquí solo se llega si eso no pudo (o con un enlace
 * guardado). Abre Bold sola una vez y deja el botón «Pagar con Bold» por si el navegador no
 * lo abrió. Antes se agregaba un `<script data-bold-button>` después de cargar la librería y
 * el botón nunca aparecía (2026-11-21).
 */
import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'
import { BotonVolver } from '@/components/site/volver/BotonVolver'
import { cargarLibreriaBold, configBoldDesdeParametros, crearCheckoutBold, type InstanciaBold } from '@/lib/payments/boldCheckoutCliente'

function BoldButtonContent() {
  const { ruta } = useRutaSitio()
  const searchParams = useSearchParams()
  const checkoutRef = useRef<InstanciaBold | null>(null)
  const abiertoRef = useRef(false)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')
  const [intento, setIntento] = useState(0)

  const parametros = searchParams.toString()
  const config = configBoldDesdeParametros(new URLSearchParams(parametros))

  const abrir = useCallback(() => {
    try {
      checkoutRef.current?.open()
    } catch (err) {
      console.error('[Bold] no se pudo abrir el pago', err)
      setEstado('error')
    }
  }, [])

  useEffect(() => {
    const cfg = configBoldDesdeParametros(new URLSearchParams(parametros))
    if (!cfg) return
    let vigente = true
    setEstado('cargando')
    cargarLibreriaBold()
      .then(() => {
        if (!vigente) return
        checkoutRef.current = crearCheckoutBold(cfg)
        setEstado('listo')
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
  }, [parametros, intento, abrir])

  if (!config) {
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
          Pedido: <strong>{config.orderId}</strong> — ${Number(config.amount).toLocaleString('es-CO')} {config.currency}
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

        {/* «Volver» (Figma 2992:74856): el botón ← de la tienda con el destino real. */}
        <BotonVolver conTexto className="mt-6" padre={{ href: ruta('/checkout'), etiqueta: 'Finalizar compra' }} />
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
