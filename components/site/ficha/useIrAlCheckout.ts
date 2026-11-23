'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRutaSitio } from '@/lib/outlet/RutaSitioContext'

/**
 * «Comprar ahora» de la ficha: ir al checkout con respuesta visible y respaldo. Lo usan los
 * botones de la ficha (ProductDetailActions) y la barra fija (StickyAddToCart), así las dos
 * navegan igual.
 *
 * - /checkout es dinámico: se trae su límite de carga por adelantado para que responda al instante.
 * - Al volver con «Atrás» la página puede restaurarse tal cual: se suelta el botón.
 * - Si la navegación del cliente no arranca en unos segundos, se hace una navegación completa.
 */
export function useIrAlCheckout(): { comprando: boolean; irAlCheckout: () => void } {
  const router = useRouter()
  const { ruta } = useRutaSitio()
  const [comprando, setComprando] = useState(false)

  useEffect(() => {
    router.prefetch(ruta('/checkout'))
  }, [router])

  useEffect(() => {
    const alVolver = () => setComprando(false)
    window.addEventListener('pageshow', alVolver)
    return () => window.removeEventListener('pageshow', alVolver)
  }, [])

  const irAlCheckout = () => {
    const desde = window.location.pathname
    setComprando(true)
    router.push(ruta('/checkout'))
    window.setTimeout(() => {
      if (window.location.pathname === desde) window.location.assign(ruta('/checkout'))
    }, 6000)
  }

  return { comprando, irAlCheckout }
}
