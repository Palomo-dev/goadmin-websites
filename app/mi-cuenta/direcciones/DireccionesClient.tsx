'use client'

/**
 * Direcciones (Figma «16 Sitio web» G 2977:72598). Tarjetas con la cobertura y el costo del
 * domicilio, y «Nueva dirección» con el aviso «Llegamos: …» mientras se escribe. La cotización es
 * la del checkout (/api/shipping/quote, organización del host); aquí solo se dice en palabras
 * (`textoCobertura`). Guardar, volver principal y quitar: /api/customer/address.
 */
import { useEffect, useState } from 'react'
import { Building2, CheckCircle2, Home, Loader2, MapPin, Plus, XCircle } from 'lucide-react'
import { LocationCheckoutFields } from '@/components/site/LocationCheckoutFields'
import { llegadaZona, type CotizacionPublica } from '@/lib/shipping/domicilioZonas'
import { fechaCorta } from '@/lib/restaurant/horario'
import { textoCobertura, type Cobertura } from '@/lib/cuenta/reglasCuenta'
import { PestanasCuenta } from '@/components/site/cuenta/PestanasCuenta'
import { EstadoVacioCuenta } from '@/components/site/cuenta/EstadoVacioCuenta'

export interface DireccionCuenta {
  id: string
  nombre: string
  linea: string
  barrio: string | null
  ciudad: string
  departamentoNombre: string | null
  indicaciones: string | null
  principal: boolean
  /** Datos para cotizar el domicilio (null si no se puede: otro país o sin departamento). */
  cotizar: { pais: string; departamento: string; ciudad: string; barrio: string | null } | null
}

interface DireccionCotizar {
  pais: string
  departamento: string
  ciudad: string
  barrio: string | null
}

async function cotizar(d: DireccionCotizar): Promise<Cobertura> {
  try {
    const res = await fetch('/api/shipping/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Sin carrito: subtotal 0 (el aviso dice el pedido mínimo si la zona lo tiene).
      body: JSON.stringify({ subtotal: 0, direccion: { ciudad: d.ciudad, pais: d.pais, departamento: d.departamento, barrio: d.barrio } }),
    })
    const data = await res.json().catch(() => ({}))
    const c = data?.usaZonas && data.cotizacion ? (data.cotizacion as CotizacionPublica) : null
    return textoCobertura(!!data?.usaZonas, c, c ? llegadaZona(c, (f) => fechaCorta(f).toLowerCase()) : null)
  } catch {
    return { tipo: 'sin_zonas', texto: 'El costo del envío se calcula al pagar.' }
  }
}

const COLOR_COBERTURA: Record<Cobertura['tipo'], string> = { ok: 'text-green-700', fuera: 'text-red-700', sin_zonas: 'text-slate-600' }
const CAMPO = 'h-11 w-full rounded-[10px] border border-slate-300 bg-white px-3 text-[15px] text-slate-900 outline-none focus:border-[var(--primary-color)]'

function IconoDireccion({ nombre }: { nombre: string }) {
  const n = nombre.toLowerCase()
  const Icono = /casa|hogar|home/.test(n) ? Home : /oficina|trabajo|empresa/.test(n) ? Building2 : MapPin
  return <Icono aria-hidden="true" className="h-[18px] w-[18px] shrink-0" style={{ color: 'var(--primary-color)' }} />
}

