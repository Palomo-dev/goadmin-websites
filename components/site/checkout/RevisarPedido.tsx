'use client'

/**
 * Paso «Revisar y confirmar» del checkout v2 (Figma «16 Sitio web» › Checkout v2, A3 y C2):
 * - `RevisarPedido`: una fila por bloque (Contacto, Factura electrónica, Entrega, Pago, Productos)
 *   con su «Cambiar» que lleva al paso donde se edita.
 * - `PagoRechazado`: el aviso «<Pasarela> no aprobó el pago. No se te cobró nada.», «Intentar de
 *   nuevo · $ X» sobre el MISMO pedido y «Pagar con otro método» (las pasarelas activas de la
 *   tienda). Cobra por /api/checkout/init: el servidor valida el pedido y cambia su método.
 * - `CuponCheckout`: el código de cupón dentro de Pago, en mayúsculas y sin autocorrección.
 */

import { useState, type ReactNode } from 'react'
import { CreditCard, FileText, Loader2, RefreshCw, ShoppingBag, Truck, User, XCircle } from 'lucide-react'
import Enlace from '@/components/site/Enlace'

export interface FilaRevisar {
  clave: 'contacto' | 'factura' | 'entrega' | 'pago' | 'productos'
  etiqueta: string
  titulo: string
  lineas: string[]
  /** «Cambiar», «Cambiar método», «Editar carrito». */
  accion: { texto: string; onClick?: () => void; href?: string }
  /** Pago no aprobado: la etiqueta en rojo. */
  alerta?: boolean
}

const ICONO: Record<FilaRevisar['clave'], typeof User> = {
  contacto: User,
  factura: FileText,
  entrega: Truck,
  pago: CreditCard,
  productos: ShoppingBag,
}

