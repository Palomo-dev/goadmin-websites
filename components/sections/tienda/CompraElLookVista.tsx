'use client'

/**
 * Foto con puntos y tarjetas de `shop_the_look · hotspots` (ver `CompraElLook.tsx`).
 *
 * Cada punto es un botón (`aria-expanded`) que abre su etiqueta; se cierra con Esc, con otro
 * punto o tocando fuera. Las tarjetas son el `ProductCard` de siempre, sin `onAddToCart`: usan
 * su carrito interno (lib/cart), igual que cualquier otra tarjeta del sitio.
 */

import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { ProductCard } from '../products/ProductCard'

export interface PuntoVista {
  x: number
  y: number
  nombre: string
  precio: number | null
  href: string
}

interface CompraElLookVistaProps {
  titulo: string
  imagen: string
  puntos: PuntoVista[]
  productos: any[]
  content: Record<string, unknown>
  primaryColor: string
  subdominio: string
  branchId: number | null
}

export function CompraElLookVista({ titulo, imagen, puntos, productos, content, primaryColor, subdominio, branchId }: CompraElLookVistaProps) {
  const [abierto, setAbierto] = useState<number | null>(null)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (abierto === null) return
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(null)
    }
    const alTocar = (e: PointerEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(null)
    }
    document.addEventListener('keydown', alTeclado)
    document.addEventListener('pointerdown', alTocar)
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.removeEventListener('pointerdown', alTocar)
    }
  }, [abierto])

  return (
    <div>
      {titulo && (
        <h2 className="titulo-legado mb-6 text-2xl md:text-3xl" style={{ fontFamily: 'var(--font-heading, inherit)' }}>
          {titulo}
        </h2>
      )}
      <div ref={caja} className="relative overflow-hidden bg-black/5" style={{ borderRadius: 'var(--radio-sitio, 12px)' }}>
        <img src={imagen} alt={titulo || 'Foto del espacio'} loading="lazy" className="block h-auto w-full" />
        {puntos.map((p, i) => {
          const esAbierto = abierto === i
          const aLaIzquierda = p.x > 60
          return (
            <div key={i} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <button
                type="button"
                onClick={() => setAbierto(esAbierto ? null : i)}
                aria-expanded={esAbierto}
                aria-label={`Ver ${p.nombre}`}
                className="flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-900" />
                </span>
              </button>
              {esAbierto && (
                <a
                  href={p.href}
                  className={`absolute top-0 z-10 flex w-max max-w-[16rem] -translate-y-1/2 items-center gap-3 bg-white px-4 py-2.5 text-gray-900 shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    aLaIzquierda ? 'right-6' : 'left-6'
                  }`}
                  style={{ borderRadius: 'min(var(--radio-sitio, 8px), 12px)', outlineColor: primaryColor }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.nombre}</span>
                    {p.precio !== null && <Price value={p.precio} className="block text-xs tabular-nums text-gray-600" />}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              )}
            </div>
          )
        })}
      </div>
      {productos.length > 0 && (
        <div className="mt-4 p-4" style={{ borderRadius: 'var(--radio-sitio, 12px)', backgroundColor: 'color-mix(in srgb, currentColor 5%, transparent)' }}>
          <p className="mb-3 text-sm font-medium">Todo en este espacio</p>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {productos.map((p) => (
              <li key={p.id}>
                <ProductCard
                  product={p}
                  primaryColor={primaryColor}
                  variant="grid"
                  cardStyle={content}
                  organizationSubdomain={subdominio}
                  branchId={branchId}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
