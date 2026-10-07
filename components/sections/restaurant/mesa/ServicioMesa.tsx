'use client'

/**
 * `table_service` «Servicio de mesa» (láminas 02, 07, 07b, 11 y 15).
 *
 * - Variante `barra`: barra fija arriba con la mesa («Mesa 7 · Terraza», «Sede Centro ·
 *   abierto»), «Mesero» y «Cuenta». En tableta (md+) lleva además el buscador de la carta y
 *   los botones con texto (lámina 15). Debajo, la banda «Sin conexión» (lámina 11) cuando el
 *   celular pierde la señal.
 * - Variante `botones`: «Llamar al mesero» y «Pedir la cuenta» como botones en la página.
 *
 * «Mesero» abre la hoja «¿Qué necesitas?» (motivos editables) y avisa al mesero de la sesión
 * (POST /api/mesa/<mesa>/solicitar: la base deduplica 60 s por mesa). «Cuenta» pide la cuenta y
 * abre la hoja de la cuenta. Sin QR de mesa, la sección no pinta nada (salvo en el editor).
 */

import { useEffect, useState } from 'react'
import { BellRing, ReceiptText, Search, WifiOff } from 'lucide-react'
import { normalizarServicioMesa, varianteSeccionMesa } from '@/lib/website/v2/contrato/seccionesMesa'
import { irA, mostrarAviso, pedirCuenta, refrescarMesa, setMesaQR, useMesaQRStore } from '@/lib/restaurant/mesaStore'
import { usePasosMesa } from '@/components/site/PasosMesaContext'
import { AvisosMesa, fijarConfigServicio } from './AvisosMesa'
import { nombreMesa, useSeccionMesa, type PropsSeccionMesa } from './comun'
import { ALERTA, C, TITULO } from './estilo'

