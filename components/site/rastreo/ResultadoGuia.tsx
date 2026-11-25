'use client'

/**
 * Resultado de «Número de guía» (Figma «16 Sitio web» › Consulta por número de guía: G2 3240:98084
 * en camino con el domiciliario, G3 3240:98145 transportadora, M2 3240:98335 y M3 3240:98462
 * entregado; aprobado 2026-11-25).
 *
 * Solo pinta `VistaGuia` (lib/orders/consultaGuia.ts), que ya viene recortada en el servidor a lo
 * que puede ver quien tiene la guía en la mano: estado, pasos e historial con horas, destino solo
 * ciudad y departamento, nombre de pila del domiciliario o la transportadora, paquetes y «Pagas al
 * recibir» sin monto. La dirección, quién recibió y lo demás están en el enlace del correo: de ahí
 * la tarjeta «¿Es tu pedido?».
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Banknote, Check, CheckCircle2, Clock, Copy, ExternalLink, Lock, MapPin, MessageSquare, Package, Phone,
  Search, Store, Truck,
} from 'lucide-react'
import type { VistaGuia } from '@/lib/orders/consultaGuia'

const CHIP: Record<VistaGuia['estado'], string> = {
  preparando: 'border-amber-200 bg-amber-50 text-amber-800',
  en_camino: 'border-blue-200 bg-blue-50 text-blue-700',
  novedad: 'border-red-200 bg-red-50 text-red-700',
  entregado: 'border-green-200 bg-green-50 text-green-700',
  devuelto: 'border-slate-200 bg-slate-100 text-slate-700',
  cancelado: 'border-slate-200 bg-slate-100 text-slate-700',
}

const AVISO: Record<NonNullable<VistaGuia['aviso']>['tono'], { caja: string; titulo: string; icono: typeof Truck }> = {
  info: { caja: 'border-blue-200 bg-blue-50 text-slate-700', titulo: 'text-blue-700', icono: Truck },
  exito: { caja: 'border-green-200 bg-green-50 text-slate-700', titulo: 'text-green-700', icono: CheckCircle2 },
  alerta: { caja: 'border-red-200 bg-red-50 text-slate-700', titulo: 'text-red-700', icono: Clock },
  neutro: { caja: 'border-slate-200 bg-slate-100 text-slate-700', titulo: 'text-slate-900', icono: Package },
}

const TARJETA = 'rounded-2xl border border-slate-200 bg-white p-5 md:p-6'

function BotonCopiar({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(valor).then(
          () => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          },
          () => undefined,
        )
      }}
      aria-label={`Copiar ${etiqueta}`}
      className="inline-flex items-center gap-1 text-[13px] font-medium hover:underline"
      style={{ color: 'var(--primary-color)' }}
    >
      {copiado ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
      <span aria-live="polite">{copiado ? 'Copiado' : 'Copiar'}</span>
    </button>
  )
}

function Pasos({ pasos }: { pasos: VistaGuia['pasos'] }) {
  if (pasos.length === 0) return null
  return (
    <ol aria-label="Avance del envío" className="grid grid-cols-4">
      {pasos.map((p, i) => {
        const siguiente = pasos[i + 1]
        return (
          <li key={p.titulo} className="flex min-w-0 flex-col gap-1 pr-1.5">
            <div className="flex items-center">
              {p.estado === 'hecho' ? (
                <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : p.estado === 'actual' ? (
                <span aria-hidden="true" className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: 'var(--primary-color)' }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--primary-color)' }} />
                </span>
              ) : (
                <span aria-hidden="true" className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-slate-300 bg-white" />
              )}
              {siguiente && (
                <span
                  aria-hidden="true"
                  className="h-0.5 flex-1"
                  style={{ backgroundColor: siguiente.estado === 'pendiente' ? '#e2e8f0' : 'var(--primary-color)' }}
                />
              )}
            </div>
            <span className={`text-[13px] font-semibold ${p.estado === 'pendiente' ? 'text-slate-400' : 'text-slate-900'}`}>
              {p.titulo}
              <span className="sr-only">{p.estado === 'hecho' ? ' (listo)' : p.estado === 'actual' ? ' (paso actual)' : ' (pendiente)'}</span>
            </span>
            {p.detalle && <span className={`text-xs ${p.estado === 'pendiente' ? 'text-slate-400' : 'text-slate-500'}`}>{p.detalle}</span>}
          </li>
        )
      })}
    </ol>
  )
}

function FilaEnvio({ icono, titulo, detalle }: { icono: ReactNode; titulo: string; detalle?: string | null }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--primary-color)' }}>{icono}</span>
      <span className="min-w-0">
        <span className="block text-[15px] text-slate-900">{titulo}</span>
        {detalle && <span className="block text-xs text-slate-500">{detalle}</span>}
      </span>
    </li>
  )
}

function TarjetaEnvio({ vista, className }: { vista: VistaGuia; className: string }) {
  const { quien } = vista
  return (
    <section aria-label="Envío" className={`${TARJETA} ${className}`} data-tarjeta-guia="envio">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Envío</h2>
      <ul className="flex flex-col gap-4">
        {quien.tipo === 'domiciliario' ? (
          <li className="flex items-start gap-3">
            <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
              {quien.nombre.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] text-slate-900">
                {vista.estado === 'entregado' ? `Lo entregó ${quien.nombre}` : `${quien.nombre} te lo lleva`}
              </span>
              <span className="block text-xs text-slate-500">Domiciliario de la tienda</span>
            </span>
          </li>
        ) : quien.tipo === 'transportadora' ? (
          <FilaEnvio
            icono={<Truck className="h-4 w-4" />}
            titulo={`Lo lleva ${quien.nombre}`}
            detalle={quien.guia ? `Transportadora · guía ${quien.guia}` : 'Transportadora'}
          />
        ) : (
          <FilaEnvio icono={<Store className="h-4 w-4" />} titulo="Domicilio de la tienda" detalle="Te contamos aquí quién lo lleva cuando salga" />
        )}
        {vista.estimado && <FilaEnvio icono={<Clock className="h-4 w-4" />} titulo={vista.estimado.titulo} detalle={vista.estimado.detalle} />}
        {vista.destino && <FilaEnvio icono={<MapPin className="h-4 w-4" />} titulo={`Destino: ${vista.destino}`} detalle="La dirección completa no se muestra aquí" />}
        {vista.paquetes && <FilaEnvio icono={<Package className="h-4 w-4" />} titulo={vista.paquetes} />}
        {vista.pago === 'al_recibir' && (
          <FilaEnvio icono={<Banknote className="h-4 w-4" />} titulo="Pagas al recibir" detalle="El monto está en tu correo y en el pedido completo" />
        )}
        {vista.pago === 'pagado' && (
          <FilaEnvio icono={<CheckCircle2 className="h-4 w-4" />} titulo="Pagado" detalle="No tienes que pagar al recibir" />
        )}
      </ul>
      {quien.tipo === 'transportadora' && quien.enlace && (
        <a
          href={quien.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex h-11 items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white text-[15px] font-semibold text-slate-900 hover:bg-slate-50"
        >
          <ExternalLink aria-hidden="true" className="h-4 w-4" />
          Ver en {quien.nombre}
        </a>
      )}
    </section>
  )
}

export function ResultadoGuia({
  vista,
  whatsapp,
  telefonoTienda,
  onBuscarOtra,
  onVerPedido,
}: {
  vista: VistaGuia
  /** wa.me con la guía ya escrita, o null si la tienda no tiene WhatsApp. */
  whatsapp: string | null
  telefonoTienda: string | null
  onBuscarOtra: () => void
  /** Pasa a «Número de pedido» (con el número ya escrito si se conoce). */
  onVerPedido: (numero: string | null) => void
}) {
  const refTitulo = useRef<HTMLHeadingElement>(null)
  // Al llegar con el resultado (la búsqueda recarga la página), el foco va al título.
  useEffect(() => {
    refTitulo.current?.focus()
  }, [])

  const aviso = vista.aviso ? AVISO[vista.aviso.tono] : null
  const IconoAviso = aviso?.icono ?? Truck
  const { quien } = vista

  const buscarOtra = (clase: string) => (
    <button type="button" onClick={onBuscarOtra} className={`items-center gap-1.5 self-start text-sm font-semibold hover:underline ${clase}`} style={{ color: 'var(--primary-color)' }}>
      <Search aria-hidden="true" className="h-4 w-4" />
      Buscar otra guía
    </button>
  )

  return (
    <div className="flex flex-col gap-5 text-slate-900" data-resultado-guia={vista.estado}>
      {buscarOtra('flex lg:hidden')}
      <header className="flex flex-col gap-1">
        <h1 ref={refTitulo} tabIndex={-1} className="text-2xl font-semibold leading-snug outline-none lg:text-3xl">Seguimiento del envío</h1>
        <p className="text-[15px] text-slate-600">{vista.subtitulo}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Estado, guía, pasos y aviso. */}
          <section aria-labelledby="guia-estado" className={TARJETA} data-tarjeta-guia="estado">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHIP[vista.estado]}`}>{vista.chip}</span>
              {vista.ultimoMovimiento && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                  {vista.ultimoMovimiento}
                </span>
              )}
            </div>
            <h2 id="guia-estado" className="mt-3 text-xl font-semibold leading-snug md:text-2xl">{vista.titulo}</h2>

            <div className="mt-3 flex flex-col gap-2 text-sm">
              {quien.tipo === 'transportadora' && quien.guia && (
                <>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-slate-500">Guía de {quien.nombre}</span>
                    <span className="font-semibold tracking-wide">{quien.guia}</span>
                    <BotonCopiar valor={quien.guia} etiqueta={`la guía de ${quien.nombre}`} />
                  </p>
                  {quien.enlace && (
                    <a href={quien.enlace} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 self-start font-medium hover:underline" style={{ color: 'var(--primary-color)' }}>
                      Ver en {quien.nombre}
                      <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  )}
                </>
              )}
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-slate-500">{quien.tipo === 'transportadora' && quien.guia ? 'Guía de la tienda' : 'Guía'}</span>
                <span className="break-all font-semibold tracking-wide">{vista.numeroGuia}</span>
                <BotonCopiar valor={vista.numeroGuia} etiqueta="la guía" />
              </p>
              {vista.resumen && <p className="text-slate-600">{vista.resumen}</p>}
            </div>

            {vista.pasos.length > 0 && <div className="mt-5"><Pasos pasos={vista.pasos} /></div>}

            {vista.aviso && aviso && (
              <div className={`mt-5 flex gap-3 rounded-xl border px-4 py-3 text-sm ${aviso.caja}`} data-aviso-guia={vista.aviso.tono}>
                <IconoAviso aria-hidden="true" className={`mt-0.5 h-4 w-4 flex-shrink-0 ${aviso.titulo}`} />
                <div className="flex flex-col gap-0.5">
                  <p className={`font-semibold ${aviso.titulo}`}>{vista.aviso.titulo}</p>
                  <p>{vista.aviso.detalle}</p>
                </div>
              </div>
            )}
          </section>

          {/* En el celular, «Envío» va después del estado (M2); en el computador, a la derecha (G2). */}
          <TarjetaEnvio vista={vista} className="lg:hidden" />

          <section aria-labelledby="guia-historial" className={TARJETA} data-tarjeta-guia="historial">
            <h2 id="guia-historial" className="mb-4 text-lg font-semibold">Historial</h2>
            <ol className="flex flex-col">
              {vista.historial.map((h, i) => {
                const ultimo = i === vista.historial.length - 1
                const reciente = i === 0
                const verde = reciente && vista.estado === 'entregado'
                return (
                  <li key={`${h.texto}-${h.detalle}`} className="flex gap-3">
                    <div aria-hidden="true" className="flex flex-col items-center">
                      <span
                        className="mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2"
                        style={{
                          borderColor: verde ? '#16a34a' : 'var(--primary-color)',
                          backgroundColor: reciente ? (verde ? '#16a34a' : 'var(--primary-color)') : '#fff',
                        }}
                      />
                      {!ultimo && <span className="w-px flex-1 bg-slate-200" />}
                    </div>
                    <div className={ultimo ? '' : 'pb-4'}>
                      <p className={`text-[15px] ${reciente ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{h.texto}</p>
                      {h.detalle && <p className="text-xs text-slate-500">{h.detalle}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <TarjetaEnvio vista={vista} className="hidden lg:block" />

          <section aria-labelledby="guia-es-tu-pedido" className="rounded-2xl border border-slate-200 bg-slate-50 p-5" data-tarjeta-guia="es-tu-pedido">
            <h2 id="guia-es-tu-pedido" className="flex items-center gap-2 text-base font-semibold">
              <Lock aria-hidden="true" className="h-4 w-4" />
              ¿Es tu pedido?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Abre el enlace del correo de confirmación para ver la dirección, el teléfono del domiciliario y quién lo recibió. Con solo la guía no los mostramos: va pegada por fuera de la caja.
            </p>
            <button
              type="button"
              onClick={() => onVerPedido(vista.numeroPedido)}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white text-[15px] font-semibold text-slate-900 hover:bg-slate-50"
            >
              <Search aria-hidden="true" className="h-4 w-4" />
              Ver mi pedido completo
            </button>
            <p className="mt-3 text-xs text-slate-500">Te pediremos el número del pedido y el correo o teléfono de la compra.</p>
          </section>

          {(whatsapp || telefonoTienda) && (
            <section aria-labelledby="guia-dudas" className={TARJETA} data-tarjeta-guia="dudas">
              <h2 id="guia-dudas" className="text-base font-semibold">¿Dudas con tu envío?</h2>
              {whatsapp && (
                <>
                  <p className="mt-2 text-sm text-slate-600">Te respondemos por WhatsApp con el número de la guía ya escrito.</p>
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[10px] border border-slate-300 bg-white text-[15px] font-semibold text-green-700 hover:bg-slate-50"
                  >
                    <MessageSquare aria-hidden="true" className="h-4 w-4" />
                    Contactar por WhatsApp
                  </a>
                </>
              )}
              {telefonoTienda && (
                <a href={`tel:${telefonoTienda.replace(/[^\d+]/g, '')}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline" style={{ color: 'var(--primary-color)' }}>
                  <Phone aria-hidden="true" className="h-4 w-4" />
                  Llamar a la tienda: {telefonoTienda}
                </a>
              )}
            </section>
          )}

          {buscarOtra('hidden lg:flex')}
        </div>
      </div>
    </div>
  )
}
