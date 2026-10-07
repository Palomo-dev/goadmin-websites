'use client'

/**
 * `table_order` «Pedido de la mesa» (láminas 02 barra, 04, 05, 06, 11, 12, 14 y 15).
 *
 * - Barra fija «② Ver pedido de la mesa · $ total» (celular).
 * - Pantalla #pedido: la ronda por enviar (el carrito de la sede, con el comensal de cada
 *   línea) y las rondas de la mesa con su estado, por ronda o por persona; total de la mesa e
 *   impuesto al consumo; «Enviar ronda N a cocina».
 * - Hoja de confirmación (05) y hoja de error (14: «No se cobró nada»).
 * - Pantalla #estado (06): seguimiento en vivo (Enviada · En preparación · Lista · Servida),
 *   refrescado cada 8 s por el almacén (lib/restaurant/mesaStore.ts).
 * - Panel lateral de la tableta (15): `PanelPedidoMesa`, que pinta la carta «qr» en md+.
 *
 * Campos y defaults: lib/website/v2/contrato/seccionesMesa.ts. El envío va por /api/orders («Comer
 * aquí» con la mesa del QR); lo que llega a cocina lo decide el ERP (sede con «las rondas entran
 * solas» y mesa abierta) o el equipo al confirmarla.
 */

import { useEffect, useMemo, useState } from 'react'
import { BellRing, Check, ChefHat, Clock, CheckCircle2, Info, RefreshCw, Send, XCircle } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import {
  normalizarPedidoMesa,
  reemplazarMarcadores,
  type PedidoMesa as ConfigPedido,
} from '@/lib/website/v2/contrato/seccionesMesa'
import {
  enviarRonda,
  irA,
  quitarDeRonda,
  setMesaQR,
  totalRonda,
  useMesaQRStore,
  type LineaRonda,
} from '@/lib/restaurant/mesaStore'
import {
  ETIQUETA_ESTADO_RONDA,
  impuestoDelPedido,
  lineasPorComensal,
  nombreComensal,
  pasoDeEstado,
  type PedidoMesa as DatosPedido,
  type RondaMesa,
} from '@/lib/restaurant/mesa-modelo'
import { AvisosMesa } from './AvisosMesa'
import {
  BotonPrimario,
  BotonSecundario,
  EncabezadoPantalla,
  HojaInferior,
  PantallaMesa,
  Pildora,
  nombreMesa,
  useSeccionMesa,
  type PropsSeccionMesa,
} from './comun'
import { ALERTA, C, OK, TITULO } from './estilo'
import { PEDIDO_MUESTRA, RONDA_MUESTRA } from './muestra'

function hora(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
}


/** Datos de la pantalla: los del almacén, o la mesa de muestra en el lienzo del editor. */
function useDatosPedido(preview: boolean) {
  const pedido = useMesaQRStore((e) => e.pedido)
  const ronda = useMesaQRStore((e) => e.ronda)
  const real = pedido !== null || !preview
  return {
    pedido: (real ? pedido : PEDIDO_MUESTRA) as DatosPedido | null,
    ronda: real ? ronda : RONDA_MUESTRA,
  }
}

export function PedidoMesa(props: PropsSeccionMesa) {
  const c = normalizarPedidoMesa(props.content)
  const { mesa, preview } = useSeccionMesa(props, 'pedido')
  const pantalla = useMesaQRStore((e) => e.pantalla)
  const { pedido, ronda } = useDatosPedido(preview)
  if (!mesa) return <AvisosMesa />

  // Lienzo del editor: la pantalla del pedido en línea (lámina 17 la muestra como sección).
  if (preview && pantalla === '') {
    return <PantallaPedido c={c} lienzo pedido={pedido} ronda={ronda} mesaNombre={nombreMesa(mesa)} preview />
  }
  return (
    <>
      <BarraVerPedido ronda={ronda} pedido={pedido} />
      {pantalla === 'pedido' && <PantallaPedido c={c} lienzo={false} pedido={pedido} ronda={ronda} mesaNombre={nombreMesa(mesa)} preview={preview} />}
      {pantalla === 'estado' && <PantallaEstado c={c} pedido={pedido} mesaNombre={nombreMesa(mesa)} zona={mesa.zona ?? null} sede={mesa.nombreSede ?? null} />}
      <HojaConfirmar c={c} ronda={ronda} numero={(pedido?.rondas.length ?? 0) + 1} />
      <HojaError c={c} numero={(pedido?.rondas.length ?? 0) + 1} />
      <AvisosMesa />
    </>
  )
}