export function RevisarPedido({ filas, color }: { filas: readonly FilaRevisar[]; color: string }) {
  return (
    <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white px-5 sm:px-6" data-revisar-pedido="">
      {filas.map((f) => {
        const Icono = ICONO[f.clave]
        return (
          <li key={f.clave} className="flex items-start gap-3 py-4">
            <span
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={f.alerta ? { backgroundColor: '#FEF2F2', color: '#DC2626' } : { backgroundColor: `color-mix(in srgb, ${color} 12%, white)`, color }}
            >
              <Icono className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 text-sm">
              <p className={`text-xs font-medium uppercase tracking-wide ${f.alerta ? 'text-red-600' : 'text-gray-500'}`}>{f.etiqueta}</p>
              <p className="font-semibold text-gray-900">{f.titulo}</p>
              {f.lineas.filter(Boolean).map((l, i) => (
                <p key={i} className="text-gray-600">{l}</p>
              ))}
            </div>
            {f.accion.href ? (
              <Enlace href={f.accion.href} className="flex-shrink-0 text-sm font-semibold underline underline-offset-4" style={{ color }}>
                {f.accion.texto}
              </Enlace>
            ) : (
              <button type="button" onClick={f.accion.onClick} className="flex-shrink-0 text-sm font-semibold underline underline-offset-4" style={{ color }}>
                {f.accion.texto}
                <span className="sr-only"> {f.etiqueta.toLowerCase()}</span>
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export interface MetodoReintento {
  code: string
  name: string
  descripcion: string | null
}

export function PagoRechazado({
  numeroPedido,
  pasarela,
  total,
  color,
  metodos,
  metodoActual,
  reintentando,
  error,
  onReintentar,
  hrefPedido,
  children,
}: {
  numeroPedido: string
  /** «Bold», «Wompi»… o null. */
  pasarela: string | null
  /** Total del pedido, formateado. */
  total: string
  color: string
  /** Pasarelas activas de la tienda (el mismo pedido se puede pagar con cualquiera). */
  metodos: readonly MetodoReintento[]
  metodoActual: string
  /** Código de la pasarela con la que se está abriendo el pago, o null. */
  reintentando: string | null
  error: string | null
  onReintentar: (gateway: string) => void
  hrefPedido: string
  /** Entre el aviso y los botones: las filas de Revisar (Figma C2). */
  children?: ReactNode
}) {
  const otros = metodos.filter((m) => m.code !== metodoActual)
  const [verOtros, setVerOtros] = useState(false)
  const [elegido, setElegido] = useState<string | null>(otros[0]?.code ?? null)
  const puedeReintentar = metodos.some((m) => m.code === metodoActual)
  return (
    <div className="space-y-4" data-pago-rechazado="">
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-semibold text-red-700">{pasarela ? `${pasarela} no aprobó el pago.` : 'El pago no fue aprobado.'} No se te cobró nada.</p>
          <p className="mt-0.5 text-gray-700">
            Tu pedido {numeroPedido} sigue guardado con todos tus datos. Puedes intentarlo otra vez o pagar con otro método.
          </p>
        </div>
      </div>

      {children}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {puedeReintentar && (
        <button
          type="button"
          onClick={() => onReintentar(metodoActual)}
          disabled={!!reintentando}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: color }}
        >
          {reintentando === metodoActual ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
          Intentar de nuevo · {total}
        </button>
      )}

      {otros.length > 0 && (
        <div>
          <button
            id="checkout-otro-metodo"
            type="button"
            onClick={() => setVerOtros((v) => !v)}
            aria-expanded={verOtros}
            className="flex h-12 w-full items-center justify-center rounded-xl border border-gray-300 bg-white text-base font-semibold text-gray-900"
          >
            Pagar con otro método
          </button>
          {verOtros && (
            <div className="mt-3 space-y-2" role="radiogroup" aria-label="Otro método de pago">
              {otros.map((m) => {
                const sel = elegido === m.code
                return (
                  <button
                    key={m.code}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setElegido(m.code)}
                    className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left"
                    style={sel ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 6%, white)` } : { borderColor: '#E5E7EB' }}
                  >
                    <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: sel ? color : '#D1D5DB' }}>
                      {sel && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold text-gray-900">{m.name}</span>
                      {m.descripcion ? <span className="block text-xs text-gray-500">{m.descripcion}</span> : null}
                    </span>
                  </button>
                )
              })}
              <button
                type="button"
                disabled={!elegido || !!reintentando}
                onClick={() => elegido && onReintentar(elegido)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: color }}
              >
                {reintentando && reintentando !== metodoActual ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Pagar {total}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-center text-sm text-gray-500">
        <Enlace href={hrefPedido} className="underline underline-offset-4">Ver mi pedido</Enlace>
      </p>
    </div>
  )
}

export function CuponCheckout({
  codigo,
  onCodigo,
  onAplicar,
  cargando,
  error,
  aplicado,
}: {
  codigo: string
  onCodigo: (v: string) => void
  onAplicar: () => void
  cargando: boolean
  error: string | null
  /** Con cupón aplicado no se pinta (se quita desde el resumen). */
  aplicado: boolean
}): ReactNode {
  if (aplicado) return null
  return (
    <div className="mt-6 border-t pt-5" data-cupon-checkout="">
      <p className="mb-3 text-base font-semibold text-gray-900">Cupón de descuento</p>
      <label htmlFor="checkout-cupon" className="mb-1 block text-sm font-medium text-gray-700">Código del cupón</label>
      <div className="flex gap-2">
        <input
          id="checkout-cupon"
          value={codigo}
          onChange={(e) => onCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAplicar()
            }
          }}
          placeholder="Ej.: BIENVENIDA"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'checkout-cupon-error' : undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 font-mono text-[15px] uppercase outline-none focus:ring-2 focus:ring-offset-1"
        />
        <button
          type="button"
          onClick={onAplicar}
          disabled={cargando || !codigo.trim()}
          className="h-11 flex-shrink-0 rounded-lg border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-900 disabled:opacity-50"
        >
          {cargando ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error ? <p id="checkout-cupon-error" className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
