'use client'

/**
 * Indicador de pasos del checkout v2 (Figma «16 Sitio web» › Checkout v2, A1/A2/A3): pasos con
 * nombre; los hechos llevan check y se pueden tocar para volver. En celular: «Paso 1 de 3 · Datos y
 * entrega · Sigue: Pago» con tres barras. El carrito ya no es un paso.
 */

import { Check } from 'lucide-react'
import { PASOS_CHECKOUT, type NumeroPaso } from './reglasCheckout'

export function PasosCheckout({ actual, color, onIr }: { actual: NumeroPaso; color: string; onIr: (paso: NumeroPaso) => void }) {
  const siguiente = PASOS_CHECKOUT.find((p) => p.numero === actual + 1)
  const nombreActual = PASOS_CHECKOUT.find((p) => p.numero === actual)?.nombre ?? ''
  return (
    <nav aria-label="Pasos del pago" className="mb-6" data-pasos-checkout="">
      {/* Celular */}
      <div className="md:hidden">
        <p className="flex items-baseline gap-2 text-sm">
          <span className="text-gray-500">Paso {actual} de {PASOS_CHECKOUT.length}</span>
          <span className="font-semibold text-gray-900">{nombreActual}</span>
          {siguiente && <span className="ml-auto text-xs text-gray-500">Sigue: {siguiente.nombre}</span>}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {PASOS_CHECKOUT.map((p) => (
            <span key={p.numero} className="h-1 rounded-full" style={{ backgroundColor: p.numero <= actual ? color : '#E5E7EB' }} />
          ))}
        </div>
      </div>

      {/* Computador */}
      <ol className="hidden items-center gap-3 md:flex">
        {PASOS_CHECKOUT.map((p, i) => {
          const hecho = p.numero < actual
          const esActual = p.numero === actual
          const circulo = (
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={
                hecho
                  ? { backgroundColor: '#DCFCE7', color: '#15803D' }
                  : esActual
                    ? { backgroundColor: color, color: '#fff' }
                    : { border: '1.5px solid #D1D5DB', color: '#9CA3AF' }
              }
            >
              {hecho ? <Check className="h-4 w-4" aria-hidden="true" /> : p.numero}
            </span>
          )
          return (
            <li key={p.numero} className="flex items-center gap-3">
              {hecho ? (
                <button type="button" onClick={() => onIr(p.numero)} className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {circulo}
                  <span className="underline underline-offset-4">{p.nombre}</span>
                  <span className="sr-only">(hecho, volver a este paso)</span>
                </button>
              ) : (
                <span className={`flex items-center gap-2 text-sm ${esActual ? 'font-semibold text-gray-900' : 'text-gray-400'}`} aria-current={esActual ? 'step' : undefined}>
                  {circulo}
                  {p.nombre}
                </span>
              )}
              {i < PASOS_CHECKOUT.length - 1 && (
                <span aria-hidden="true" className="h-0.5 w-12 rounded-full" style={{ backgroundColor: hecho ? '#16A34A' : '#E5E7EB' }} />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