// ─── Barra «Ver pedido de la mesa» (lámina 02) ───────────────────────────────────────────────

/**
 * Reserva al final de la página el alto real de la barra fija mientras se ve: lo publica en
 * `--barra-pedido-mesa-h` y marca el body (`data-barra-pedido-mesa`); app/globals.css pone ese
 * alto como padding inferior de la raíz del sitio. El alto medido es el del contenedor fijo: el
 * botón más su margen inferior, que ya es `max(1rem, env(safe-area-inset-bottom))`. De md en
 * adelante la barra no se pinta (alto 0) y no se reserva nada; al desaparecer o esconderse
 * (`activa` en false), se quita la reserva.
 */
function useReservaAlFinal(el: HTMLElement | null, activa: boolean) {
  useEffect(() => {
    if (!el || !activa) return
    const raiz = document.documentElement
    const cuerpo = document.body
    const quitar = () => {
      cuerpo.removeAttribute('data-barra-pedido-mesa')
      raiz.style.removeProperty('--barra-pedido-mesa-h')
    }
    const medir = () => {
      const alto = Math.ceil(el.getBoundingClientRect().height)
      if (alto > 0) {
        raiz.style.setProperty('--barra-pedido-mesa-h', `${alto}px`)
        cuerpo.setAttribute('data-barra-pedido-mesa', '')
      } else {
        quitar()
      }
    }
    medir()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      quitar()
    }
  }, [el, activa])
}

