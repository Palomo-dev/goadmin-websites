'use client'

/**
 * `restaurant_hero` · variante «mesa» — Bienvenida de la mesa (lámina 01).
 *
 * «Bienvenidos a la / Mesa 7», zona y sede, «Cocina abierta · hasta las 22:30» (horario de la
 * sede, en su zona horaria), el texto de apoyo, «Ver la carta», «Llamar al mesero», «Pedir la
 * cuenta» y el aviso de alergias. Campos y defaults: lib/website/v2/contrato/seccionesMesa.ts.
 *
 * Sin el QR de una mesa (alguien abre /carta-qr a mano), la portada no inventa una mesa: muestra
 * el título del sitio y «Escanea el código QR de tu mesa…». Con mesa pero sin sesión abierta por
 * el equipo, «Llamar al mesero» y «Pedir la cuenta» explican que la mesa aún no está abierta.
 *
 * Selector de idioma: el sitio aún solo publica español (misma regla que el encabezado), así que
 * `show_language` no pinta nada hasta que haya otro idioma.
 */

import { useEffect, useLayoutEffect, useState } from 'react'
import Image from 'next/image'
import { BellRing, CheckCircle2, ChevronRight, Clock, Info, MapPin, ReceiptText } from 'lucide-react'
import { normalizarPortadaMesa, reemplazarMarcadores } from '@/lib/website/v2/contrato/seccionesMesa'
import { isOptimizableImage } from '@/lib/restaurant/secciones'
import { horarioRevisado } from '@/lib/restaurant/horario'
import type { SedesRestaurante } from '@/lib/restaurant/sedes-modelo'
import { irA, mostrarAviso, pedirCuenta, setMesaQR, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import { useEstadosEnVivo, type SedeConHorario } from '../EstadoApertura'
import { usePasosMesa } from '@/components/site/PasosMesaContext'
import { BotonPrimario, nombreMesa, useSeccionMesa, type PropsSeccionMesa } from './comun'
import { ALERTA, C, OK, TITULO } from './estilo'

// Antes del primer pintado en el navegador (sin aviso de useLayoutEffect en el servidor).
const useEfectoAntesDePintar = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Publica si los botones de la bienvenida están a la vista (`botonesPortadaALaVista`): mientras se
 * ven, la barra «Ver pedido de la mesa» se esconde (lámina 01). La primera lectura es síncrona,
 * antes de pintar, para que la barra no aparezca un instante al abrir; luego, IntersectionObserver.
 */
function useBotonesALaVista(el: HTMLElement | null, activo: boolean) {
  useEfectoAntesDePintar(() => {
    if (!el || !activo) return
    const r = el.getBoundingClientRect()
    setMesaQR({ botonesPortadaALaVista: r.bottom > 0 && r.top < window.innerHeight })
    if (typeof IntersectionObserver === 'undefined') return () => setMesaQR({ botonesPortadaALaVista: false })
    const io = new IntersectionObserver((entradas) => {
      const e = entradas[entradas.length - 1]
      if (e) setMesaQR({ botonesPortadaALaVista: e.isIntersecting })
    })
    io.observe(el)
    return () => {
      io.disconnect()
      setMesaQR({ botonesPortadaALaVista: false })
    }
  }, [el, activo])
}

function sedeDeLaMesa(datos: unknown, sedeId: number | null, branchId: number | null): (SedeConHorario & { nombre: string; direccion: string | null }) | null {
  const d = datos as SedesRestaurante | null
  if (!d || !Array.isArray(d.sedes)) return null
  const s = d.sedes.find((x) => x.id === (sedeId ?? branchId)) ?? d.sedes.find((x) => x.esPrincipal) ?? d.sedes[0]
  return s ? { id: s.id, horario: horarioRevisado(s.horario), zonaHoraria: s.zonaHoraria, nombre: s.nombre, direccion: s.direccion } : null
}

/** «Cocina abierta · hasta las 22:30» a partir del badge de horario («Abierto · Cierra a las 22:30»). */
function textoCocina(texto: string, estado: 'open' | 'closing_soon' | 'closed'): string {
  if (estado === 'closed') return 'Cocina cerrada' + (/(abre .*)$/i.exec(texto)?.[1] ? ` · ${/(abre .*)$/i.exec(texto)![1]}` : '')
  const hora = /(\d{1,2}:\d{2})/.exec(texto)?.[1]
  return hora ? `Cocina abierta · hasta las ${hora}` : 'Cocina abierta'
}

export function PortadaMesa(props: PropsSeccionMesa) {
  const c = normalizarPortadaMesa(props.content)
  const { mesa, preview } = useSeccionMesa(props)
  const pedido = useMesaQRStore((e) => e.pedido)
  const branchId = typeof props.data?.branchId === 'number' ? (props.data.branchId as number) : null
  const sede = sedeDeLaMesa(props.data?.sedesRestaurante, mesa?.sede ?? null, branchId)
  const estados = useEstadosEnVivo(sede ? [sede] : [])
  const apertura = sede ? estados?.get(sede.id)?.apertura ?? null : null
  const sinSesion = !preview && mesa !== null && pedido !== null && pedido.sesion === null
  const [botones, setBotones] = useState<HTMLDivElement | null>(null)
  // Carta QR por pasos: la bienvenida es su propio paso y la barra «Ver pedido» no se pinta en
  // ella; los botones solo existen si existe su paso (o la hoja del mesero).
  const porPasos = usePasosMesa()
  useBotonesALaVista(botones, !preview && mesa !== null && !porPasos.activo)
  const verCarta = porPasos.activo ? porPasos.pasos.includes('carta') : true
  const verMesero = c.showWaiterButton && (porPasos.activo ? porPasos.mesero : true)
  const verCuenta = c.showBillButton && (porPasos.activo ? porPasos.pasos.includes('cuenta') : true)
  const verHorario = porPasos.activo && porPasos.pasos.includes('horario')
  const irALaCarta = () => {
    if (porPasos.activo) {
      irA('carta')
    } else {
      document.getElementById('carta-qr-inicio')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const valores = { mesa: nombreMesa(mesa), zona: mesa?.zona ?? null, sede: mesa?.nombreSede ?? sede?.nombre ?? null }
  const lugar = [mesa?.zona, [mesa?.nombreSede ?? sede?.nombre, sede?.direccion].filter(Boolean).join(', ')].filter(Boolean).join(' · ')

  const pedirLaCuenta = async () => {
    if (preview) return
    if (sinSesion) {
      mostrarAviso({ tipo: 'info', titulo: 'Tu mesa aún no está abierta', texto: 'Pide al equipo que la abra para pedir la cuenta desde aquí.' })
      return
    }
    const ok = await pedirCuenta()
    if (ok) irA('cuenta')
  }

  const llamar = () => {
    if (preview) return
    if (sinSesion) {
      mostrarAviso({ tipo: 'info', titulo: 'Tu mesa aún no está abierta', texto: 'Cuando el equipo la abra, podrás llamar al mesero desde aquí.' })
      return
    }
    setMesaQR({ servicioAbierto: true })
  }

  return (
    <div style={{ backgroundColor: C.fondo, color: C.texto }} data-entrada-paso="">
      <div className="relative h-[230px] w-full overflow-hidden md:h-[320px] md:rounded-xl" style={{ backgroundColor: C.muySuave }}>
        {c.imageUrl ? (
          <Image src={c.imageUrl} alt={c.imageAlt} fill sizes="(min-width: 768px) 960px, 100vw" className="object-cover" unoptimized={!isOptimizableImage(c.imageUrl)} priority />
        ) : (
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 70%, color-mix(in srgb, ${C.primario} 35%, #2a211c), #1f1915)` }} aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden="true" />
        {c.imageCaption && <p className="absolute bottom-4 left-6 text-sm text-white/95">{c.imageCaption}</p>}
      </div>

      <div className="px-6 pb-6 pt-6 md:px-0">
        {mesa ? (
          <>
            {c.eyebrow && <p className="text-xl italic" style={{ ...TITULO, color: C.suave }}>{reemplazarMarcadores(c.eyebrow, valores)}</p>}
            <h1 className="mt-1 text-[56px] leading-[1.05] md:text-7xl" style={TITULO}>{reemplazarMarcadores(c.title, valores)}</h1>
            {lugar && <p className="mt-3 text-base" style={{ color: C.suave }}>{lugar}</p>}
          </>
        ) : (
          <>
            <h1 className="text-4xl leading-tight" style={TITULO}>{props.organization.name}</h1>
            <p className="mt-3 flex items-start gap-2 text-base" style={{ color: C.suave }}>
              <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              {c.noTableText}
            </p>
          </>
        )}

        {c.showKitchenStatus && (apertura || preview) && (
          <p
            className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={apertura?.estado === 'closed' ? { backgroundColor: ALERTA.fondo, color: ALERTA.texto } : { backgroundColor: OK.fondo, color: OK.texto }}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {apertura ? textoCocina(apertura.texto, apertura.estado) : 'Cocina abierta · hasta las 22:30'}
          </p>
        )}

        {mesa && c.subtitle && <p className="mt-4 text-base leading-6">{reemplazarMarcadores(c.subtitle, valores)}</p>}

        {sinSesion && (
          <p className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: ALERTA.fondo, color: ALERTA.texto }} role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Tu mesa aún no está abierta. Puedes ver la carta y enviar tu pedido: el equipo lo confirma.
          </p>
        )}

        <div ref={setBotones} className="mt-5 flex flex-col gap-3" data-botones-portada-mesa="">
          {verCarta && (
            <BotonPrimario onClick={irALaCarta}>
              {c.primaryCtaText}
            </BotonPrimario>
          )}
          {mesa && (verMesero || verCuenta) && (
            <div className={`grid gap-3 ${verMesero && verCuenta ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {verMesero && (
                <button
                  type="button"
                  onClick={llamar}
                  className="inline-flex min-h-[48px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[15px] font-semibold"
                  style={{ borderColor: C.texto, color: C.texto }}
                >
                  <BellRing className="h-5 w-5" aria-hidden="true" />
                  Llamar al mesero
                </button>
              )}
              {verCuenta && (
                <button
                  type="button"
                  onClick={pedirLaCuenta}
                  className="inline-flex min-h-[48px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2 text-[15px] font-semibold"
                  style={{ borderColor: C.texto, color: C.texto }}
                >
                  {pedido?.sesion?.estado === 'bill_requested' ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <ReceiptText className="h-5 w-5" aria-hidden="true" />}
                  {pedido?.sesion?.estado === 'bill_requested' ? 'Ver la cuenta' : 'Pedir la cuenta'}
                </button>
              )}
            </div>
          )}
        </div>

        {verHorario && (
          // «Horario y sedes» no es una lámina del flujo de Figma: va como enlace a su propio paso.
          <button
            type="button"
            onClick={() => irA('horario')}
            className="mt-4 flex min-h-[44px] w-full items-center gap-2 text-left text-[15px] font-semibold"
            style={{ color: C.texto }}
          >
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">Horario y sedes</span>
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </button>
        )}

        {mesa && c.allergyNote && (
          <p className="mt-4 flex items-center gap-2 text-sm" style={{ color: C.suave }}>
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            {c.allergyNote}
          </p>
        )}
      </div>
    </div>
  )
}
