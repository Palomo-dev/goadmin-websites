/**
 * Piezas de los pedidos en Mi cuenta (Figma «16 Sitio web» D 2976:72025, E 2976:72285 y
 * H 2977:72694). Sin estado: las pinta el servidor. Las acciones salen de `accionesPedido`
 * (lib/cuenta/reglasCuenta.ts) y el detalle es la página del pedido rediseñada.
 */
import Link from 'next/link'
import { FileText, Lock, Package, ShoppingBag, Star, Truck } from 'lucide-react'
import type { Paso, TonoInsignia } from '@/lib/orders/consultaPedido'
import type { PedidoCuenta } from '@/lib/cuenta/cuentaCliente'
import { avancePedido, textoProductos } from '@/lib/cuenta/reglasCuenta'
import { etiquetaTipoEntrega } from '@/lib/orders/estados-pedido'
import { momentoPedido } from '@/lib/restaurant/ventanaPedido'

export const pesos = (n: number | null | undefined) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

const TONO: Record<TonoInsignia, string> = {
  advertencia: 'border-amber-300 bg-amber-50 text-amber-800',
  peligro: 'border-red-300 bg-red-50 text-red-700',
  exito: 'border-green-300 bg-green-50 text-green-700',
  informacion: 'border-sky-300 bg-sky-50 text-sky-700',
  neutro: 'border-slate-300 bg-slate-100 text-slate-700',
}

