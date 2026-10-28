'use client'

import type { CSSProperties } from 'react'
import { Clock, Flame, Gift, Percent, Sparkles, Tag, Timer, Zap, type LucideIcon } from 'lucide-react'
import {
  ICONOS_CONTADOR,
  resolverEstiloContador,
  unidadesContador,
  type EstiloContador,
} from '@/lib/website/estiloContador'
import { textoSobreAcento } from '@/lib/website/v2/textoSobreAcento'

const LUCIDE: Record<string, LucideIcon> = { Flame, Clock, Timer, Zap, Tag, Gift, Percent, Sparkles }

function Icono({ estilo, px, className = '' }: { estilo: EstiloContador; px: number; className?: string }) {
  const def = ICONOS_CONTADOR.find((i) => i.valor === estilo.icono.tipo)
  if (!def || def.valor === 'ninguno') return null
  if (def.emoji) return <span aria-hidden className={`shrink-0 ${className}`} style={{ fontSize: px }}>{def.emoji}</span>
  const C = def.lucide ? LUCIDE[def.lucide] : null
  return C ? <C aria-hidden className={`shrink-0 ${className}`} style={{ width: px, height: px }} strokeWidth={2.25} /> : null
}

/**
 * Contador con estilo personalizado (`countdown_style`). Solo se usa si hay estilo: sin él,
 * CountdownBanner pinta el de siempre. Barra = siempre una línea (en celular se oculta el ícono
 * final y el texto «después», y el título se recorta); tarjeta = título arriba y dígitos abajo.
 */
export function ContadorConEstilo({
  estilo,
  primaryColor,
  titulo,
  segundos,
  forma,
  className = '',
}: {
  estilo: EstiloContador
  primaryColor: string
  titulo: string
  segundos: number
  forma: 'barra' | 'tarjeta' | 'grande' | 'compacto'
  className?: string
}) {
  const r = resolverEstiloContador(estilo, primaryColor, textoSobreAcento)
  const escala = forma === 'grande' ? 1.6 : 1
  const unidades = unidadesContador(segundos)
  const pos = estilo.icono.posicion
  const caja: CSSProperties = {
    background: r.fondoCaja,
    borderRadius: r.radioCaja,
    color: r.colorDigitos,
    padding: r.conCaja ? `${Math.round(2 * escala)}px ${Math.round(6 * escala)}px` : 0,
    minWidth: estilo.temporizador.caja === 'pildora' && r.conCaja ? `${Math.round(r.px.digitos * 2.2 * escala)}px` : undefined,
    textAlign: 'center',
  }
  const digitos = (
    <div className="flex shrink-0 items-center font-mono font-bold" style={{ gap: Math.round(4 * escala), fontSize: Math.round(r.px.digitos * escala), color: r.colorDigitos }} data-contador-digitos="">
      {unidades.map((u, i) => (
        <span key={u.etiqueta} className="flex items-center" style={{ gap: Math.round(4 * escala) }}>
          {i > 0 && estilo.temporizador.separadores && <span aria-hidden style={{ color: r.colorTexto }}>:</span>}
          <span className="flex flex-col items-center leading-tight">
            <span style={caja}>{u.valor}</span>
            {estilo.temporizador.etiquetas && (
              <span className="font-sans font-medium uppercase opacity-80" style={{ fontSize: Math.round(r.px.etiqueta * escala), color: r.colorTexto }}>{u.etiqueta}</span>
            )}
          </span>
        </span>
      ))}
    </div>
  )
  const base: CSSProperties = { background: r.fondo, color: r.colorTexto, fontWeight: r.peso, fontSize: Math.round(r.px.texto * escala) }
  const antes = estilo.texto.antes
  const despues = estilo.texto.despues

  if (forma === 'compacto') {
    return <div className={`inline-flex items-center gap-2 rounded-md px-2 py-1 ${className}`} style={base} data-contador="compacto"><Icono estilo={estilo} px={r.px.icono} />{digitos}</div>
  }

  if (forma === 'barra') {
    return (
      <div className={`w-full text-center ${className}`} style={{ ...base, padding: `${r.px.relleno}px 12px` }} data-contador="banner" data-contador-estilo="">
        <div className="flex flex-nowrap items-center justify-center" style={{ gap: r.px.separacion }}>
          {pos !== 'fin' && <Icono estilo={estilo} px={r.px.icono} />}
          <span className="min-w-0 truncate">{antes ? `${antes} ` : ''}{titulo}</span>
          {digitos}
          {despues && <span className="hidden shrink-0 sm:inline">{despues}</span>}
          {pos !== 'inicio' && <Icono estilo={estilo} px={r.px.icono} className={pos === 'ambos' ? 'hidden sm:inline-block' : ''} />}
        </div>
      </div>
    )
  }

  // Tarjeta (carrito, pago) y grande (ficha de producto): título arriba, dígitos abajo.
  return (
    <div
      className={`flex flex-col items-center text-center ${forma === 'grande' ? 'w-full rounded-xl py-8 px-4' : 'rounded-lg p-3'} ${className}`}
      style={{ ...base, gap: Math.round(6 * escala) }}
      data-contador={forma === 'grande' ? 'full' : 'inline'}
      data-contador-estilo=""
    >
      <p className="flex items-center justify-center gap-1.5">
        {pos !== 'fin' && <Icono estilo={estilo} px={Math.round(r.px.icono * escala)} />}
        <span>{antes ? `${antes} ` : ''}{titulo}</span>
        {pos !== 'inicio' && <Icono estilo={estilo} px={Math.round(r.px.icono * escala)} />}
      </p>
      {digitos}
      {despues && <p style={{ fontSize: Math.round(r.px.etiqueta * 1.2 * escala) }} className="opacity-90">{despues}</p>}
    </div>
  )
}
