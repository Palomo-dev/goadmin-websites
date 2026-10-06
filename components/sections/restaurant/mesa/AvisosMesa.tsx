'use client'

/**
 * Avisos flotantes de la Carta QR (láminas 07b «Avisamos al mesero», 12 «El ceviche se agotó»)
 * y la hoja «¿Qué necesitas?» (lámina 07). Cada sección de mesa monta <AvisosMesa />, pero solo
 * la primera que se monta los pinta: así una página con varias secciones no los duplica y una
 * página con solo algunas de ellas los sigue teniendo.
 */

import { useEffect, useId, useState } from 'react'
import { AlertCircle, Bell, CheckCircle2, CupSoda, ChefHat, HelpCircle, UtensilsCrossed } from 'lucide-react'
import type { ServicioMesa } from '@/lib/website/v2/contrato/seccionesMesa'
import { DEFAULT_SERVICIO_MESA } from '@/lib/website/v2/contrato/seccionesMesa'
import { cancelarLlamado, irA, llamarMesero, setMesaQR, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import { BotonPrimario, HojaInferior } from './comun'
import { C, TITULO } from './estilo'

let duenio: string | null = null
const candidatos: string[] = []

/** El texto y los motivos de la hoja salen de la sección «Servicio de mesa» si la hay. */
let configServicio: ServicioMesa = DEFAULT_SERVICIO_MESA
export function fijarConfigServicio(c: ServicioMesa) {
  configServicio = c
}

const ICONOS = {
  bell: Bell,
  chef: ChefHat,
  cup: CupSoda,
  utensils: UtensilsCrossed,
  help: HelpCircle,
} as const

export function AvisosMesa() {
  const id = useId()
  const [soyDuenio, setSoyDuenio] = useState(false)
  useEffect(() => {
    candidatos.push(id)
    if (duenio === null) duenio = id
    setSoyDuenio(duenio === id)
    return () => {
      const i = candidatos.indexOf(id)
      if (i >= 0) candidatos.splice(i, 1)
      if (duenio === id) duenio = candidatos[0] ?? null
    }
  }, [id])
  if (!soyDuenio) return null
  return (
    <>
      <Aviso />
      <HojaServicio />
    </>
  )
}

function Aviso() {
  const aviso = useMesaQRStore((e) => e.aviso)
  if (!aviso) return null
  const Icono = aviso.tipo === 'error' || aviso.tipo === 'agotado' ? AlertCircle : CheckCircle2
  const color = aviso.tipo === 'error' || aviso.tipo === 'agotado' ? '#F2B8A8' : '#9BD3A3'
  const arriba = aviso.tipo === 'mesero'
  return (
    <div
      className={`fixed inset-x-0 z-[80] flex justify-center px-4 ${arriba ? 'top-[calc(var(--header-h,64px)+12px)]' : 'bottom-[calc(96px+env(safe-area-inset-bottom))]'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 shadow-lg" style={{ backgroundColor: '#211c18', color: '#F7F2EA' }}>
        <Icono className="mt-0.5 h-5 w-5 shrink-0" style={{ color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{aviso.titulo}</p>
          {aviso.texto && <p className="text-sm opacity-80">{aviso.texto}</p>}
          {aviso.accion && (
            <button
              type="button"
              className="mt-1 text-sm font-semibold"
              style={{ color: '#E9B98F' }}
              onClick={() => {
                setMesaQR({ aviso: null })
                if (aviso.accion?.ir !== undefined) irA(aviso.accion.ir)
                else document.getElementById('carta-qr-inicio')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              {aviso.accion.texto}
            </button>
          )}
        </div>
        {aviso.solicitudId && (
          <button type="button" className="shrink-0 text-sm font-semibold" style={{ color: '#E9B98F' }} onClick={() => void cancelarLlamado(aviso.solicitudId!)}>
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}

function HojaServicio() {
  const abierta = useMesaQRStore((e) => e.servicioAbierto)
  const [motivo, setMotivo] = useState<string | null>(null)
  const [detalle, setDetalle] = useState('')
  const [enviando, setEnviando] = useState(false)
  const c = configServicio
  const elegido = motivo ?? c.reasons[0]?.id ?? null
  const cerrar = () => setMesaQR({ servicioAbierto: false })

  const enviar = async () => {
    if (enviando) return
    setEnviando(true)
    const m = c.reasons.find((r) => r.id === elegido)
    const ok = await llamarMesero(m?.label ?? 'Que venga el mesero', detalle, c.sentText)
    setEnviando(false)
    if (ok) {
      setDetalle('')
      setMotivo(null)
    } else {
      // El aviso de error ya lo mostró el almacén; la hoja queda abierta para reintentar.
    }
  }

  return (
    <HojaInferior abierta={abierta} onCerrar={cerrar} etiqueta={c.title}>
      <h2 className="mb-4 text-[28px] leading-8" style={TITULO}>{c.title}</h2>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={c.title}>
        {c.reasons.map((r) => {
          const Icono = ICONOS[r.icon as keyof typeof ICONOS] ?? HelpCircle
          const activo = r.id === elegido
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => setMotivo(r.id)}
              className="flex min-h-[80px] flex-col items-start justify-between gap-2 rounded-xl border px-4 py-3 text-left text-[15px] font-semibold"
              style={activo
                ? { borderColor: C.primario, borderWidth: 2, backgroundColor: C.primarioSuave, color: C.texto }
                : { borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }}
            >
              <Icono className="h-5 w-5" style={{ color: activo ? C.primario : C.texto }} aria-hidden="true" />
              {r.label}
            </button>
          )
        })}
      </div>
      <label className="mt-3 block">
        <span className="sr-only">{c.otherPlaceholder}</span>
        <input
          value={detalle}
          onChange={(e) => setDetalle(e.target.value.slice(0, 200))}
          placeholder={c.otherPlaceholder}
          className="min-h-[52px] w-full rounded-lg border px-4 text-base"
          style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }}
        />
      </label>
      <BotonPrimario className="mt-4" onClick={() => void enviar()} disabled={enviando}>
        <Bell className="h-5 w-5" aria-hidden="true" />
        {enviando ? 'Avisando…' : c.buttonText}
      </BotonPrimario>
    </HojaInferior>
  )
}