export function Insignia({ texto, tono }: { texto: string; tono: TonoInsignia }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-xs font-semibold leading-4 ${TONO[tono]}`}>{texto}</span>
}

/** Insignia y avance de un pedido de la cuenta (misma regla que la página del pedido). */
export function avanceDe(p: PedidoCuenta, esRestaurante: boolean) {
  return avancePedido({
    status: p.status,
    paymentStatus: p.paymentStatus,
    esPasarela: p.esPasarela,
    deliveryType: p.deliveryType,
    esRestaurante,
    nombre: p.nombre,
    notasInternas: p.notasInternas,
  })
}

/** Hasta 3 fotos y «+N» (Figma: cuadros de 44 px). */
export function FotosPedido({ p, max = 3 }: { p: PedidoCuenta; max?: number }) {
  const vistas = p.productos.slice(0, max)
  const resto = p.productos.length - vistas.length
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {vistas.map((x, i) => (
        <span key={i} className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
          {x.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={x.foto} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <Package aria-hidden="true" className="h-[18px] w-[18px] text-slate-400" />
          )}
        </span>
      ))}
      {resto > 0 && <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-600">+{resto}</span>}
      {vistas.length === 0 && (
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100">
          <Package aria-hidden="true" className="h-[18px] w-[18px] text-slate-400" />
        </span>
      )}
    </div>
  )
}

/** Barra de 4 pasos de la página del pedido (hecho, actual al 45 %, pendiente gris). */
export function BarraPasos({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="flex gap-1.5" aria-label="Avance del pedido">
      {pasos.map((s, i) => (
        <li key={i} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={s.estado === 'actual' ? 'step' : undefined}>
          <span
            className={`h-1 rounded-sm ${s.estado === 'pendiente' ? 'bg-slate-200' : s.estado === 'error' ? 'bg-red-400' : ''}`}
            style={s.estado === 'hecho' ? { backgroundColor: 'var(--primary-color)' } : s.estado === 'actual' ? { backgroundColor: 'var(--primary-color)', opacity: 0.45 } : undefined}
          />
          <span className={`truncate text-xs ${s.estado === 'pendiente' ? 'font-medium text-slate-400' : s.estado === 'actual' ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}`}>{s.etiqueta}</span>
        </li>
      ))}
    </ol>
  )
}

const BOTON_PRINCIPAL = 'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90'
const BOTON_SECUNDARIO = 'inline-flex items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50'

/** Botones según el estado (`p.acciones`). */
export function AccionesPedido({ p }: { p: PedidoCuenta }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {p.acciones.map((a) => {
        switch (a) {
          case 'seguir':
            return (
              <Link key={a} href={p.rutaDetalle} className={BOTON_PRINCIPAL} style={{ backgroundColor: 'var(--primary-color)' }}>
                <Truck aria-hidden="true" className="h-4 w-4" /> Seguir pedido
              </Link>
            )
          case 'pagar':
            // El pago se hace en la página del pedido (los mismos medios de la tienda).
            return (
              <Link key={a} href={p.rutaDetalle} className={BOTON_PRINCIPAL} style={{ backgroundColor: 'var(--primary-color)' }}>
                <Lock aria-hidden="true" className="h-4 w-4" /> Pagar {pesos(p.total)}
              </Link>
            )
          case 'ver':
            return (
              <Link key={a} href={p.rutaDetalle} className={BOTON_SECUNDARIO}>
                Ver pedido
              </Link>
            )
          case 'recomprar':
            return p.rutaRecompra ? (
              <a key={a} href={p.rutaRecompra} className={BOTON_SECUNDARIO}>
                <ShoppingBag aria-hidden="true" className="h-4 w-4" /> Volver a comprar
              </a>
            ) : null
          case 'factura':
            return p.facturaId ? (
              <Link key={a} href={`/mi-cuenta/facturas/${p.facturaId}`} className={BOTON_SECUNDARIO}>
                <FileText aria-hidden="true" className="h-4 w-4" /> Factura
              </Link>
            ) : null
          case 'calificar':
            // La calificación por producto vive en la página del pedido entregado.
            return (
              <Link key={a} href={p.rutaDetalle} className={BOTON_SECUNDARIO}>
                <Star aria-hidden="true" className="h-4 w-4" /> Calificar
              </Link>
            )
        }
      })}
    </div>
  )
}

/** Tarjeta de Mis pedidos (E). */
export function TarjetaPedido({ p, esRestaurante, zona, detalle }: { p: PedidoCuenta; esRestaurante: boolean; zona: string | null; detalle: string | null }) {
  const av = avanceDe(p, esRestaurante)
  const entrega = p.deliveryType ? etiquetaTipoEntrega(p.deliveryType, esRestaurante, p.notasInternas).replace(/^[^\p{L}]+/u, '').toLowerCase() : null
  return (
    <article className="flex flex-col gap-3.5 rounded-[14px] border border-slate-200 bg-white p-4 md:p-5" data-pedido-cuenta={p.grupo}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Pedido {p.numero}</h3>
          <p className="text-[13px] text-slate-600">
            {[momentoPedido(p.createdAt, zona), textoProductos(p.cantidadProductos), entrega].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{pesos(p.total)}</span>
          <Insignia texto={av.insignia} tono={av.tono} />
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <FotosPedido p={p} />
          {detalle && <p className="min-w-0 text-sm text-slate-900">{detalle}</p>}
        </div>
        <AccionesPedido p={p} />
      </div>
    </article>
  )
}

/** Fila de «Pedidos recientes» (D). */
export function FilaPedidoReciente({ p, esRestaurante, zona }: { p: PedidoCuenta; esRestaurante: boolean; zona: string | null }) {
  const av = avanceDe(p, esRestaurante)
  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] border border-slate-200 p-3">
      <FotosPedido p={p} max={1} />
      <Link href={p.rutaDetalle} className="min-w-0 flex-1 leading-snug">
        <span className="block truncate text-sm font-medium text-slate-900">{p.numero}</span>
        <span className="block text-[13px] text-slate-600">{momentoPedido(p.createdAt, zona).split(' · ')[0]} · {textoProductos(p.cantidadProductos)}</span>
      </Link>
      <span className="text-sm font-semibold text-slate-900">{pesos(p.total)}</span>
      <Insignia texto={av.insignia} tono={av.tono} />
      {p.rutaRecompra ? (
        <a href={p.rutaRecompra} className={BOTON_SECUNDARIO}>
          <ShoppingBag aria-hidden="true" className="h-4 w-4" /> Volver a comprar
        </a>
      ) : (
        <Link href={p.rutaDetalle} className={BOTON_SECUNDARIO}>
          Ver pedido
        </Link>
      )}
    </div>
  )
}