function BarraVerPedido({ ronda, pedido }: { ronda: LineaRonda[]; pedido: DatosPedido | null }) {
  const [barra, setBarra] = useState<HTMLDivElement | null>(null)
  // Lámina 01: sin barra mientras los botones de la bienvenida están a la vista (PortadaMesa.tsx).
  const escondida = useMesaQRStore((e) => e.botonesPortadaALaVista)
  useReservaAlFinal(barra, !escondida)
  const unidades = ronda.reduce((s, l) => s + l.cantidad, 0)
  const totalLocal = totalRonda(ronda)
  if (unidades === 0 && (pedido?.rondas.length ?? 0) === 0) return null
  const total = unidades > 0 ? totalLocal : pedido?.total ?? 0
  return (
    // Fija: esconderla no mueve nada. Se desliza hacia abajo y se desvanece (200 ms; sin animación
    // con prefers-reduced-motion); `invisible` al terminar la saca del foco y del lector de pantalla.
    <div
      ref={setBarra}
      data-barra-ver-pedido=""
      data-escondida={escondida ? '' : undefined}
      aria-hidden={escondida || undefined}
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] transition-[transform,opacity,visibility] duration-200 ease-out motion-reduce:transition-none md:hidden ${escondida ? 'invisible translate-y-full opacity-0' : 'visible translate-y-0 opacity-100'}`}
    >
      <button
        type="button"
        onClick={() => irA('pedido')}
        tabIndex={escondida ? -1 : undefined}
        className="pointer-events-auto flex min-h-[56px] w-full max-w-md items-center justify-between gap-3 rounded-xl px-4 text-[17px] font-semibold shadow-lg"
        style={{ backgroundColor: C.primario, color: C.sobrePrimario }}
      >
        <span className="flex items-center gap-3 whitespace-nowrap">
          {unidades > 0 && (
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold" style={{ backgroundColor: C.sobrePrimario, color: C.primario }}>
              {unidades}
            </span>
          )}
          Ver pedido de la mesa
        </span>
        <Price value={total} />
      </button>
    </div>
  )
}

// ─── Pantalla del pedido (04) ────────────────────────────────────────────────────────────────

function LineaPedido({ nombre, cantidad, total, detalle, comensal, accion }: {
  nombre: string
  cantidad: number
  total: number
  detalle?: string | null
  comensal?: string | null
  accion?: { texto: string; onClick: () => void }
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[16px] font-semibold leading-5">
          {cantidad}× <span className="ml-1">{nombre}</span>
        </p>
        {detalle && <p className="mt-0.5 text-sm" style={{ color: C.suave }}>{detalle}</p>}
        {comensal && (
          <span className="mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: C.muySuave }}>
            {comensal}
          </span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Price value={total} className="text-[16px] font-semibold" />
        {accion && (
          <button type="button" onClick={accion.onClick} className="text-sm font-semibold" style={{ color: C.primarioTexto }}>
            {accion.texto}
          </button>
        )}
      </div>
    </div>
  )
}

function TarjetaRonda({ r, c }: { r: RondaMesa; c: ConfigPedido }) {
  const servida = r.estado === 'servida'
  const titulo = r.estado === 'por_confirmar' ? `Ronda ${r.numero} · por confirmar` : `Ronda ${r.numero} · ${hora(r.creada)}`
  return (
    <section className="rounded-xl border px-4 py-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xl" style={TITULO}>{titulo}</h3>
        <Pildora estado={r.estado} />
      </div>
      {servida ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <p className="min-w-0 truncate" style={{ color: C.suave }}>
            {r.items.reduce((s, l) => s + l.cantidad, 0)} platos · {r.items.map((l) => l.nombre).join(', ')}
          </p>
          <Price value={r.subtotal} className="font-semibold" />
        </div>
      ) : (
        <>
          <div className="mt-1">
            {r.items.map((l) => (
              <LineaPedido
                key={l.id}
                nombre={l.nombre}
                cantidad={l.cantidad}
                total={l.total}
                detalle={[...l.modificadores, l.nota].filter(Boolean).join(' · ') || null}
                comensal={l.comensal ?? r.comensal}
              />
            ))}
          </div>
          <p className="text-sm" style={{ color: C.suave }}>
            {r.estado === 'por_confirmar' ? c.pendingText : 'Ya está en cocina. Para cambiarla, llama al mesero.'}
          </p>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span style={{ color: C.suave }}>Subtotal</span>
            <Price value={r.subtotal} className="font-semibold" />
          </div>
        </>
      )}
    </section>
  )
}

function PantallaPedido({ c, lienzo, pedido, ronda, mesaNombre, preview }: {
  c: ConfigPedido
  lienzo: boolean
  pedido: DatosPedido | null
  ronda: LineaRonda[]
  mesaNombre: string
  preview: boolean
}) {
  const [vista, setVista] = useState(c.defaultView)
  const enviando = useMesaQRStore((e) => e.enviando)
  const numero = (pedido?.rondas.length ?? 0) + 1
  const totalLocal = totalRonda(ronda)
  const total = (pedido?.total ?? 0) + totalLocal
  const impuesto = impuestoDelPedido(pedido?.total ?? 0, pedido?.impuesto ?? 0, pedido?.impuestoIncluido === true, totalLocal)
  const rondas = useMemo(() => [...(pedido?.rondas ?? [])].sort((a, b) => b.numero - a.numero), [pedido])
  const personas = pedido?.sesion?.personas
  const sub = [personas ? `${personas} ${personas === 1 ? 'persona' : 'personas'}` : null, pedido?.sesion?.abiertaDesde ? `abierta desde las ${hora(pedido.sesion.abiertaDesde)}` : null]
    .filter(Boolean).join(' · ')

  const enviar = () => {
    if (preview) return
    if (c.confirmBeforeSend) setMesaQR({ confirmarAbierto: true })
    else void enviarRonda()
  }

  const pie = ronda.length > 0 ? (
    <>
      <BotonPrimario onClick={enviar} disabled={enviando}>
        <Send className="h-5 w-5" aria-hidden="true" />
        Enviar ronda {numero} a cocina ·&nbsp;<Price value={totalLocal} />
      </BotonPrimario>
      {c.noChargeText && <p className="mt-2 text-center text-sm" style={{ color: C.suave }}>{c.noChargeText}</p>}
    </>
  ) : (
    <BotonPrimario onClick={() => irA('')}>Seguir pidiendo</BotonPrimario>
  )

  const porPersona = lineasPorComensal([
    ...(pedido?.rondas ?? []),
    ...(ronda.length > 0
      ? [{
          clave: 'local', numero, origen: 'web' as const, creada: null, comensal: null, estado: 'por_enviar' as const, listaAt: null,
          subtotal: totalLocal,
          items: ronda.map((l) => ({ id: String(l.id), nombre: l.nombre, cantidad: l.cantidad, total: l.precio * l.cantidad, modificadores: l.modificadores, nota: l.nota, comensal: l.comensal, estado: 'por_enviar' as const, pagada: false })),
        }]
      : []),
  ])

  return (
    <PantallaMesa lienzo={lienzo} pie={pie}>
      <EncabezadoPantalla titulo={reemplazarMarcadores(c.title, { mesa: mesaNombre })} subtitulo={sub || null} />
      <div className="px-4 pb-6 pt-4">
        <div className="mb-4 grid grid-cols-2 rounded-xl p-1" style={{ backgroundColor: C.muySuave }} role="tablist">
          {(['ronda', 'persona'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={vista === v}
              onClick={() => setVista(v)}
              className="min-h-[40px] rounded-lg text-[15px] font-semibold"
              style={vista === v ? { backgroundColor: C.tarjeta, color: C.texto, boxShadow: '0 1px 2px rgba(0,0,0,.06)' } : { color: C.suave }}
            >
              {v === 'ronda' ? 'Por ronda' : 'Por persona'}
            </button>
          ))}
        </div>

        {vista === 'ronda' ? (
          <div className="flex flex-col gap-3">
            {ronda.length > 0 && (
              <section className="rounded-xl border-2 px-4 py-3" style={{ borderColor: C.primario, backgroundColor: C.tarjeta }}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl" style={TITULO}>Ronda {numero} · por enviar</h2>
                  <Pildora estado="por_enviar" />
                </div>
                <div className="mt-1">
                  {ronda.map((l) => (
                    <LineaPedido
                      key={l.id}
                      nombre={l.nombre}
                      cantidad={l.cantidad}
                      total={l.precio * l.cantidad}
                      detalle={[...l.modificadores, l.nota].filter(Boolean).join(' · ') || null}
                      comensal={l.comensal}
                      accion={preview ? { texto: 'Cambiar', onClick: () => undefined } : {
                        texto: 'Cambiar',
                        onClick: () => {
                          quitarDeRonda(l.id)
                          irA('')
                        },
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex items-center justify-between border-t pt-2 text-sm" style={{ borderColor: C.borde }}>
                  <span style={{ color: C.suave }}>Subtotal</span>
                  <Price value={totalLocal} className="font-semibold" />
                </div>
              </section>
            )}
            {rondas.map((r) => <TarjetaRonda key={r.clave} r={r} c={c} />)}
            {ronda.length === 0 && rondas.length === 0 && (
              <p className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: C.borde, color: C.suave }}>
                Aún no hay nada pedido en esta mesa. Elige en la carta y envía tu primera ronda.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {porPersona.map((p) => (
              <section key={p.comensal} className="rounded-xl border px-4 py-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl" style={TITULO}>{nombreComensal(p.comensal)}</h2>
                  <Price value={p.total} className="font-semibold" />
                </div>
                {p.lineas.map((l) => (
                  <LineaPedido key={l.id} nombre={l.nombre} cantidad={l.cantidad} total={l.total}
                    detalle={[l.estado ? ETIQUETA_ESTADO_RONDA[l.estado] : null, ...l.modificadores].filter(Boolean).join(' · ') || null} />
                ))}
              </section>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-lg font-bold">Total de la mesa</span>
          <Price value={total} className="text-xl font-bold" />
        </div>
        {impuesto && (
          <p className="mt-1 text-sm" style={{ color: C.suave }}>
            {impuesto.soloEnviado ? 'Lo enviado incluye' : 'Incluye'} impuesto al consumo ({impuesto.tasa} %): <Price value={impuesto.valor} />
          </p>
        )}
      </div>
    </PantallaMesa>
  )
}

// ─── Hoja de confirmación (05) ───────────────────────────────────────────────────────────────

function HojaConfirmar({ c, ronda, numero }: { c: ConfigPedido; ronda: LineaRonda[]; numero: number }) {
  const abierta = useMesaQRStore((e) => e.confirmarAbierto)
  const enviando = useMesaQRStore((e) => e.enviando)
  return (
    <HojaInferior abierta={abierta} onCerrar={() => setMesaQR({ confirmarAbierto: false })} etiqueta={reemplazarMarcadores(c.confirmTitle, { n: numero })}>
      <h2 className="text-[28px] leading-8" style={TITULO}>{reemplazarMarcadores(c.confirmTitle, { n: numero })}</h2>
      {c.confirmText && <p className="mt-2 text-base" style={{ color: C.suave }}>{c.confirmText}</p>}
      <ul className="mt-4 rounded-xl border px-4 py-1" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
        {ronda.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
            <span>{l.cantidad}× {l.nombre}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs" style={{ color: C.suave }}>{l.comensal}</span>
              <Price value={l.precio * l.cantidad} className="font-semibold" />
            </span>
          </li>
        ))}
      </ul>
      {c.etaText && (
        <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: C.suave }}>
          <Clock className="h-4 w-4" aria-hidden="true" /> {c.etaText}
        </p>
      )}
      <BotonPrimario className="mt-4" onClick={() => void enviarRonda()} disabled={enviando}>
        <Send className="h-5 w-5" aria-hidden="true" />
        {enviando ? 'Enviando…' : 'Sí, enviar a cocina'}
      </BotonPrimario>
      <BotonSecundario className="mt-3" onClick={() => setMesaQR({ confirmarAbierto: false })}>Revisar el pedido</BotonSecundario>
    </HojaInferior>
  )
}

// ─── Hoja de error (14) ──────────────────────────────────────────────────────────────────────

function HojaError({ c, numero }: { c: ConfigPedido; numero: number }) {
  const abierta = useMesaQRStore((e) => e.errorEnvio)
  const enviando = useMesaQRStore((e) => e.enviando)
  return (
    <HojaInferior abierta={abierta} onCerrar={() => setMesaQR({ errorEnvio: false })} etiqueta={reemplazarMarcadores(c.errorTitle, { n: numero })}>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: C.primarioSuave }}>
          <XCircle className="h-7 w-7" style={{ color: C.primario }} aria-hidden="true" />
        </span>
        <h2 className="mt-3 text-[26px] leading-8" style={TITULO}>{reemplazarMarcadores(c.errorTitle, { n: numero })}</h2>
        <p className="mt-2 text-base" style={{ color: C.suave }}>{c.errorText}</p>
      </div>
      <BotonPrimario className="mt-5" disabled={enviando} onClick={() => { setMesaQR({ errorEnvio: false }); void enviarRonda() }}>
        <RefreshCw className="h-5 w-5" aria-hidden="true" /> Reintentar
      </BotonPrimario>
      <BotonSecundario className="mt-3" onClick={() => setMesaQR({ errorEnvio: false, servicioAbierto: true })}>
        <BellRing className="h-5 w-5" aria-hidden="true" /> Llamar al mesero
      </BotonSecundario>
    </HojaInferior>
  )
}

// ─── Estado en vivo (06) ─────────────────────────────────────────────────────────────────────

const PASOS = ['Enviada', 'En preparación', 'Lista', 'Servida'] as const

function Paso({ i, actual }: { i: number; actual: number }) {
  const hecho = i < actual || (i === actual && actual === 3)
  const ahora = i === actual && actual < 3
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full border-2"
        style={hecho ? { backgroundColor: '#2E6B3A', borderColor: '#2E6B3A', color: '#fff' } : ahora ? { backgroundColor: '#8A5A00', borderColor: '#8A5A00', color: '#fff' } : { borderColor: C.borde }}
        aria-hidden="true"
      >
        {hecho ? <Check className="h-4 w-4" /> : ahora ? <ChefHat className="h-4 w-4" /> : null}
      </span>
      <span className={`text-center text-xs ${ahora ? 'font-semibold' : ''}`} style={{ color: hecho || ahora ? C.texto : C.suave }}>{PASOS[i]}</span>
    </div>
  )
}

function minutosEta(eta: string): number | null {
  const m = /(\d+)/.exec(eta)
  return m ? Number(m[1]) : null
}

function PantallaEstado({ c, pedido, mesaNombre, zona, sede }: { c: ConfigPedido; pedido: DatosPedido | null; mesaNombre: string; zona: string | null; sede: string | null }) {
  const ultima = useMesaQRStore((e) => e.ultimaRonda)
  const vivas = (pedido?.rondas ?? []).filter((r) => r.estado !== 'servida' && r.estado !== 'cancelada').sort((a, b) => b.numero - a.numero)
  const eta = minutosEta(c.etaText)
  useEffect(() => {
    // Al volver a esta pantalla, el aviso de la ronda enviada se queda solo un rato.
    if (!ultima) return
    const t = setTimeout(() => setMesaQR({ ultimaRonda: null }), 120_000)
    return () => clearTimeout(t)
  }, [ultima])
  const pie = (
    <div className="flex flex-col gap-3">
      <BotonPrimario onClick={() => irA('')}>Seguir pidiendo</BotonPrimario>
      <BotonSecundario onClick={() => irA('pedido')}>Ver pedido de la mesa</BotonSecundario>
    </div>
  )
  return (
    <PantallaMesa lienzo={false} pie={pie}>
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: C.borde }}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{[mesaNombre, zona].filter(Boolean).join(' · ')}</p>
          {sede && <p className="truncate text-sm" style={{ color: C.suave }}>{sede}</p>}
        </div>
        <button type="button" onClick={() => setMesaQR({ servicioAbierto: true })} className="flex w-14 flex-col items-center gap-0.5 text-xs">
          <BellRing className="h-6 w-6" aria-hidden="true" /> Mesero
        </button>
      </div>
      <div className="px-4 pb-6 pt-4">
        {ultima && (
          <div className="mb-5 flex items-start gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: OK.fondo, color: OK.texto }} role="status">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[17px] font-semibold">
                Ronda {ultima.numero} {ultima.auto ? 'enviada a cocina' : 'enviada'}
              </p>
              <p className="text-sm">
                {ultima.hora} · {ultima.platos} {ultima.platos === 1 ? 'plato' : 'platos'} · {ultima.auto ? 'la cocina ya la tiene' : 'el equipo la confirma'}
              </p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-[26px]" style={TITULO}>Estado de tu pedido</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: OK.fondo, color: OK.texto }}>
            <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: OK.texto }} aria-hidden="true" /> En vivo
          </span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {vivas.length === 0 && (
            <p className="rounded-xl border px-4 py-5 text-center" style={{ borderColor: C.borde, color: C.suave }}>
              {pedido?.rondas.length ? 'Todo lo de tu mesa ya está servido.' : 'Aún no hay rondas en camino.'}
            </p>
          )}
          {vivas.map((r) => {
            const actual = pasoDeEstado(r.estado)
            return (
              <section key={r.clave} className="rounded-xl border px-4 py-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[16px] font-semibold">
                    Ronda {r.numero} · {r.items.map((l) => (l.cantidad > 1 ? `${l.nombre} ×${l.cantidad}` : l.nombre)).join(', ')}
                  </p>
                  {c.showLiveStatus && r.estado !== 'lista' && eta !== null && actual < 2 && (
                    <span className="shrink-0 text-sm font-semibold" style={{ color: ALERTA.texto }}>≈ {eta} min</span>
                  )}
                </div>
                {r.estado === 'por_confirmar' && <p className="mt-1 text-sm" style={{ color: C.suave }}>{c.pendingText}</p>}
                {c.showLiveStatus && (
                  <div className="mt-3 flex items-start">
                    {PASOS.map((_, i) => <Paso key={i} i={i} actual={actual} />)}
                  </div>
                )}
              </section>
            )
          })}
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm" style={{ color: C.suave }}>
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Te avisamos aquí cuando esté lista. No hace falta recargar.
        </p>
      </div>
    </PantallaMesa>
  )
}

// ─── Panel de la tableta (15) ────────────────────────────────────────────────────────────────

export function PanelPedidoMesa({ preview }: { preview: boolean }) {
  const { pedido, ronda } = useDatosPedido(preview)
  const enviando = useMesaQRStore((e) => e.enviando)
  const numero = (pedido?.rondas.length ?? 0) + 1
  const total = (pedido?.total ?? 0) + totalRonda(ronda)
  const rondas = [...(pedido?.rondas ?? [])].sort((a, b) => b.numero - a.numero)
  return (
    <aside className="flex h-full flex-col border-l px-5 py-5" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }} aria-label="Pedido de la mesa">
      <h2 className="text-[26px]" style={TITULO}>Pedido de la mesa</h2>
      <div className="mt-4 flex-1 overflow-y-auto">
        {ronda.length > 0 && (
          <div className="rounded-lg border px-3 py-2" style={{ borderColor: C.primario }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">Ronda {numero}</span>
              <Pildora estado="por_enviar" />
            </div>
            {ronda.map((l) => (
              <div key={l.id} className="mt-1.5 flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{l.cantidad}× {l.nombre} · {l.comensal}</span>
                <Price value={l.precio * l.cantidad} className="font-semibold" />
              </div>
            ))}
          </div>
        )}
        {rondas.map((r) => (
          <div key={r.clave} className="flex items-center justify-between gap-2 py-3 text-sm">
            <span>Ronda {r.numero} · <Price value={r.subtotal} /></span>
            <Pildora estado={r.estado} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-3">
        <span className="text-lg font-bold">Total de la mesa</span>
        <Price value={total} className="text-lg font-bold" />
      </div>
      {ronda.length > 0 && (
        <BotonPrimario className="mt-3" disabled={enviando} onClick={() => !preview && setMesaQR({ confirmarAbierto: true })}>
          <Send className="h-5 w-5" aria-hidden="true" /> Enviar ronda {numero} a cocina
        </BotonPrimario>
      )}
    </aside>
  )
}
