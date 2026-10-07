'use client'

/**
 * `table_bill` «Cuenta de la mesa», variante «Hoja» (láminas 08, 09 y 17).
 *
 * - #cuenta (08): rondas con subtotal, total e impuesto al consumo; «¿Cómo la dividen?» (todo
 *   junto, partes iguales con − n +, lo que pidió cada uno); propina sugerida (sin propina,
 *   10 %, 15 %, otro valor); tu parte, propina y total a pagar; «Pagar mi parte en línea» y
 *   «Pagar en la mesa (datáfono o efectivo)».
 * - #pagar (09): total a pagar, «Así va la mesa» (partes pagadas, la tuya, las que faltan),
 *   método de pago, datos para el recibo/factura y «Pagar».
 *
 * Lo que se cobra lo decide la base: `fn_mesa_abono_iniciar` recalcula la parte (todo = saldo,
 * iguales = total / partes, por comensal = lo pendiente de sus líneas, siempre con tope en el
 * saldo); si el navegador vio otro valor responde MONTO_CAMBIO y aquí se muestra el nuevo. El
 * pago va por /api/checkout/init (fuente `table_bill`) a la pasarela de Sitio web › Ventas en
 * línea; el webhook firmado lo abona a la venta de la mesa con el mismo cobro de la caja.
 *
 * Sin pasarela activa (o con `pay_online` apagado) solo se ofrece «Pagar en la mesa», que avisa
 * al mesero (solicitud de cuenta con el detalle: datáfono o efectivo y cuánto).
 */

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, CreditCard, Landmark, Lock, Minus, Plus, Smartphone } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import {
  normalizarCuentaMesa,
  reemplazarMarcadores,
  type CuentaMesa as ConfigCuenta,
} from '@/lib/website/v2/contrato/seccionesMesa'
import {
  montoDeParte,
  nombreComensal,
  progresoPartes,
  propinaPorcentaje,
  type CuentaMesa as DatosCuenta,
  type ModoDivision,
} from '@/lib/restaurant/mesa-modelo'
import {
  atrasMesa,
  irA,
  mostrarAviso,
  pagarEnLinea,
  pedirCuenta,
  refrescarMesa,
  setMesaQR,
  useMesaQRStore,
  type SeleccionPago,
} from '@/lib/restaurant/mesaStore'
import { usePasosMesa } from '@/components/site/PasosMesaContext'
import { AvisosMesa } from './AvisosMesa'
import { BotonPrimario, BotonSecundario, EncabezadoPantalla, PantallaMesa, nombreMesa, useSeccionMesa, type PropsSeccionMesa } from './comun'
import { C, ERROR_TEXTO, OK, TITULO } from './estilo'
import { CUENTA_MUESTRA } from './muestra'

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`

function tasaImpuesto(total: number, impuesto: number): number | null {
  if (!(impuesto > 0) || !(total > impuesto)) return null
  return Math.round((impuesto / (total - impuesto)) * 100)
}

export function CuentaMesa(props: PropsSeccionMesa) {
  const c = normalizarCuentaMesa(props.content)
  const { mesa, preview } = useSeccionMesa(props, 'cuenta')
  const pantalla = useMesaQRStore((e) => e.pantalla)
  const cuentaStore = useMesaQRStore((e) => e.cuenta)
  const cuenta = (cuentaStore ?? (preview ? CUENTA_MUESTRA : null)) as DatosCuenta | null

  useEffect(() => {
    if (!preview && (pantalla === 'cuenta' || pantalla === 'pagar')) void refrescarMesa(true)
  }, [pantalla, preview])

  if (!mesa) return <AvisosMesa />
  if (preview && pantalla === '') {
    return <PantallaCuenta c={c} cuenta={cuenta} mesaNombre={nombreMesa(mesa)} lienzo preview />
  }
  return (
    <>
      {pantalla === 'cuenta' && <PantallaCuenta c={c} cuenta={cuenta} mesaNombre={nombreMesa(mesa)} lienzo={false} preview={preview} />}
      {pantalla === 'pagar' && <PantallaPagar c={c} cuenta={cuenta} mesaNombre={nombreMesa(mesa)} />}
      <AvisosMesa />
    </>
  )
}


function puedePagarEnLinea(c: ConfigCuenta, cuenta: DatosCuenta | null): boolean {
  return c.payOnline && !!cuenta?.cuenta?.pasarela
}

/** Selección por defecto: la de la lámina (partes iguales entre los de la mesa, 10 %). */
function seleccionInicial(c: ConfigCuenta, cuenta: DatosCuenta | null, comensal: string): SeleccionPago {
  const modos = c.allowSplit ? c.splitModes : (['todo'] as ModoDivision[])
  const personas = Math.max(2, cuenta?.sesion?.personas ?? 2)
  const modo: ModoDivision = modos.includes('iguales') ? 'iguales' : modos[0]
  const pct = c.tipOptions.includes(10) ? 10 : c.tipOptions[0] ?? 0
  return { modo, partes: personas, comensal, propinaPct: pct, propinaOtra: 0, monto: 0, propina: 0 }
}

function PantallaCuenta({ c, cuenta, mesaNombre, lienzo, preview }: {
  c: ConfigCuenta
  cuenta: DatosCuenta | null
  mesaNombre: string
  lienzo: boolean
  preview: boolean
}) {
  const comensalPropio = useMesaQRStore((e) => e.comensal)
  // «Valorar la visita» solo si ese paso existe (por pasos); sin pasos, como siempre.
  const porPasos = usePasosMesa()
  const hayValorar = porPasos.activo ? porPasos.pasos.includes('valorar') : true
  const guardada = useMesaQRStore((e) => e.seleccionPago)
  const [sel, setSel] = useState<SeleccionPago>(() => guardada ?? seleccionInicial(c, cuenta, comensalPropio))
  const [avisando, setAvisando] = useState(false)
  const datos = cuenta?.cuenta ?? null
  const modos = c.allowSplit ? c.splitModes : (['todo'] as ModoDivision[])

  const monto = datos ? montoDeParte(datos, sel.modo, sel.partes, sel.modo === 'comensal' ? sel.comensal : null) : 0
  const propina = sel.propinaPct === null ? Math.max(0, Math.min(sel.propinaOtra, monto)) : propinaPorcentaje(monto, sel.propinaPct, datos?.tolerancia ?? 1)
  const totalPagar = monto + propina
  const tasa = tasaImpuesto(datos?.total ?? 0, datos?.impuesto ?? 0)
  const online = puedePagarEnLinea(c, cuenta)
  const pagada = datos !== null && datos.saldo <= 0
  const comensales = useMemo(() => (datos?.porComensal ?? []).filter((p) => p.pendiente > 0 || p.total > 0), [datos])

  const actualizar = (parcial: Partial<SeleccionPago>) => setSel((s) => ({ ...s, ...parcial }))

  const pagarLinea = () => {
    if (preview || !datos) return
    setMesaQR({ seleccionPago: { ...sel, monto, propina } })
    irA('pagar')
  }

  const pagarEnMesa = async () => {
    if (preview || avisando) return
    setAvisando(true)
    const quien = sel.modo === 'comensal' ? nombreComensal(sel.comensal) : comensalPropio
    const detalle = `Pagar en la mesa (datáfono o efectivo) · ${quien}: ${fmt(totalPagar)}${propina > 0 ? ` con propina ${fmt(propina)}` : ''}`
    const ok = await pedirCuenta(detalle)
    setAvisando(false)
    if (ok) mostrarAviso({ tipo: 'mesero', titulo: 'Avisamos al mesero', texto: 'Trae el datáfono o recibe el efectivo en tu mesa.' }, 8000)
  }

  const pie = pagada ? (
    hayValorar ? (
      <BotonPrimario onClick={() => irA('valorar')}>Valorar la visita</BotonPrimario>
    ) : (
      // Por pasos sin «Valorar la visita» en la página: ese paso no existe, se vuelve a la carta.
      <BotonPrimario onClick={() => irA('')}>Volver a la carta</BotonPrimario>
    )
  ) : (
    <div className="flex flex-col gap-3">
      {online && (
        <BotonPrimario onClick={pagarLinea} disabled={!datos || monto <= 0}>
          <CreditCard className="h-5 w-5" aria-hidden="true" />
          Pagar mi parte en línea ·&nbsp;<Price value={totalPagar} />
        </BotonPrimario>
      )}
      {(c.payAtTable || !online) && (
        online
          ? <BotonSecundario onClick={() => void pagarEnMesa()} disabled={avisando}>{c.payAtTableText}</BotonSecundario>
          : <BotonPrimario onClick={() => void pagarEnMesa()} disabled={avisando}>{c.payAtTableText}</BotonPrimario>
      )}
    </div>
  )

  return (
    <PantallaMesa lienzo={lienzo} pie={pie}>
      <EncabezadoPantalla
        titulo={reemplazarMarcadores(c.title, { mesa: mesaNombre })}
        subtitulo={cuenta?.sesion?.estado === 'bill_requested' ? 'Avisamos al mesero que la pediste' : null}
        subtituloOk
      />
      <div className="px-4 pb-6 pt-4">
        <section className="rounded-xl border px-4 py-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
          {(cuenta?.rondas ?? []).map((r) => (
            <div key={r.clave} className="flex items-center justify-between py-1 text-[15px]" style={{ color: C.suave }}>
              <span>Ronda {r.numero} · {r.items.reduce((s, l) => s + l.cantidad, 0)} platos</span>
              <Price value={r.subtotal} />
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between border-t pt-2" style={{ borderColor: C.borde }}>
            <span className="text-lg font-bold">Total de la mesa</span>
            <Price value={datos?.total ?? cuenta?.total ?? 0} className="text-lg font-bold" />
          </div>
          {tasa !== null && datos?.impuestoIncluido && (
            <p className="text-xs" style={{ color: C.suave }}>Incluye impuesto al consumo ({tasa} %): <Price value={datos.impuesto} /></p>
          )}
          {datos && datos.pagado > 0 && (
            <div className="mt-2 flex items-center justify-between text-sm">
              <span style={{ color: C.suave }}>Ya pagado</span>
              <span className="font-semibold">− <Price value={datos.pagado} /></span>
            </div>
          )}
          {datos && datos.pagado > 0 && (
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Falta por pagar</span>
              <Price value={datos.saldo} />
            </div>
          )}
        </section>

        {!datos && (
          <p className="mt-4 rounded-xl border px-4 py-4 text-center" style={{ borderColor: C.borde, color: C.suave }}>
            La cuenta de la mesa aparece cuando el equipo la abra. Puedes llamar al mesero.
          </p>
        )}

        {pagada && (
          <p className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 font-semibold" style={{ backgroundColor: OK.fondo, color: OK.texto }} role="status">
            <BadgeCheck className="h-5 w-5" aria-hidden="true" /> La cuenta de la mesa está pagada. ¡Gracias!
          </p>
        )}

        {datos && !pagada && (
          <>
            {modos.length > 1 && (
              <>
                <h2 className="mb-3 mt-6 text-2xl" style={TITULO}>¿Cómo la dividen?</h2>
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="¿Cómo la dividen?">
                  {modos.map((m) => {
                    const activo = sel.modo === m
                    const titulo = m === 'todo' ? 'Todo junto' : m === 'iguales' ? 'Partes iguales' : 'Por lo que pidió cada uno'
                    const detalle = m === 'todo'
                      ? `Una sola persona paga ${fmt(datos.saldo)}`
                      : m === 'iguales'
                        ? `${sel.partes} personas · ${fmt(montoDeParte(datos, 'iguales', sel.partes, null))} cada una`
                        : comensales.map((p) => `${nombreComensal(p.comensal)} ${fmt(p.pendiente)}`).join(' · ')
                    return (
                      <div
                        key={m}
                        className="flex items-center gap-3 rounded-xl border px-4 py-3"
                        style={activo ? { borderColor: C.primario, borderWidth: 2, backgroundColor: C.primarioSuave } : { borderColor: C.borde, backgroundColor: C.tarjeta }}
                      >
                        <button type="button" role="radio" aria-checked={activo} onClick={() => actualizar({ modo: m })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: activo ? C.primario : C.suave }} aria-hidden="true">
                            {activo && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: C.primario }} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[16px] font-semibold">{titulo}</span>
                            <span className="block truncate text-sm" style={{ color: C.suave }}>{detalle}</span>
                          </span>
                        </button>
                        {m === 'iguales' && activo && (
                          <div className="flex items-center rounded-lg border" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
                            <button type="button" className="flex h-11 w-10 items-center justify-center" aria-label="Una persona menos" onClick={() => actualizar({ partes: Math.max(2, sel.partes - 1) })}>
                              <Minus className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-lg font-bold" aria-live="polite">{sel.partes}</span>
                            <button type="button" className="flex h-11 w-10 items-center justify-center" aria-label="Una persona más" onClick={() => actualizar({ partes: Math.min(30, sel.partes + 1) })}>
                              <Plus className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {sel.modo === 'comensal' && comensales.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="¿Quién paga?">
                    {comensales.map((p) => {
                      const activo = (sel.comensal ?? null) === (p.comensal ?? null)
                      return (
                        <button key={p.comensal ?? 'mesa'} type="button" role="radio" aria-checked={activo}
                          onClick={() => actualizar({ comensal: p.comensal })}
                          className="min-h-[40px] rounded-full border px-4 text-sm font-semibold"
                          style={activo ? { backgroundColor: C.oscuro, color: C.sobreOscuro, borderColor: C.oscuro } : { borderColor: C.borde, backgroundColor: C.tarjeta }}>
                          {nombreComensal(p.comensal)} · {fmt(p.pendiente)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            <h2 className="mb-3 mt-6 text-2xl" style={TITULO}>Propina para el equipo</h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Propina para el equipo">
              {c.tipOptions.map((p) => {
                const activo = sel.propinaPct === p
                return (
                  <button key={p} type="button" role="radio" aria-checked={activo} onClick={() => actualizar({ propinaPct: p })}
                    className="min-h-[44px] rounded-full border px-4 text-[15px]"
                    style={activo ? { backgroundColor: C.oscuro, color: C.sobreOscuro, borderColor: C.oscuro } : { borderColor: C.borde, backgroundColor: C.tarjeta }}>
                    {p === 0 ? 'Sin propina' : `${p} %`}
                  </button>
                )
              })}
              {c.allowCustomTip && (
                <button type="button" role="radio" aria-checked={sel.propinaPct === null} onClick={() => actualizar({ propinaPct: null })}
                  className="min-h-[44px] rounded-full border px-4 text-[15px]"
                  style={sel.propinaPct === null ? { backgroundColor: C.oscuro, color: C.sobreOscuro, borderColor: C.oscuro } : { borderColor: C.borde, backgroundColor: C.tarjeta }}>
                  Otro
                </button>
              )}
            </div>
            {sel.propinaPct === null && (
              <label className="mt-3 block text-sm">
                <span className="mb-1 block" style={{ color: C.suave }}>Valor de la propina</span>
                <input type="number" inputMode="numeric" min={0} value={sel.propinaOtra || ''} onChange={(e) => actualizar({ propinaOtra: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-12 w-full rounded-lg border px-3 text-base" style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }} />
              </label>
            )}
            {c.tipText && <p className="mt-3 text-sm" style={{ color: C.suave }}>{c.tipText}</p>}

            <section className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
              <div className="flex items-center justify-between py-1 text-[15px]">
                <span>{sel.modo === 'iguales' ? `Tu parte (1 de ${sel.partes})` : sel.modo === 'comensal' ? `Lo de ${nombreComensal(sel.comensal)}` : 'La cuenta'}</span>
                <Price value={monto} className="font-semibold" />
              </div>
              <div className="flex items-center justify-between py-1 text-[15px]" style={{ color: C.suave }}>
                <span>{sel.propinaPct === null ? 'Propina' : sel.propinaPct === 0 ? 'Sin propina' : `Propina ${sel.propinaPct} %`}</span>
                <Price value={propina} />
              </div>
              <div className="mt-1 flex items-center justify-between pt-1">
                <span className="text-lg font-bold">Total a pagar</span>
                <Price value={totalPagar} className="text-xl font-bold" />
              </div>
            </section>
          </>
        )}
      </div>
    </PantallaMesa>
  )
}

const METODOS = [
  { id: 'card', titulo: 'Tarjeta débito o crédito', detalle: 'Visa, Mastercard, Amex', Icono: CreditCard },
  { id: 'pse', titulo: 'PSE', detalle: 'Desde tu banco', Icono: Landmark },
  { id: 'nequi', titulo: 'Nequi', detalle: 'Te llega una notificación', Icono: Smartphone },
] as const

function PantallaPagar({ c, cuenta, mesaNombre }: { c: ConfigCuenta; cuenta: DatosCuenta | null; mesaNombre: string }) {
  const sel = useMesaQRStore((e) => e.seleccionPago)
  const [metodo, setMetodo] = useState<string>('card')
  const [factura, setFactura] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [pagando, setPagando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const datos = cuenta?.cuenta ?? null

  useEffect(() => {
    // Recarga en «pagar» sin nada elegido: a la cuenta, sin apilar historial.
    if (!sel) irA('cuenta', { reemplazar: true })
  }, [sel])
  if (!sel || !datos) return null

  const progreso = progresoPartes(datos.abonos, sel.partes)
  const total = sel.monto + sel.propina
  const pagar = async () => {
    if (pagando) return
    setPagando(true)
    setError(null)
    const r = await pagarEnLinea({
      modo: sel.modo,
      partes: sel.partes,
      comensal: sel.modo === 'comensal' ? sel.comensal : null,
      propina: sel.propina,
      monto: sel.monto,
      email: factura && email ? email : null,
      nombre: factura && nombre ? nombre : null,
    })
    if (!r.ok) {
      setPagando(false)
      setError(r.mensaje)
      if (r.monto !== undefined) {
        // MONTO_CAMBIO: la cuenta cambió; se vuelve a la cuenta con el valor nuevo.
        setMesaQR({ seleccionPago: { ...sel, monto: r.monto } })
      }
    }
  }

  const sub = [mesaNombre, sel.modo === 'iguales' ? `parte ${progreso.pagadas + 1} de ${sel.partes}` : null].filter(Boolean).join(' · ')
  const pie = (
    <>
      {error && <p className="mb-2 text-center text-sm font-semibold" style={{ color: ERROR_TEXTO }} role="alert">{error}</p>}
      <BotonPrimario onClick={() => void pagar()} disabled={pagando}>
        <Lock className="h-5 w-5" aria-hidden="true" />
        {pagando ? 'Abriendo la pasarela…' : <>Pagar&nbsp;<Price value={total} /></>}
      </BotonPrimario>
      <p className="mt-2 text-center text-xs" style={{ color: C.suave }}>Pago seguro con la pasarela del restaurante. No guardamos tu tarjeta.</p>
    </>
  )

  return (
    <PantallaMesa lienzo={false} pie={pie}>
      <EncabezadoPantalla titulo="Pagar mi parte" subtitulo={sub} onAtras={() => atrasMesa(() => irA('cuenta'))} />
      <div className="px-4 pb-6 pt-4">
        <section className="rounded-xl border px-4 py-5 text-center" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
          <p className="text-sm" style={{ color: C.suave }}>Total a pagar</p>
          <p className="mt-1 text-5xl" style={TITULO}><Price value={total} /></p>
          <p className="mt-2 text-sm" style={{ color: C.suave }}>Parte {fmt(sel.monto)} + propina {fmt(sel.propina)}</p>
        </section>

        {sel.modo === 'iguales' && (
          <div className="mt-5">
            <p className="font-semibold">Así va la mesa</p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {Array.from({ length: sel.partes }).map((_, i) => (
                <span key={i} className="h-2 flex-1 rounded-full"
                  style={{ backgroundColor: i < progreso.pagadas ? OK.texto : i === progreso.pagadas ? C.primario : C.borde }} />
              ))}
            </div>
            <p className="mt-2 text-sm" style={{ color: C.suave }}>
              {[
                progreso.pagadas > 0 ? `${progreso.pagadas === 1 ? 'una parte ya pagó' : `${progreso.pagadas} partes ya pagaron`}` : null,
                'tú estás pagando',
                `faltan ${Math.max(0, sel.partes - progreso.pagadas - 1)} ${sel.partes - progreso.pagadas - 1 === 1 ? 'parte' : 'partes'}`,
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        )}

        <p className="mb-2 mt-5 font-semibold">Método de pago</p>
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }} role="radiogroup" aria-label="Método de pago">
          {METODOS.map((m, i) => {
            const activo = metodo === m.id
            return (
              <button key={m.id} type="button" role="radio" aria-checked={activo} onClick={() => setMetodo(m.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: C.borde }}>
                <m.Icono className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.titulo}</span>
                  <span className="block text-sm" style={{ color: C.suave }}>{m.detalle}</span>
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2" style={{ borderColor: activo ? C.primario : C.suave }} aria-hidden="true">
                  {activo && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: C.primario }} />}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs" style={{ color: C.suave }}>El método se confirma en la pasarela del restaurante.</p>

        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <span className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors" style={{ backgroundColor: factura ? C.primario : C.borde }}>
            <input type="checkbox" className="peer sr-only" checked={factura} onChange={(e) => setFactura(e.target.checked)} />
            <span className={`absolute h-6 w-6 rounded-full shadow transition-transform ${factura ? 'translate-x-[22px]' : 'translate-x-0.5'}`} style={{ backgroundColor: factura ? C.sobrePrimario : C.fondo }} />
          </span>
          <span className="text-[15px]">Factura electrónica a mi nombre (opcional)</span>
        </label>
        {factura && (
          <div className="mt-3 flex flex-col gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 120))} placeholder="Nombre o razón social" autoComplete="name"
              className="h-12 rounded-lg border px-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }} />
            <input value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))} placeholder="Correo para el recibo" type="email" autoComplete="email" inputMode="email"
              className="h-12 rounded-lg border px-3" style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }} />
            <p className="text-xs" style={{ color: C.suave }}>El equipo emite la factura con estos datos; el recibo del pago llega a tu correo.</p>
          </div>
        )}
      </div>
    </PantallaMesa>
  )
}
