'use client'

/**
 * Un solo resumen del pedido (Figma «16 Sitio web» › Checkout v2, A1–A3, B; resumen versión 1
 * 3061:82007). Antes había dos: la lista del paso «Carrito» y la tarjeta «Resumen». Ahora:
 * «Tu pedido · N productos · Editar carrito», cada producto con foto y cantidad, sus variantes,
 * modificadores, promoción y aviso de pocas unidades; subtotal, impuesto, envío con su detalle,
 * propina, cupón, «Descuentos por promoción», total, contraentrega, sellos y medios de pago reales.
 *
 * Solo pinta lo que el checkout ya calculó (mismos montos que antes; el cobro es de /api/orders).
 *
 * Minimalista (el dueño, 2026-11-25, al verlo en el celular): foto con la insignia de cantidad,
 * nombre y precio, SIN − / + ni papelera. La cantidad se cambia en «Editar carrito» (/carrito) y en
 * el carrito lateral, con la regla compartida lib/carrito/cantidadLinea.ts.
 */

import type { ReactNode } from 'react'
import { Package, Tag, X } from 'lucide-react'
import Enlace from '@/components/site/Enlace'

export interface LineaResumen {
  id: number | string
  nombre: string
  cantidad: number
  imagen: string | null
  /** «Talla: M · Color: Rojo», modificadores… (ya en texto). */
  detalles: string[]
  /** Precio de la línea sin promoción. */
  bruto: number
  /** Descuento de promoción de la línea (0 si no hay). */
  descuento: number
  /** Promoción de la línea y pista de volumen (PromoDeLinea), ya pintadas. */
  promo?: ReactNode
  /** «Quedan 2» (aviso de pocas unidades) o null. */
  avisoStock?: string | null
}

export function ResumenPedido({
  lineas,
  fmt,
  color,
  hrefCarrito,
  chipEntrega,
  subtotal,
  etiquetaSubtotal,
  impuesto,
  envio,
  propina,
  cupon,
  descuentosPromocion,
  total,
  bajoTotal,
  ahorro,
  mensajeEnvioGratis,
  pie,
  accion,
}: {
  lineas: readonly LineaResumen[]
  fmt: (n: number) => string
  color: string
  hrefCarrito: string
  /** Chip del tipo de entrega (ChipEntregaResumen). */
  chipEntrega?: ReactNode
  subtotal: number
  etiquetaSubtotal: string
  impuesto: { etiqueta: string; valor: number; incluido: { nombre: string; valor: number } | null }
  /** null = no se pinta la fila de envío (recoger, comer aquí o envío apagado). */
  envio: { titulo: string; valor: number | null; detalle?: string | null; descripcion?: string | null; calculando?: boolean } | null
  propina: number
  cupon: { codigo: string; descuento: number; onQuitar: () => void } | null
  /** «Descuentos por promoción» (DescuentosPorPromocion), ya pintado. */
  descuentosPromocion?: ReactNode
  total: number
  /** Debajo del total: «Pagas hoy / al recibir» de la contraentrega. */
  bajoTotal?: ReactNode
  ahorro: number
  mensajeEnvioGratis?: string | null
  /** Sellos de confianza y medios de pago. */
  pie?: ReactNode
  /** Botón del pago del checkout de 1 paso en computador (debajo del resumen). */
  accion?: ReactNode
}) {
  const unidades = lineas.reduce((n, l) => n + l.cantidad, 0)
  return (
    <div className="lg:sticky lg:top-4">
      <section id="resumen-pedido" className="scroll-mt-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6" aria-labelledby="resumen-pedido-titulo" data-resumen-pedido="">
        <div className="mb-4 flex items-baseline gap-2">
          <h2 id="resumen-pedido-titulo" className="text-lg font-semibold text-gray-900">Tu pedido</h2>
          <span className="text-sm text-gray-500">{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
          <Enlace href={hrefCarrito} className="ml-auto text-sm font-semibold" style={{ color }}>
            Editar carrito
          </Enlace>
        </div>

        {chipEntrega}

        <ul className="space-y-3">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-start gap-3">
              <span className="relative flex-shrink-0">
                <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: `${color}10` }}>
                  {l.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.imagen} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-6 w-6 text-gray-300" aria-hidden="true" />
                  )}
                </span>
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-700 px-1 text-[11px] font-semibold text-white" aria-hidden="true">
                  {l.cantidad}
                </span>
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-medium text-gray-900 line-clamp-2">
                  {l.nombre}
                  <span className="sr-only">, cantidad {l.cantidad}</span>
                </span>
                {l.detalles.map((d, i) => (
                  <span key={i} className="block truncate text-xs text-gray-500">{d}</span>
                ))}
                {l.promo}
                {l.avisoStock ? <span className="block text-xs font-medium text-orange-600">{l.avisoStock}</span> : null}
              </span>
              {l.descuento > 0 ? (
                <span className="flex-shrink-0 text-right text-sm">
                  <span className="block text-xs text-gray-400 line-through">{fmt(l.bruto)}</span>
                  <span className="font-medium text-green-600">{fmt(l.bruto - l.descuento)}</span>
                </span>
              ) : (
                <span className="flex-shrink-0 text-sm font-medium text-gray-900">{fmt(l.bruto)}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-1.5 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{etiquetaSubtotal}</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {impuesto.valor > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">{impuesto.etiqueta}</span>
              <span>{fmt(impuesto.valor)}</span>
            </div>
          )}
          {impuesto.incluido && impuesto.incluido.valor > 0 && (
            <p className="text-xs text-gray-400">{impuesto.incluido.nombre} incluido en el precio: {fmt(impuesto.incluido.valor)}</p>
          )}
          {envio && (
            <div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">{envio.titulo}</span>
                <span>{envio.calculando ? 'Calculando…' : envio.valor === null ? '—' : envio.valor === 0 ? 'Gratis' : fmt(envio.valor)}</span>
              </div>
              {envio.detalle ? <p className="text-xs text-gray-500">{envio.detalle}</p> : null}
              {envio.descripcion ? <p className="text-xs text-gray-400">{envio.descripcion}</p> : null}
            </div>
          )}
          {propina > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Propina</span>
              <span>{fmt(propina)}</span>
            </div>
          )}
          {cupon && cupon.descuento > 0 && (
            <div className="flex justify-between text-green-600">
              <span className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                {cupon.codigo}
                <button type="button" onClick={cupon.onQuitar} className="ml-1 text-red-400 hover:text-red-600" aria-label={`Quitar el cupón ${cupon.codigo}`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
              <span>-{fmt(cupon.descuento)}</span>
            </div>
          )}
          {descuentosPromocion}
        </div>

        <div className="mt-4 border-t pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-gray-900">Total</span>
            <span className="text-2xl font-bold" style={{ color }}>{fmt(total)}</span>
          </div>
          {bajoTotal}
          {ahorro > 0 && (
            <p className="mt-1 text-right text-xs text-green-600">
              Estás ahorrando <strong>{fmt(ahorro)}</strong>
            </p>
          )}
        </div>

        {mensajeEnvioGratis ? <p className="mt-2 text-center text-xs text-green-600">{mensajeEnvioGratis}</p> : null}

        {pie}
      </section>
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  )
}