export function DireccionesClient({ direcciones: iniciales }: { direcciones: DireccionCuenta[] }) {
  const [lista, setLista] = useState(iniciales)
  const [coberturas, setCoberturas] = useState<Record<string, Cobertura>>({})
  // Sin direcciones se ve el estado vacío del Figma (pantalla 10); su botón abre el formulario.
  const [formulario, setFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState({ nombre: '', linea: '', barrio: '', indicaciones: '', principal: false, countryCode: '', stateCode: '', stateName: '', city: '' })
  const [coberturaNueva, setCoberturaNueva] = useState<Cobertura | null>(null)
  const [cotizando, setCotizando] = useState(false)

  // Cobertura de las guardadas (como mucho 20; la tienda limita por IP).
  useEffect(() => {
    let vigente = true
    const cotizables = iniciales.filter((d) => d.cotizar)
    void Promise.all(cotizables.map(async (d) => [d.id, await cotizar(d.cotizar!)] as const)).then((pares) => {
      if (vigente) setCoberturas(Object.fromEntries(pares))
    })
    return () => {
      vigente = false
    }
  }, [iniciales])

  // Cobertura de la nueva mientras se escribe (misma espera de medio segundo del checkout).
  const paisCot = nueva.countryCode
  useEffect(() => {
    if (!formulario || paisCot !== 'COL' || !nueva.stateCode || !nueva.city.trim()) {
      setCoberturaNueva(null)
      return
    }
    let vigente = true
    setCotizando(true)
    const t = window.setTimeout(async () => {
      const c = await cotizar({ pais: paisCot, departamento: nueva.stateCode, ciudad: nueva.city, barrio: nueva.barrio.trim() || null })
      if (vigente) {
        setCoberturaNueva(c)
        setCotizando(false)
      }
    }, 500)
    return () => {
      vigente = false
      window.clearTimeout(t)
    }
  }, [formulario, paisCot, nueva.stateCode, nueva.city, nueva.barrio])

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!nueva.linea.trim() || !nueva.city.trim()) {
      setError('Escribe la dirección y elige la ciudad.')
      return
    }
    setGuardando(true)
    try {
      const res = await fetch('/api/customer/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: nueva.nombre.trim() || 'Dirección',
          address_line: nueva.linea,
          barrio: nueva.barrio,
          indicaciones: nueva.indicaciones,
          city: nueva.city,
          country_code: nueva.countryCode,
          state_code: nueva.stateCode,
          department: nueva.stateName,
          is_default: nueva.principal || lista.length === 0,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.address) {
        setError(data.error || 'No pudimos guardar la dirección')
        return
      }
      const a = data.address
      const nuevaDir: DireccionCuenta = {
        id: a.id,
        nombre: a.label || 'Dirección',
        linea: a.address_line1,
        barrio: a.address_line2,
        ciudad: a.city,
        departamentoNombre: a.department,
        indicaciones: a.delivery_instructions,
        principal: !!a.is_default,
        cotizar: nueva.countryCode === 'COL' && nueva.stateCode ? { pais: 'COL', departamento: nueva.stateCode, ciudad: nueva.city, barrio: nueva.barrio.trim() || null } : null,
      }
      setLista((l) => [...(nuevaDir.principal ? l.map((x) => ({ ...x, principal: false })) : l), nuevaDir].sort((x, y) => Number(y.principal) - Number(x.principal)))
      if (coberturaNueva) setCoberturas((c) => ({ ...c, [nuevaDir.id]: coberturaNueva }))
      setNueva({ nombre: '', linea: '', barrio: '', indicaciones: '', principal: false, countryCode: nueva.countryCode, stateCode: '', stateName: '', city: '' })
      setCoberturaNueva(null)
      setFormulario(false)
    } catch {
      setError('Revisa tu conexión e intenta de nuevo')
    } finally {
      setGuardando(false)
    }
  }

  const accion = async (id: string, metodo: 'PATCH' | 'DELETE') => {
    setError(null)
    const res = await fetch('/api/customer/address', {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metodo === 'PATCH' ? { id, is_default: true } : { id }),
    }).catch(() => null)
    if (!res?.ok) {
      setError(metodo === 'PATCH' ? 'No pudimos cambiar la principal' : 'No pudimos quitar la dirección')
      return
    }
    setLista((l) =>
      metodo === 'DELETE'
        ? l.filter((x) => x.id !== id)
        : l.map((x) => ({ ...x, principal: x.id === id })).sort((x, y) => Number(y.principal) - Number(x.principal)),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 md:text-[28px]">Direcciones</h1>
          <p className="text-sm text-slate-600 md:text-[15px]">Elige la principal para pagar más rápido.</p>
        </div>
        {!formulario && lista.length > 0 && (
          <button type="button" onClick={() => setFormulario(true)} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-4 text-sm font-semibold text-white" style={{ backgroundColor: 'var(--primary-color)' }}>
            <Plus aria-hidden="true" className="h-4 w-4" /> Agregar
          </button>
        )}
      </div>
      <PestanasCuenta />

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      {lista.map((d) => {
        const cob = coberturas[d.id]
        return (
          <article key={d.id} className="flex flex-col gap-1.5 rounded-[14px] border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <IconoDireccion nombre={d.nombre} />
              <h2 className="text-base font-semibold text-slate-900">{d.nombre}</h2>
              {d.principal && <span className="rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-xs font-semibold text-sky-700">Principal</span>}
            </div>
            <p className="text-sm text-slate-900">{[d.linea, [d.barrio, d.ciudad].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
            {d.indicaciones && <p className="text-[13px] text-slate-600">{d.indicaciones}</p>}
            {cob && <p className={`text-xs ${COLOR_COBERTURA[cob.tipo]}`}>{cob.texto}</p>}
            <div className="mt-1 flex gap-4 text-[13px] font-semibold">
              {!d.principal && (
                <button type="button" onClick={() => void accion(d.id, 'PATCH')} className="hover:underline" style={{ color: 'var(--primary-color)' }}>
                  Usar como principal
                </button>
              )}
              <button type="button" onClick={() => void accion(d.id, 'DELETE')} className="text-slate-600 hover:underline">
                Quitar
              </button>
            </div>
          </article>
        )
      })}

      {lista.length === 0 && !formulario && (
        <EstadoVacioCuenta
          icono={MapPin}
          titulo="Aún no tienes direcciones"
          texto="Guarda una y paga más rápido la próxima vez. Te decimos si te llega el domicilio."
          alPulsar={{ texto: 'Agregar dirección', onClick: () => setFormulario(true) }}
        />
      )}

      {formulario && (
        <form onSubmit={guardar} className="flex flex-col gap-4 rounded-[14px] border bg-white p-4" style={{ borderColor: 'var(--primary-color)' }}>
          <h2 className="text-base font-semibold text-slate-900">Nueva dirección</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dir-nombre" className="text-sm font-medium text-slate-900">Nombre</label>
            <input id="dir-nombre" className={CAMPO} placeholder="Casa, Oficina…" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dir-linea" className="text-sm font-medium text-slate-900">Dirección</label>
            <div className="relative">
              <MapPin aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input id="dir-linea" required className={`${CAMPO} pl-9`} autoComplete="street-address" placeholder="Calle 53 #9-11" value={nueva.linea} onChange={(e) => setNueva({ ...nueva, linea: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dir-barrio" className="text-sm font-medium text-slate-900">Barrio</label>
            <input id="dir-barrio" className={CAMPO} value={nueva.barrio} onChange={(e) => setNueva({ ...nueva, barrio: e.target.value })} />
          </div>
          {/* País, departamento y ciudad: el mismo selector del checkout (la cotización los necesita igual). */}
          <LocationCheckoutFields
            countryCode={nueva.countryCode}
            stateCode={nueva.stateCode}
            stateName={nueva.stateName}
            city={nueva.city}
            primaryColor="var(--primary-color)"
            onChange={(d) => setNueva((x) => ({ ...x, countryCode: d.countryCode, stateCode: d.stateCode, stateName: d.stateName, city: d.city }))}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dir-indicaciones" className="text-sm font-medium text-slate-900">Indicaciones (opcional)</label>
            <input id="dir-indicaciones" className={CAMPO} placeholder="Timbre 2, casa azul" value={nueva.indicaciones} onChange={(e) => setNueva({ ...nueva, indicaciones: e.target.value })} />
          </div>
          {(cotizando || coberturaNueva) && (
            <p
              aria-live="polite"
              className={`flex items-start gap-2 rounded-[10px] p-3 text-[13px] ${coberturaNueva?.tipo === 'fuera' ? 'bg-red-50 text-red-800' : coberturaNueva?.tipo === 'ok' ? 'bg-green-50 text-slate-900' : 'bg-slate-50 text-slate-700'}`}
            >
              {cotizando ? (
                <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : coberturaNueva?.tipo === 'fuera' ? (
                <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              ) : (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              )}
              <span>{cotizando ? 'Revisando si llegamos…' : coberturaNueva?.tipo === 'ok' ? `Llegamos: ${coberturaNueva.texto.charAt(0).toLowerCase()}${coberturaNueva.texto.slice(1)}` : coberturaNueva?.texto}</span>
            </p>
          )}
          {lista.length > 0 && (
            <label className="flex items-center gap-2.5 text-sm text-slate-900">
              <input type="checkbox" checked={nueva.principal} onChange={(e) => setNueva({ ...nueva, principal: e.target.checked })} style={{ accentColor: 'var(--primary-color)' }} className="h-4 w-4" />
              Usar como principal
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button type="submit" disabled={guardando} className="flex h-11 flex-1 items-center justify-center rounded-[10px] text-[15px] font-semibold text-white disabled:opacity-60" style={{ backgroundColor: 'var(--primary-color)' }}>
              {guardando ? 'Guardando…' : 'Guardar dirección'}
            </button>
            {lista.length > 0 && (
              <button type="button" onClick={() => setFormulario(false)} className="h-11 rounded-[10px] border border-slate-300 px-4 text-sm font-semibold text-slate-900">
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