export function ServicioMesa(props: PropsSeccionMesa) {
  const c = normalizarServicioMesa(props.content)
  const variante = varianteSeccionMesa('table_service', props.sectionVariant)
  const { mesa, preview } = useSeccionMesa(props, 'servicio')
  const pedido = useMesaQRStore((e) => e.pedido)
  const sinConexion = useMesaQRStore((e) => e.sinConexion)
  const busqueda = useMesaQRStore((e) => e.busqueda)
  // Por pasos, «Cuenta» solo si la página tiene «Cuenta de la mesa»; sin pasos, como siempre.
  const porPasos = usePasosMesa()
  const verCuenta = c.showBillButton && (porPasos.activo ? porPasos.pasos.includes('cuenta') : true)
  useEffect(() => {
    fijarConfigServicio(c)
  })
  // La barra queda fija arriba al pasar por ella (cada sección vive en su propio contenedor, así
  // que `sticky` no la sostendría): un centinela marca cuándo salió de la pantalla. El centinela
  // llega por callback ref (la barra no existe mientras la mesa se resuelve) y se mide en cada
  // scroll: con IntersectionObserver el umbral no se notificaba al salir por arriba.
  const [centinela, setCentinela] = useState<HTMLDivElement | null>(null)
  const [fija, setFija] = useState(false)
  const [alto, setAlto] = useState(0)
  useEffect(() => {
    if (!centinela || preview) return
    const medir = () => setFija(centinela.getBoundingClientRect().top < 0)
    medir()
    window.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [centinela, preview])
  // Alto de la barra: la carta fija sus categorías justo debajo (--barra-mesa-h).
  const [barra, setBarra] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = barra
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      setAlto(el.offsetHeight)
      document.documentElement.style.setProperty('--barra-mesa-h', `${el.offsetHeight}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--barra-mesa-h')
    }
  }, [barra])

  if (!mesa) return <AvisosMesa />

  const sinSesion = !preview && pedido !== null && pedido.sesion === null
  const abrirServicio = () => {
    if (preview) return
    if (sinSesion) {
      mostrarAviso({ tipo: 'info', titulo: 'Tu mesa aún no está abierta', texto: 'Cuando el equipo la abra, podrás llamar al mesero desde aquí.' })
      return
    }
    setMesaQR({ servicioAbierto: true })
  }
  const abrirCuenta = async () => {
    if (preview) return
    if (sinSesion) {
      mostrarAviso({ tipo: 'info', titulo: 'Tu mesa aún no está abierta', texto: 'Pide al equipo que la abra para pedir la cuenta desde aquí.' })
      return
    }
    if (await pedirCuenta()) irA('cuenta')
  }

  const titulo = [nombreMesa(mesa), mesa.zona].filter(Boolean).join(' · ')
  const sub = [mesa.nombreSede, sinSesion ? 'mesa sin abrir' : 'abierto'].filter(Boolean).join(' · ')
  const subTableta = [props.organization.name, mesa.nombreSede].filter(Boolean).join(' · ')
  const inicial = (props.organization.name || 'R').trim().charAt(0).toUpperCase()

  if (variante === 'botones') {
    return (
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3 py-2">
        <button type="button" onClick={abrirServicio} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-2 font-semibold" style={{ borderColor: C.texto, color: C.texto }}>
          <BellRing className="h-5 w-5" aria-hidden="true" /> {c.buttonText}
        </button>
        {verCuenta && (
          <button type="button" onClick={() => void abrirCuenta()} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border px-2 font-semibold" style={{ borderColor: C.texto, color: C.texto }}>
            <ReceiptText className="h-5 w-5" aria-hidden="true" /> Pedir la cuenta
          </button>
        )}
        <AvisosMesa />
      </div>
    )
  }

  return (
    <div>
    <div ref={setCentinela} aria-hidden="true" />
    <div style={fija ? { height: alto } : undefined}>
    <div ref={setBarra} className={fija ? 'fixed inset-x-0 top-0 z-40' : ''} data-barra-mesa>
      <div className="flex items-center gap-3 border-b px-4 py-3 md:px-5" style={{ backgroundColor: C.fondo, borderColor: C.borde, color: C.texto }}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold" style={{ ...TITULO, backgroundColor: C.oscuro, color: C.sobreOscuro }}>
          {inicial}
        </span>
        <div className="min-w-0 flex-1 md:flex-none md:pr-4">
          <p className="truncate text-[17px] font-semibold leading-5">{titulo}</p>
          <p className="truncate text-sm md:hidden" style={{ color: C.suave }}>{sub}</p>
          <p className="hidden truncate text-sm md:block" style={{ color: C.suave }}>{subTableta}</p>
        </div>
        <label className="relative hidden flex-1 md:block">
          <span className="sr-only">Buscar plato o ingrediente</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.suave }} aria-hidden="true" />
          <input
            value={busqueda}
            onChange={(e) => setMesaQR({ busqueda: e.target.value.slice(0, 60) })}
            placeholder="Buscar plato o ingrediente"
            className="h-11 w-full rounded-lg border pl-9 pr-3 text-[15px]"
            style={{ borderColor: C.borde, backgroundColor: C.tarjeta, color: C.texto }}
          />
        </label>
        {/* Celular: iconos con texto debajo (lámina 02). */}
        <button type="button" onClick={abrirServicio} className="flex w-14 flex-col items-center gap-0.5 text-xs md:hidden" aria-label={c.buttonText}>
          <BellRing className="h-6 w-6" aria-hidden="true" />
          Mesero
        </button>
        {verCuenta && (
          <button type="button" onClick={() => void abrirCuenta()} className="flex w-14 flex-col items-center gap-0.5 text-xs md:hidden" aria-label="Pedir la cuenta">
            <ReceiptText className="h-6 w-6" aria-hidden="true" />
            Cuenta
          </button>
        )}
        {/* Tableta: botones con texto (lámina 15). */}
        <button type="button" onClick={abrirServicio} className="hidden h-11 items-center gap-2 rounded-lg border px-4 text-[15px] font-semibold md:inline-flex" style={{ borderColor: C.texto }}>
          <BellRing className="h-4 w-4" aria-hidden="true" /> {c.buttonText}
        </button>
        {verCuenta && (
          <button type="button" onClick={() => void abrirCuenta()} className="hidden h-11 items-center gap-2 rounded-lg border px-4 text-[15px] font-semibold md:inline-flex" style={{ borderColor: C.texto }}>
            <ReceiptText className="h-4 w-4" aria-hidden="true" /> Pedir la cuenta
          </button>
        )}
      </div>
      {sinConexion && (
        <div className="flex items-start gap-3 px-4 py-3" style={{ backgroundColor: ALERTA.fondo, color: ALERTA.texto }} role="status">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div className="text-sm">
            <p className="text-base font-semibold">Sin conexión</p>
            <p>Tu pedido queda guardado en este celular y lo enviamos cuando vuelva la señal. Los precios pueden no estar al día.</p>
            <button type="button" className="mt-1 font-semibold underline-offset-2 hover:underline" onClick={() => void refrescarMesa()}>
              Reintentar ahora
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
      <AvisosMesa />
    </div>
  )
}

