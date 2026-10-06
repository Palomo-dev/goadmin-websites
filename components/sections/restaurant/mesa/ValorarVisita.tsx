'use client'

/**
 * `visit_feedback` «Valorar la visita» (lámina 10).
 *
 * «¡Gracias! Pagaste tu parte» (al volver de la pasarela con ?ref=CQR-…), estrellas 1–5,
 * «¿Qué estuvo mejor?» (aspectos editables), comentario opcional, «Enviar valoración» y «Ahora
 * no». Se guarda con POST /api/mesa/<mesa>/valorar (table_visit_feedback: sesión activa o
 * cerrada hace menos de 2 h). Con «solo después de pagar» encendido, se ofrece tras pagar en
 * línea o con la cuenta de la mesa ya pagada; si no, también desde la cuenta.
 */

import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { Price } from '@/components/site/CurrencyProvider'
import { normalizarValorarVisita } from '@/lib/website/v2/contrato/seccionesMesa'
import { irA, refrescarMesa, setMesaQR, useMesaQRStore, valorarVisita } from '@/lib/restaurant/mesaStore'
import { AvisosMesa } from './AvisosMesa'
import { BotonPrimario, PantallaMesa, useSeccionMesa, type PropsSeccionMesa } from './comun'
import { C, OK, TITULO } from './estilo'

export function ValorarVisita(props: PropsSeccionMesa) {
  const c = normalizarValorarVisita(props.content)
  const { mesa, preview } = useSeccionMesa(props, 'valorar')
  const pantalla = useMesaQRStore((e) => e.pantalla)
  const abono = useMesaQRStore((e) => e.abonoPagado)
  const cuenta = useMesaQRStore((e) => e.cuenta)
  const [puntaje, setPuntaje] = useState(preview ? 4 : 0)
  const [aspectos, setAspectos] = useState<string[]>(preview ? c.aspects.slice(0, 2) : [])
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)

  // Volviendo de la pasarela: se refresca la cuenta hasta ver el abono confirmado por el webhook.
  useEffect(() => {
    if (preview || pantalla !== 'valorar' || !abono) return
    void refrescarMesa(true)
    const t = setInterval(() => void refrescarMesa(true), 4000)
    const fin = setTimeout(() => clearInterval(t), 60_000)
    return () => {
      clearInterval(t)
      clearTimeout(fin)
    }
  }, [pantalla, abono, preview])

  if (!mesa) return <AvisosMesa />
  const lienzo = preview && pantalla === ''
  if (!lienzo && pantalla !== 'valorar') return <AvisosMesa />

  const estadoAbono = abono?.id ? cuenta?.cuenta?.abonos.find((a) => a.id === abono.id)?.estado ?? null : null
  const confirmado = preview || !abono || estadoAbono === 'paid' || estadoAbono === 'paid_unapplied'
  const titulo = abono || preview ? (confirmado ? '¡Gracias! Pagaste tu parte' : 'Estamos confirmando tu pago') : '¡Gracias por venir!'

  const enviar = async () => {
    if (preview || puntaje < 1 || enviando) return
    setEnviando(true)
    const ok = await valorarVisita(puntaje, aspectos, comentario)
    setEnviando(false)
    if (ok) setListo(true)
  }
  const salir = () => {
    setMesaQR({ abonoPagado: null })
    if (typeof window !== 'undefined' && /[?&]ref=/.test(window.location.search)) {
      history.replaceState(null, '', window.location.pathname)
    }
    irA('')
  }

  const pie = listo ? (
    <BotonPrimario onClick={salir}>Volver a la carta</BotonPrimario>
  ) : (
    <div className="flex flex-col items-start gap-3">
      <BotonPrimario onClick={() => void enviar()} disabled={puntaje < 1 || enviando}>
        {enviando ? 'Enviando…' : 'Enviar valoración'}
      </BotonPrimario>
      <button type="button" onClick={salir} className="min-h-[48px] rounded-lg border px-4 text-base font-semibold" style={{ borderColor: C.texto }}>
        Ahora no
      </button>
    </div>
  )

  return (
    <PantallaMesa lienzo={lienzo} pie={pie}>
      <div className="px-6 pb-6 pt-10 text-center">
        <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full" style={{ backgroundColor: OK.fondo }}>
          <Check className="h-9 w-9" style={{ color: OK.texto }} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-[30px] leading-9" style={TITULO}>{titulo}</h1>
        {(abono || preview) && (
          <p className="mt-2 text-[15px]" style={{ color: C.suave }}>
            {confirmado ? (abono?.email || preview ? 'Recibo enviado a tu correo' : 'Pago recibido') : 'Esto toma unos segundos'}
            {(abono?.total ?? (preview ? 64900 : null)) !== null && <> · <Price value={(abono?.total ?? 64900) as number} /></>}
          </p>
        )}

        {listo ? (
          <p className="mx-auto mt-8 max-w-sm rounded-xl px-4 py-4 text-[17px] font-semibold" style={{ backgroundColor: OK.fondo, color: OK.texto }} role="status">
            {c.thanksText}
            {c.reviewsUrl && (
              <a href={c.reviewsUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm underline">Cuéntalo también en reseñas</a>
            )}
          </p>
        ) : (
          <section className="mx-auto mt-6 max-w-sm rounded-xl border px-5 py-5 text-left" style={{ borderColor: C.borde, backgroundColor: C.tarjeta }}>
            <h2 className="text-center text-lg font-bold">{c.question}</h2>
            <div className="mt-3 flex justify-center gap-3" role="radiogroup" aria-label={c.question}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={puntaje === n} aria-label={`${n} de 5`} onClick={() => setPuntaje(n)} className="p-1">
                  <Star className="h-9 w-9" strokeWidth={1.5} style={n <= puntaje ? { color: '#B07A1E', fill: '#B07A1E' } : { color: C.suave }} aria-hidden="true" />
                </button>
              ))}
            </div>
            {c.aspectsTitle && <p className="mt-4 text-center text-sm" style={{ color: C.suave }}>{c.aspectsTitle}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {c.aspects.map((a) => {
                const activo = aspectos.includes(a)
                return (
                  <button key={a} type="button" aria-pressed={activo}
                    onClick={() => setAspectos((l) => (activo ? l.filter((x) => x !== a) : [...l, a]))}
                    className="min-h-[44px] rounded-full border px-4 text-[15px]"
                    style={activo ? { backgroundColor: C.oscuro, color: C.sobreOscuro, borderColor: C.oscuro } : { borderColor: C.borde, backgroundColor: C.tarjeta }}>
                    {a}
                  </button>
                )
              })}
            </div>
            <label className="mt-4 block">
              <span className="sr-only">{c.commentPlaceholder}</span>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value.slice(0, 1000))} rows={2} placeholder={c.commentPlaceholder}
                className="w-full resize-none rounded-lg border px-3 py-2 text-[15px]" style={{ borderColor: C.borde, backgroundColor: C.muySuave, color: C.texto }} />
            </label>
          </section>
        )}
      </div>
      <AvisosMesa />
    </PantallaMesa>
  )
}

