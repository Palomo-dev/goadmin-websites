'use client'

import { useEffect, useState } from 'react'
import {
  contadoresEn,
  estadoContador,
  leerAjustes,
  type ContadorConversion,
  type UbicacionContador,
} from '@/lib/website/conversion'

export function ContadoresDe({
  settings,
  ubicacion,
  primaryColor,
  variante = 'banner',
}: {
  settings: object | null | undefined
  ubicacion: UbicacionContador
  primaryColor: string
  variante?: 'banner' | 'inline'
}) {
  const ajustes = leerAjustes(settings)
  const lista = contadoresEn(ajustes?.conversion, ubicacion)
  if (!lista?.length) return null
  return (
    <>
      {lista.map((contador) => (
        <ContadorPublico
          key={contador.id}
          contador={contador}
          finPromocion={contador.modo.tipo === 'promocion' ? ajustes?.conversionFines?.[contador.modo.promotionId] ?? null : null}
          primaryColor={primaryColor}
          variante={variante}
        />
      ))}
    </>
  )
}

export function ContadorPublico({
  contador,
  finPromocion,
  primaryColor,
  variante,
}: {
  contador: ContadorConversion
  finPromocion: string | null
  primaryColor: string
  variante: 'banner' | 'inline'
}) {
  const [ahora, setAhora] = useState(() => new Date())
  const [finEvergreen, setFinEvergreen] = useState<Date | null>(null)
  useEffect(() => {
    if (contador.modo.tipo !== 'evergreen') return
    const clave = `contador-${contador.id}`
    let inicio = Number(typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(clave) : 0)
    if (!inicio) {
      inicio = Date.now()
      try { sessionStorage.setItem(clave, String(inicio)) } catch { /* sin sesión */ }
    }
    setFinEvergreen(new Date(inicio + contador.modo.minutos * 60_000))
  }, [contador.id, contador.modo])
  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const estado = contador.modo.tipo === 'evergreen'
    ? (finEvergreen && finEvergreen.getTime() > ahora.getTime()
      ? { tipo: 'cuenta' as const, fin: finEvergreen }
      : contador.alTerminar.tipo === 'mensaje'
        ? { tipo: 'mensaje' as const, texto: contador.alTerminar.texto }
        : { tipo: 'oculto' as const })
    : estadoContador(contador, ahora, finPromocion)
  if (estado.tipo === 'oculto') return null
  if (estado.tipo === 'mensaje') {
    return <p className="px-4 py-2 text-center text-sm" style={{ color: contador.estilo.texto || primaryColor }}>{estado.texto}</p>
  }
  const resta = Math.max(0, estado.fin.getTime() - ahora.getTime())
  const totalSeg = Math.floor(resta / 1000)
  const dias = Math.floor(totalSeg / 86400)
  const horas = Math.floor((totalSeg % 86400) / 3600)
  const minutos = Math.floor((totalSeg % 3600) / 60)
  const segundos = totalSeg % 60
  const partes: { n: number; etiqueta: string }[] = []
  if (contador.formato.dias) partes.push({ n: dias, etiqueta: 'días' })
  if (contador.formato.horas) partes.push({ n: horas, etiqueta: 'horas' })
  if (contador.formato.minutos) partes.push({ n: minutos, etiqueta: 'min' })
  if (contador.formato.segundos) partes.push({ n: segundos, etiqueta: 'seg' })
  const fondo = contador.estilo.fondo || primaryColor
  const texto = contador.estilo.texto || '#fff'
  const radio = contador.estilo.forma === 'cuadrado' ? 0 : contador.estilo.forma === 'redondo' ? 999 : (contador.estilo.radio ?? 8)
  const tam = contador.estilo.tamano === 'lg' ? 'text-2xl' : contador.estilo.tamano === 'md' ? 'text-xl' : 'text-base'
  const digitos = partes.map((p, i) => (
    <span key={p.etiqueta} className="inline-flex items-center gap-1">
      {i > 0 && contador.estilo.cajas === 'linea' ? <span>:</span> : null}
      <span
        className={`font-mono font-bold ${tam} ${contador.estilo.cajas === 'digito' ? 'rounded px-1.5 py-0.5' : ''}`}
        style={contador.estilo.cajas === 'digito' ? { background: 'rgba(255,255,255,.2)', borderRadius: radio } : undefined}
      >
        {String(p.n).padStart(2, '0')}
      </span>
      {contador.formato.etiquetas && <span className="text-[10px] uppercase">{p.etiqueta}</span>}
    </span>
  ))
  return (
    <div
      className={variante === 'banner' ? 'w-full px-4 py-2 text-center text-sm' : 'rounded-lg p-3 text-center text-sm'}
      style={{
        background: fondo,
        color: texto,
        borderRadius: variante === 'inline' ? radio : undefined,
        border: contador.estilo.borde ? `1px solid ${contador.estilo.borde}` : undefined,
        boxShadow: contador.estilo.sombra ? '0 8px 24px rgba(0,0,0,.18)' : undefined,
      }}
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        {contador.textoAntes && <span>{contador.textoAntes}</span>}
        {digitos}
        {contador.textoDespues && <span>{contador.textoDespues}</span>}
      </span>
    </div>
  )
}
